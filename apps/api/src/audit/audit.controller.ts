import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';

export interface ServiceChangeRow {
  id: string;
  at: string;
  barberName: string;
  clientName: string;
  locationName: string;
  action: string;
  serviceName: string;
  priceCents: number;
  minutes: number;
  overlapAccepted: boolean;
  acknowledged: boolean;
}

export interface BookingAuditRow {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: string;
  clientName: string;
  barberName: string | null;
  locationName: string;
  serviceNames: string[];
  serviceChanged: boolean;
  paymentChannel: string | null;
  notes: string | null;
}

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every mid-appointment service change a barber has made — the anti-theft
   * feed and the upsell report are two views of the same log.
   */
  @Get('service-changes')
  async serviceChanges(@Query('unacknowledged') unacknowledged?: string): Promise<ServiceChangeRow[]> {
    try {
      const rows = await this.prisma.serviceChangeLog.findMany({
        where: unacknowledged === 'true' ? { acknowledged: false } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
          appointment: {
            select: {
              customer: { select: { firstName: true, lastName: true } },
              location: { select: { name: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        barberName: fullName(r.changedBy.firstName, r.changedBy.lastName),
        clientName: fullName(r.appointment.customer.firstName, r.appointment.customer.lastName),
        locationName: r.appointment.location.name,
        action: r.action,
        serviceName: r.serviceName,
        priceCents: r.priceCents,
        minutes: r.minutes,
        overlapAccepted: r.overlapAccepted,
        acknowledged: r.acknowledged,
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load service changes');
    }
  }

  /** Mark a change notification as seen. */
  @Patch('service-changes/:id/ack')
  async acknowledge(@Param('id') id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.serviceChangeLog.update({ where: { id }, data: { acknowledged: true } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to acknowledge the change');
    }
  }

  /**
   * Booking overview audit for a day: where each booking came from, what was
   * actually delivered (grouped per visit), whether it changed mid-appointment,
   * and how it was paid.
   */
  @Get('bookings')
  async bookings(
    @Query('date') date?: string,
    @Query('locationId') locationId?: string,
  ): Promise<BookingAuditRow[]> {
    try {
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const appts = await this.prisma.appointment.findMany({
        where: {
          startsAt: { gte: dayStart, lt: dayEnd },
          ...(locationId ? { locationId } : {}),
        },
        orderBy: { startsAt: 'asc' },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          barber: { select: { firstName: true, lastName: true } },
          location: { select: { name: true } },
          service: { select: { name: true } },
          transaction: { select: { channel: true } },
          serviceChanges: { select: { id: true } },
        },
      });
      // Collapse linked segments (combo / added services) into one visit row.
      const byVisit = new Map<string, BookingAuditRow>();
      for (const a of appts) {
        const key = a.comboGroupId ?? a.id;
        const existing = byVisit.get(key);
        if (existing) {
          existing.serviceNames.push(a.service.name);
          existing.serviceChanged = existing.serviceChanged || a.serviceChanges.length > 0;
          const end = a.endsAt.toISOString();
          if (end > existing.endsAt) existing.endsAt = end;
          if (!existing.paymentChannel && a.transaction) existing.paymentChannel = a.transaction.channel;
        } else {
          byVisit.set(key, {
            appointmentId: a.id,
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            status: a.status,
            source: a.source,
            clientName: fullName(a.customer.firstName, a.customer.lastName),
            barberName: a.barber ? fullName(a.barber.firstName, a.barber.lastName) : null,
            locationName: a.location.name,
            serviceNames: [a.service.name],
            serviceChanged: a.serviceChanges.length > 0,
            paymentChannel: a.transaction?.channel ?? null,
            notes: a.notes,
          });
        }
      }
      return [...byVisit.values()];
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load the bookings audit');
    }
  }
}
