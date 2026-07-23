import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LedgerTag, Prisma, TransactionStatus } from '@ta-spiru/database';
import { RevenueSplitReport } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Settled revenue grouped by ledger tag; `from`/`to` bound `settledAt` inclusively when provided. */
  async revenueSplits(query: RevenueReportQueryDto): Promise<RevenueSplitReport> {
    try {
      const from = query.from ? new Date(query.from) : null;
      const to = query.to ? new Date(query.to) : null;

      const settledAt: Prisma.DateTimeNullableFilter | undefined =
        from || to
          ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
          : undefined;

      const grouped = await this.prisma.transactionSplit.groupBy({
        by: ['ledgerTag'],
        where: {
          transaction: {
            status: TransactionStatus.SETTLED,
            ...(settledAt ? { settledAt } : {}),
          },
        },
        _sum: { amountCents: true },
        _count: { _all: true },
      });

      const lines = Object.values(LedgerTag).map((tag) => {
        const entry = grouped.find((group) => group.ledgerTag === tag);
        return {
          ledgerTag: tag,
          amountCents: entry?._sum.amountCents ?? 0,
          splitCount: entry?._count._all ?? 0,
        };
      });

      return {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
        lines,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to build revenue split report');
    }
  }
}
