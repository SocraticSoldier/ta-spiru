import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LoyaltyAccount, LoyaltyEntryKind, Prisma } from '@ta-spiru/database';
import { LoyaltyPass, LoyaltyScanResult, LoyaltySummary } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedeemPointsDto } from './dto/loyalty.dtos';
import { pointsForAmount, tierForLifetime } from './loyalty.math';

const QR_PREFIX = 'taspiru:loyalty:v1:';
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Awards points for a settled Trust Payments transaction. Runs inside the
   * caller's settlement transaction so points and payment state stay atomic.
   */
  async awardForSettlement(
    client: Prisma.TransactionClient,
    input: { transactionId: string; customerId: string; amountCents: number },
  ): Promise<void> {
    const points = pointsForAmount(input.amountCents);
    if (points <= 0) {
      return;
    }
    const account = await client.loyaltyAccount.upsert({
      where: { userId: input.customerId },
      update: {
        balancePoints: { increment: points },
        lifetimePoints: { increment: points },
      },
      create: {
        userId: input.customerId,
        balancePoints: points,
        lifetimePoints: points,
      },
    });
    const tier = tierForLifetime(account.lifetimePoints);
    if (tier !== account.tier) {
      await client.loyaltyAccount.update({ where: { id: account.id }, data: { tier } });
    }
    await client.loyaltyLedgerEntry.create({
      data: {
        accountId: account.id,
        kind: LoyaltyEntryKind.EARN,
        deltaPoints: points,
        reference: input.transactionId,
      },
    });
  }

  async me(userId: string): Promise<LoyaltySummary> {
    try {
      const account = await this.getOrCreate(userId);
      const entries = await this.prisma.loyaltyLedgerEntry.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return {
        balancePoints: account.balancePoints,
        lifetimePoints: account.lifetimePoints,
        tier: account.tier,
        recentEntries: entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          deltaPoints: entry.deltaPoints,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      throw this.wrap(error, 'Failed to load loyalty account');
    }
  }

  async redeem(userId: string, dto: RedeemPointsDto): Promise<LoyaltySummary> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.loyaltyAccount.findUnique({ where: { userId } });
        if (!account || account.balancePoints < dto.points) {
          throw new ConflictException(
            `Insufficient points (have ${account?.balancePoints ?? 0}, need ${dto.points})`,
          );
        }
        await tx.loyaltyAccount.update({
          where: { id: account.id },
          data: { balancePoints: { decrement: dto.points } },
        });
        await tx.loyaltyLedgerEntry.create({
          data: {
            accountId: account.id,
            kind: LoyaltyEntryKind.REDEEM,
            deltaPoints: -dto.points,
            note: dto.note ?? null,
          },
        });
      });
      return this.me(userId);
    } catch (error) {
      throw this.wrap(error, 'Failed to redeem points');
    }
  }

  /** Data for the Apple/Google Wallet pass; the QR encodes the wallet pass token. */
  async pass(userId: string): Promise<LoyaltyPass> {
    try {
      const account = await this.getOrCreate(userId);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      return {
        walletPassToken: account.walletPassToken,
        qrPayload: `${QR_PREFIX}${account.walletPassToken}`,
        tier: account.tier,
        balancePoints: account.balancePoints,
        displayName: `${user.firstName} ${user.lastName}`,
      };
    } catch (error) {
      throw this.wrap(error, 'Failed to build wallet pass');
    }
  }

  /** Receptionist scans a customer's wallet pass to verify tier and balance. */
  async scan(qrPayload: string): Promise<LoyaltyScanResult> {
    try {
      const token = qrPayload.startsWith(QR_PREFIX) ? qrPayload.slice(QR_PREFIX.length) : qrPayload;
      const account = await this.prisma.loyaltyAccount.findUnique({
        where: { walletPassToken: token },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (!account) {
        throw new NotFoundException('Unknown wallet pass');
      }
      return {
        accountId: account.id,
        customerName: `${account.user.firstName} ${account.user.lastName}`,
        tier: account.tier,
        balancePoints: account.balancePoints,
        lifetimePoints: account.lifetimePoints,
      };
    } catch (error) {
      throw this.wrap(error, 'Failed to scan wallet pass');
    }
  }

  private async getOrCreate(userId: string): Promise<LoyaltyAccount> {
    try {
      return await this.prisma.loyaltyAccount.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
    } catch (error) {
      // Two first-visit requests can race the create; the loser re-reads.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      }
      throw error;
    }
  }

  private wrap(error: unknown, fallback: string): HttpException {
    return error instanceof HttpException ? error : new InternalServerErrorException(fallback);
  }
}
