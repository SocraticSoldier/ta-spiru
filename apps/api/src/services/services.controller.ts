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
        orderBy: [{ kind: 'asc' }, { priceCents: 'asc' }],
      });
      return services.map((service) => ({
        id: service.id,
        slug: service.slug,
        name: service.name,
        kind: service.kind,
        durationMin: service.durationMin,
        priceCents: service.priceCents,
        isComboEligible: service.isComboEligible,
        isQuoteOnly: service.isQuoteOnly,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to list services');
    }
  }
}
