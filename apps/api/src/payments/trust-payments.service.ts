import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OrderChannel,
  OrderStatus,
  AppointmentStatus,
  Prisma,
  StockMovementKind,
  TransactionStatus,
} from '@ta-spiru/database';
import { DEFAULT_CURRENCY } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TrustPaymentsWebhookDto } from './dto/trust-payments-webhook.dto';
import {
  CreatePaymentIntentInput,
  PaymentIntent,
  TrustPaymentsJwtClaims,
  WebhookProcessingResult,
} from './interfaces/trust-payments.interfaces';

const STOCK_MOVEMENT_BY_CHANNEL: Record<OrderChannel, StockMovementKind> = {
  [OrderChannel.ECOMMERCE]: StockMovementKind.SALE_ECOMMERCE,
  [OrderChannel.POS]: StockMovementKind.SALE_POS,
  [OrderChannel.BACK_BAR]: StockMovementKind.BACK_BAR_USE,
};

@Injectable()
export class TrustPaymentsService {
  private readonly siteReference: string;
  private readonly jwtUsername: string;
  private readonly jwtSecret: string;
  private readonly webhookPassword: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.siteReference = config.getOrThrow<string>('TRUST_PAYMENTS_SITE_REFERENCE');
    this.jwtUsername = config.getOrThrow<string>('TRUST_PAYMENTS_JWT_USERNAME');
    this.jwtSecret = config.getOrThrow<string>('TRUST_PAYMENTS_JWT_SECRET');
    this.webhookPassword = config.getOrThrow<string>('TRUST_PAYMENTS_WEBHOOK_PASSWORD');
  }

  /**
   * Opens a PENDING ledger transaction with its revenue splits and returns the
   * signed JWT the client hands to Trust Payments' JS library / payment pages.
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const currency = input.currency ?? DEFAULT_CURRENCY;
    const splitTotal = input.splitLedgerTags.reduce((sum, split) => sum + split.amountCents, 0);
    if (input.amountCents <= 0) {
      throw new BadRequestException('amountCents must be positive');
    }
    if (splitTotal !== input.amountCents) {
      throw new BadRequestException(
        `Ledger splits (${splitTotal}) must sum to the transaction amount (${input.amountCents})`,
      );
    }

    try {
      const transaction = await this.prisma.transaction.create({
        data: {
          amountCents: input.amountCents,
          currency,
          channel: input.channel,
          siteReference: this.siteReference,
          customerId: input.customerId ?? null,
          splits: {
            create: input.splitLedgerTags.map((split) => ({
              ledgerTag: split.tag,
              amountCents: split.amountCents,
              locationId: split.locationId ?? null,
            })),
          },
          appointments: input.appointmentIds?.length
            ? { connect: input.appointmentIds.map((id) => ({ id })) }
            : undefined,
          orders: input.orderIds?.length
            ? { connect: input.orderIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      const claims: TrustPaymentsJwtClaims = {
        payload: {
          accounttypedescription: 'ECOM',
          baseamount: String(input.amountCents),
          currencyiso3a: currency,
          sitereference: this.siteReference,
          orderreference: transaction.paymentReference,
        },
      };
      const jwt = await this.jwtService.signAsync(claims, {
        secret: this.jwtSecret,
        algorithm: 'HS256',
        issuer: this.jwtUsername,
      });

      return {
        transactionId: transaction.id,
        paymentReference: transaction.paymentReference,
        jwt,
        siteReference: this.siteReference,
        amountCents: transaction.amountCents,
        currency: transaction.currency,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException('One or more linked appointments/orders do not exist');
      }
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  /**
   * Idempotent URL-notification handler: settles the ledger transaction,
   * confirms its appointments and marks its orders paid, deducting stock
   * through the central inventory ledger.
   */
  async handlePaymentSuccess(payload: TrustPaymentsWebhookDto): Promise<WebhookProcessingResult> {
    try {
      this.verifySiteSecurity(payload);

      const transaction = await this.prisma.transaction.findUnique({
        where: { paymentReference: payload.orderreference },
        include: {
          appointments: { select: { id: true } },
          orders: { include: { items: true } },
        },
      });
      if (!transaction) {
        throw new NotFoundException(`Unknown orderreference ${payload.orderreference}`);
      }
      if (transaction.status === TransactionStatus.SETTLED) {
        return {
          transactionId: transaction.id,
          status: transaction.status,
          appointmentsConfirmed: 0,
          ordersPaid: 0,
          alreadyProcessed: true,
        };
      }

      const rawPayload = { ...payload } as unknown as Prisma.InputJsonValue;

      if (payload.errorcode !== '0') {
        const declined = await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.DECLINED,
            transactionReference: payload.transactionreference,
            rawWebhookPayload: rawPayload,
          },
        });
        return {
          transactionId: declined.id,
          status: declined.status,
          appointmentsConfirmed: 0,
          ordersPaid: 0,
          alreadyProcessed: false,
        };
      }

      const [appointmentsConfirmed, ordersPaid] = await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.SETTLED,
            transactionReference: payload.transactionreference,
            settledAt: new Date(),
            rawWebhookPayload: rawPayload,
          },
        });

        const confirmed = await tx.appointment.updateMany({
          where: { transactionId: transaction.id, status: AppointmentStatus.PENDING_PAYMENT },
          data: { status: AppointmentStatus.CONFIRMED },
        });

        let paidOrders = 0;
        for (const order of transaction.orders) {
          if (order.status !== OrderStatus.PENDING_PAYMENT) {
            continue;
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.PAID },
          });
          for (const item of order.items) {
            await tx.stockLevel.update({
              where: {
                productId_locationId: { productId: item.productId, locationId: order.locationId },
              },
              data: { quantity: { decrement: item.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                locationId: order.locationId,
                kind: STOCK_MOVEMENT_BY_CHANNEL[order.channel],
                quantityDelta: -item.quantity,
                reference: order.id,
              },
            });
          }
          paidOrders += 1;
        }

        return [confirmed.count, paidOrders] as const;
      });

      return {
        transactionId: transaction.id,
        status: TransactionStatus.SETTLED,
        appointmentsConfirmed,
        ordersPaid,
        alreadyProcessed: false,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process Trust Payments notification');
    }
  }

  /**
   * Recomputes the site-security digest. The field order MUST mirror the URL
   * notification configuration in the MyST portal.
   */
  private verifySiteSecurity(payload: TrustPaymentsWebhookDto): void {
    if (!payload.responsesitesecurity) {
      throw new ForbiddenException('Missing site security digest');
    }
    const digestInput = [
      payload.errorcode,
      payload.orderreference,
      payload.settlestatus ?? '',
      payload.sitereference,
      payload.transactionreference,
      this.webhookPassword,
    ].join('');
    const expected = createHash('sha256').update(digestInput, 'utf8').digest('hex');
    const provided = payload.responsesitesecurity.toLowerCase();

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new ForbiddenException('Invalid site security digest');
    }
  }
}
