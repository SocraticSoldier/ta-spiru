import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { LedgerTag, OrderChannel, PaymentChannel, Product } from '@ta-spiru/database';
import { EcomCheckoutResponse, OrderRow, PosCheckoutResponse } from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CouponsService } from '../coupons/coupons.service';
import { TrustPaymentsService } from '../payments/trust-payments.service';
import { SplitLedgerTagInput } from '../payments/interfaces/trust-payments.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEcomOrderDto, CreatePosOrderDto, OrderItemDto } from './dto/orders.dtos';

const FLAGSHIP_SLUG = 'naxxar';

interface PricedItem {
  product: Product;
  quantity: number;
  lineTotalCents: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustPaymentsService: TrustPaymentsService,
    private readonly couponsService: CouponsService,
  ) {}

  /** In-store POS checkout: creates the order and opens the terminal payment intent. */
  async createPosOrder(dto: CreatePosOrderDto, actor: AuthenticatedUser): Promise<PosCheckoutResponse> {
    try {
      const priced = await this.priceItems(dto.items, dto.locationId);
      const subtotalCents = priced.reduce((sum, item) => sum + item.lineTotalCents, 0);

      let couponCode: string | null = null;
      let discountCents = 0;
      if (dto.couponCode) {
        const redeemed = await this.couponsService.redeem(dto.couponCode, subtotalCents, dto.locationId, actor);
        couponCode = redeemed.code;
        discountCents = redeemed.discountCents;
      }
      const totalCents = subtotalCents - discountCents;
      if (totalCents <= 0) {
        throw new BadRequestException('The discount cannot cover the full sale');
      }

      const order = await this.prisma.order.create({
        data: {
          locationId: dto.locationId,
          customerId: dto.customerId ?? null,
          channel: OrderChannel.POS,
          totalCents,
          couponCode,
          discountCents,
          items: {
            create: priced.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              unitPriceCents: item.product.priceCents,
              ledgerTag: item.product.ledgerTag,
            })),
          },
        },
      });

      const paymentIntent = await this.trustPaymentsService.createPaymentIntent({
        amountCents: totalCents,
        channel: PaymentChannel.POS_TERMINAL,
        splitLedgerTags: this.applyDiscount(this.buildSplits(priced, dto.locationId), subtotalCents, discountCents),
        customerId: dto.customerId ?? actor.id,
        orderIds: [order.id],
      });

      return { orderId: order.id, totalCents, discountCents, paymentIntent };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('POS checkout failed');
    }
  }

  /** Online storefront checkout: fulfilment defaults to the flagship hub. */
  async createEcommerceOrder(dto: CreateEcomOrderDto, customerId: string): Promise<EcomCheckoutResponse> {
    try {
      const locationId = dto.locationId ?? (await this.flagshipLocationId());
      const priced = await this.priceItems(dto.items, locationId);
      const totalCents = priced.reduce((sum, item) => sum + item.lineTotalCents, 0);

      const order = await this.prisma.order.create({
        data: {
          locationId,
          customerId,
          channel: OrderChannel.ECOMMERCE,
          totalCents,
          items: {
            create: priced.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              unitPriceCents: item.product.priceCents,
              ledgerTag: item.product.ledgerTag,
            })),
          },
        },
      });

      const paymentIntent = await this.trustPaymentsService.createPaymentIntent({
        amountCents: totalCents,
        channel: PaymentChannel.ONLINE,
        splitLedgerTags: this.buildSplits(priced, locationId),
        customerId,
        orderIds: [order.id],
      });

      return { orderId: order.id, totalCents, paymentIntent };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('E-commerce checkout failed');
    }
  }

  async myOrders(customerId: string): Promise<OrderRow[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { customerId },
        include: {
          location: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return orders.map((order) => ({
        id: order.id,
        channel: order.channel,
        status: order.status,
        totalCents: order.totalCents,
        locationName: order.location.name,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to list orders');
    }
  }

  private async flagshipLocationId(): Promise<string> {
    const flagship =
      (await this.prisma.location.findFirst({
        where: { slug: FLAGSHIP_SLUG, isActive: true },
        select: { id: true },
      })) ??
      (await this.prisma.location.findFirst({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true },
      }));
    if (!flagship) {
      throw new BadRequestException('No active fulfilment location configured');
    }
    return flagship.id;
  }

  protected async priceItems(items: readonly OrderItemDto[], locationId: string): Promise<PricedItem[]> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const priced = items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found or inactive`);
      }
      return { product, quantity: item.quantity, lineTotalCents: product.priceCents * item.quantity };
    });

    const levels = await this.prisma.stockLevel.findMany({
      where: { locationId, productId: { in: priced.map((item) => item.product.id) } },
      select: { productId: true, quantity: true },
    });
    const levelByProduct = new Map(levels.map((level) => [level.productId, level.quantity]));
    for (const item of priced) {
      const available = levelByProduct.get(item.product.id) ?? 0;
      if (available < item.quantity) {
        throw new ConflictException(
          `Insufficient stock for ${item.product.name} (have ${available}, need ${item.quantity})`,
        );
      }
    }
    return priced;
  }

  protected buildSplits(priced: readonly PricedItem[], locationId: string): SplitLedgerTagInput[] {
    const totals = new Map<LedgerTag, number>();
    for (const item of priced) {
      totals.set(item.product.ledgerTag, (totals.get(item.product.ledgerTag) ?? 0) + item.lineTotalCents);
    }
    return [...totals.entries()].map(([tag, amountCents]) => ({ tag, amountCents, locationId }));
  }

  /** Scales ledger splits down proportionally so they still sum exactly to the discounted total. */
  protected applyDiscount(
    splits: readonly SplitLedgerTagInput[],
    subtotalCents: number,
    discountCents: number,
  ): SplitLedgerTagInput[] {
    if (discountCents <= 0) return [...splits];
    const chargedCents = subtotalCents - discountCents;
    const scaled = splits.map((split) => ({
      ...split,
      amountCents: Math.floor((split.amountCents * chargedCents) / subtotalCents),
    }));
    let remainder = chargedCents - scaled.reduce((sum, split) => sum + split.amountCents, 0);
    const byLargest = [...scaled].sort((a, b) => b.amountCents - a.amountCents);
    for (const split of byLargest) {
      if (remainder <= 0) break;
      split.amountCents += 1;
      remainder -= 1;
    }
    return scaled;
  }
}
