import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { LedgerTag, OrderChannel, PaymentChannel, Product } from '@ta-spiru/database';
import { PosCheckoutResponse } from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { TrustPaymentsService } from '../payments/trust-payments.service';
import { SplitLedgerTagInput } from '../payments/interfaces/trust-payments.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosOrderDto, OrderItemDto } from './dto/orders.dtos';

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
  ) {}

  /** In-store POS checkout: creates the order and opens the terminal payment intent. */
  async createPosOrder(dto: CreatePosOrderDto, actor: AuthenticatedUser): Promise<PosCheckoutResponse> {
    try {
      const priced = await this.priceItems(dto.items, dto.locationId);
      const totalCents = priced.reduce((sum, item) => sum + item.lineTotalCents, 0);

      const order = await this.prisma.order.create({
        data: {
          locationId: dto.locationId,
          customerId: dto.customerId ?? null,
          channel: OrderChannel.POS,
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
        channel: PaymentChannel.POS_TERMINAL,
        splitLedgerTags: this.buildSplits(priced, dto.locationId),
        customerId: dto.customerId ?? actor.id,
        orderIds: [order.id],
      });

      return { orderId: order.id, totalCents, paymentIntent };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('POS checkout failed');
    }
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
}
