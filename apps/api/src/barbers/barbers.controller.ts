import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, ServiceKind } from '@ta-spiru/database';
import { UpsertBarberServiceDto } from '../services/dto/services-admin.dtos';
import {
  resolveServicePricing,
  type BarberScheduleRow,
  type BarberServiceSummary,
  type BarberSummary,
  type SeniorityName,
} from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signed-in barber's own day. Strict privacy: returns only the client's
   * name and the requested services — no contact details, notes, price or
   * vehicle. Grouped by visit so a combo/added services read as one client.
   */
  @Get('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARBER)
  async mySchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ): Promise<BarberScheduleRow[]> {
    try {
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const appts = await this.prisma.appointment.findMany({
        where: { barberId: user.id, startsAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          comboGroupId: true,
          startsAt: true,
          endsAt: true,
          status: true,
          customer: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
      });
      const byVisit = new Map<string, BarberScheduleRow>();
      for (const a of appts) {
        const key = a.comboGroupId ?? a.id;
        const existing = byVisit.get(key);
        if (existing) {
          existing.services.push(a.service.name);
          const end = a.endsAt.toISOString();
          if (end > existing.endsAt) existing.endsAt = end;
        } else {
          byVisit.set(key, {
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            status: a.status,
            clientName: fullName(a.customer.firstName, a.customer.lastName),
            services: [a.service.name],
          });
        }
      }
      return [...byVisit.values()];
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load schedule');
    }
  }

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

  /** Set a barber's override for a service: enable/disable, price, duration, daily cap. */
  @Put(':barberId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async upsertOverride(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpsertBarberServiceDto,
  ): Promise<{ ok: true }> {
    try {
      const [barber, service] = await Promise.all([
        this.prisma.user.findFirst({ where: { id: barberId, role: Role.BARBER }, select: { id: true } }),
        this.prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } }),
      ]);
      if (!barber) throw new NotFoundException('Barber not found');
      if (!service) throw new NotFoundException('Service not found');
      await this.prisma.teamMemberService.upsert({
        where: { userId_serviceId: { userId: barberId, serviceId } },
        update: {
          ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
          ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
          ...(dto.maxDaily !== undefined ? { maxDaily: dto.maxDaily } : {}),
        },
        create: {
          userId: barberId,
          serviceId,
          isEnabled: dto.isEnabled ?? true,
          priceCents: dto.priceCents ?? null,
          durationMin: dto.durationMin ?? null,
          maxDaily: dto.maxDaily ?? null,
        },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to save barber service override');
    }
  }

  /** Clear a barber's override for a service (reverts to the seniority tier). */
  @Delete(':barberId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async removeOverride(
    @Param('barberId') barberId: string,
    @Param('serviceId') serviceId: string,
  ): Promise<{ ok: true }> {
    try {
      await this.prisma.teamMemberService.deleteMany({ where: { userId: barberId, serviceId } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove barber service override');
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
