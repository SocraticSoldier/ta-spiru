import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Role, ServiceKind } from '@ta-spiru/database';
import {
  resolveServicePricing,
  type BarberServiceSummary,
  type BarberSummary,
  type SeniorityName,
} from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Barbers at a location, ordered by station — powers the barber-first booking screen. */
  @Get()
  async list(@Query('locationId') locationId?: string): Promise<BarberSummary[]> {
    try {
      const barbers = await this.prisma.user.findMany({
        where: {
          role: Role.BARBER,
          isActive: true,
          ...(locationId ? { locationId } : {}),
        },
        orderBy: [{ stationNo: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          seniority: true,
          stationNo: true,
          photoUrl: true,
        },
      });
      return barbers.map((b) => ({
        id: b.id,
        firstName: b.firstName,
        lastName: b.lastName,
        seniority: (b.seniority as SeniorityName) ?? null,
        stationNo: b.stationNo,
        photoUrl: b.photoUrl,
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list barbers');
    }
  }

  /** The services a specific barber offers, with price and duration resolved for them. */
  @Get(':id/services')
  async services(@Param('id') id: string): Promise<BarberServiceSummary[]> {
    try {
      const barber = await this.prisma.user.findFirst({
        where: { id, role: Role.BARBER },
        select: { id: true, seniority: true, locationId: true },
      });
      if (!barber) throw new NotFoundException('Barber not found');

      const seniority = (barber.seniority as SeniorityName) ?? null;
      const [services, overrides] = await Promise.all([
        this.prisma.service.findMany({
          where: {
            kind: ServiceKind.BARBER,
            isActive: true,
            ...(barber.locationId
              ? { locations: { some: { locationId: barber.locationId, isActive: true } } }
              : {}),
          },
          orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
          include: { tiers: true },
        }),
        this.prisma.teamMemberService.findMany({ where: { userId: barber.id } }),
      ]);
      const overrideBy = new Map(overrides.map((o) => [o.serviceId, o]));

      const out: BarberServiceSummary[] = [];
      for (const svc of services) {
        const resolved = resolveServicePricing(
          { priceCents: svc.priceCents, durationMin: svc.durationMin },
          svc.tiers.map((t) => ({
            seniority: t.seniority as SeniorityName,
            priceCents: t.priceCents,
            durationMin: t.durationMin,
          })),
          seniority,
          overrideBy.get(svc.id) ?? null,
        );
        if (!resolved) continue; // barber disabled this service
        out.push({
          serviceId: svc.id,
          slug: svc.slug,
          name: svc.name,
          kind: svc.kind,
          priceCents: resolved.priceCents,
          durationMin: resolved.durationMin,
          maxDaily: resolved.maxDaily,
          isComboEligible: svc.isComboEligible,
        });
      }
      return out;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list barber services');
    }
  }
}
