import { Controller, Get, Query } from '@nestjs/common';
import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { ServiceKind } from '@ta-spiru/database';
import { ServiceSummary } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalog for the storefront and mobile app. */
  @Get()
  async list(@Query('kind') kind?: string): Promise<ServiceSummary[]> {
    try {
      const kindFilter =
        kind === ServiceKind.BARBER || kind === ServiceKind.WASH ? (kind as ServiceKind) : undefined;
      const services = await this.prisma.service.findMany({
        where: { isActive: true, ...(kindFilter ? { kind: kindFilter } : {}) },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { priceCents: 'asc' }],
        include: { tiers: true },
      });
      const order = { JUNIOR: 0, NORMAL: 1, SENIOR: 2 } as const;
      return services.map((service) => ({
        id: service.id,
        slug: service.slug,
        name: service.name,
        kind: service.kind,
        durationMin: service.durationMin,
        priceCents: service.priceCents,
        isComboEligible: service.isComboEligible,
        isQuoteOnly: service.isQuoteOnly,
        tiers: service.tiers
          .slice()
          .sort((a, b) => order[a.seniority] - order[b.seniority])
          .map((t) => ({ seniority: t.seniority, priceCents: t.priceCents, durationMin: t.durationMin })),
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to list services');
    }
  }
}
