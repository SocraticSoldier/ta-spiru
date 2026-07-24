import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Appointment,
  AppointmentStatus,
  BookingSource,
  Prisma,
  ResourceKind,
  Role,
  Service,
  ServiceKind,
} from '@ta-spiru/database';
import {
  AppointmentRow,
  AvailabilitySlot,
  COMBO_WASH_BUFFER_MIN,
  ComboSlot,
  MyBookingRow,
  resolveServicePricing,
  SLOT_STEP_MIN,
  type SeniorityName,
} from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { fullName } from '../common/name.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateComboBookingDto } from './dto/create-combo-booking.dto';
import { DayScheduleQueryDto, FindAvailabilityDto } from './dto/find-availability.dto';
import { FindComboAvailabilityDto } from './dto/find-combo-availability.dto';
import { addMinutes, overlaps, zonedTimeToUtc } from './utils/time.util';

const ACTIVE_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

type DayAppointment = Pick<Appointment, 'barberId' | 'resourceId' | 'startsAt' | 'endsAt' | 'lockedUntil'>;

export interface ComboBookingResult {
  comboGroupId: string;
  barberAppointmentId: string;
  washAppointmentId: string;
  startsAt: string;
  washBayLockedUntil: string;
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the price, duration and daily cap for a barber service as offered by
   * a specific barber (seniority tier + per-member override). Throws if the
   * barber has disabled the service.
   */
  private async resolveBarberPricing(
    service: Pick<Service, 'id' | 'priceCents' | 'durationMin'>,
    barberId: string,
  ): Promise<{ priceCents: number; durationMin: number; maxDaily: number | null }> {
    const [barber, tiers, override] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: barberId }, select: { seniority: true } }),
      this.prisma.serviceTier.findMany({ where: { serviceId: service.id } }),
      this.prisma.teamMemberService.findUnique({
        where: { userId_serviceId: { userId: barberId, serviceId: service.id } },
      }),
    ]);
    const resolved = resolveServicePricing(
      { priceCents: service.priceCents, durationMin: service.durationMin },
      tiers.map((t) => ({
        seniority: t.seniority as SeniorityName,
        priceCents: t.priceCents,
        durationMin: t.durationMin,
      })),
      (barber?.seniority as SeniorityName) ?? null,
      override,
    );
    if (!resolved) {
      throw new BadRequestException('This barber does not offer the selected service');
    }
    return resolved;
  }

  /** Refuse the booking once a barber hits their per-day cap for a service. */
  private async assertDailyCap(
    tx: Prisma.TransactionClient,
    barberId: string,
    serviceId: string,
    startsAt: Date,
    maxDaily: number | null,
  ): Promise<void> {
    if (maxDaily == null) return;
    const dayStart = new Date(
      Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()),
    );
    const dayEnd = addMinutes(dayStart, 24 * 60);
    const count = await tx.appointment.count({
      where: {
        barberId,
        serviceId,
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (count >= maxDaily) {
      throw new ConflictException('This barber has reached the daily limit for this service');
    }
  }

  /**
   * Finds every slot where a barber (with chair capacity) and a wash bay are
   * simultaneously free. The bay is held for the barber appointment duration
   * plus the combo buffer; a wash service that outlasts that window extends
   * the hold instead of truncating the wash.
   */
  async findComboAvailability(query: FindComboAvailabilityDto): Promise<ComboSlot[]> {
    const { locationId, date, barberServiceId, washServiceId } = query;
    try {
      const [location, services] = await Promise.all([
        this.prisma.location.findUnique({
          where: { id: locationId },
          include: { openingHours: true },
        }),
        this.prisma.service.findMany({
          where: { id: { in: [barberServiceId, washServiceId] }, isActive: true },
        }),
      ]);
      if (!location || !location.isActive) {
        throw new NotFoundException(`Location ${locationId} not found`);
      }

      const barberService = this.pickService(services, barberServiceId, ServiceKind.BARBER);
      const washService = this.pickService(services, washServiceId, ServiceKind.WASH);

      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
      const hours = location.openingHours.find((entry) => entry.weekday === weekday);
      if (!hours) {
        return [];
      }
      const open = zonedTimeToUtc(date, hours.opensAt, location.timezone);
      const close = zonedTimeToUtc(date, hours.closesAt, location.timezone);

      const bayLockMin = Math.max(
        washService.durationMin,
        barberService.durationMin + COMBO_WASH_BUFFER_MIN,
      );

      const [barbers, resources, appointments, blocks] = await Promise.all([
        this.prisma.user.findMany({
          where: { role: Role.BARBER, locationId, isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            shifts: {
              where: { startsAt: { lt: close }, endsAt: { gt: open } },
              select: { startsAt: true, endsAt: true },
            },
          },
        }),
        this.prisma.resource.findMany({
          where: { locationId, isActive: true },
          select: { id: true, kind: true, name: true },
        }),
        this.prisma.appointment.findMany({
          where: {
            locationId,
            status: { in: [...ACTIVE_STATUSES] },
            startsAt: { lt: close },
            lockedUntil: { gt: open },
          },
          select: { barberId: true, resourceId: true, startsAt: true, endsAt: true, lockedUntil: true },
        }),
        this.prisma.timeBlock.findMany({
          where: { locationId, startsAt: { lt: close }, endsAt: { gt: open } },
          select: { barberId: true, startsAt: true, endsAt: true },
        }),
      ]);

      const chairs = resources.filter((resource) => resource.kind === ResourceKind.BARBER_CHAIR);
      const bays = resources.filter((resource) => resource.kind === ResourceKind.WASH_BAY);
      if (barbers.length === 0 || bays.length === 0) {
        return [];
      }

      const slots: ComboSlot[] = [];
      for (
        let cursor = open;
        addMinutes(cursor, bayLockMin) <= close;
        cursor = addMinutes(cursor, SLOT_STEP_MIN)
      ) {
        const cutEnd = addMinutes(cursor, barberService.durationMin);
        const bayLockEnd = addMinutes(cursor, bayLockMin);

        if (
          blocks.some(
            (block) => block.barberId === null && overlaps(block.startsAt, block.endsAt, cursor, bayLockEnd),
          )
        ) {
          continue;
        }

        const busyBarberIds = new Set(
          appointments
            .filter(
              (appointment) =>
                appointment.barberId !== null &&
                overlaps(appointment.startsAt, appointment.endsAt, cursor, cutEnd),
            )
            .map((appointment) => appointment.barberId as string),
        );
        if (busyBarberIds.size >= chairs.length && chairs.length > 0) {
          continue;
        }

        const freeBarber = barbers.find(
          (barber) =>
            !busyBarberIds.has(barber.id) &&
            barber.shifts.some((shift) => shift.startsAt <= cursor && shift.endsAt >= cutEnd) &&
            !blocks.some(
              (block) =>
                block.barberId === barber.id && overlaps(block.startsAt, block.endsAt, cursor, cutEnd),
            ),
        );
        if (!freeBarber) {
          continue;
        }

        const freeBay = bays.find(
          (bay) =>
            !appointments.some(
              (appointment) =>
                appointment.resourceId === bay.id &&
                overlaps(appointment.startsAt, appointment.lockedUntil, cursor, bayLockEnd),
            ),
        );
        if (!freeBay) {
          continue;
        }

        slots.push({
          startsAt: cursor.toISOString(),
          barberEndsAt: cutEnd.toISOString(),
          washBayLockedUntil: bayLockEnd.toISOString(),
          barberId: freeBarber.id,
          barberName: fullName(freeBarber.firstName, freeBarber.lastName),
          washBayId: freeBay.id,
          washBayName: freeBay.name,
        });
      }

      return slots;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to compute combo availability');
    }
  }

  /**
   * Books both combo segments atomically, re-validating the barber and bay
   * holds inside a serializable transaction so two customers cannot claim the
   * same capacity.
   */
  async createComboBooking(dto: CreateComboBookingDto, customerId: string): Promise<ComboBookingResult> {
    try {
      const services = await this.prisma.service.findMany({
        where: { id: { in: [dto.barberServiceId, dto.washServiceId] }, isActive: true },
      });
      const barberService = this.pickService(services, dto.barberServiceId, ServiceKind.BARBER);
      const washService = this.pickService(services, dto.washServiceId, ServiceKind.WASH);

      const startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
        throw new BadRequestException('startsAt must be a future ISO-8601 timestamp');
      }
      // Barber segment priced & timed for this barber; wash segment is flat.
      const barberPricing = await this.resolveBarberPricing(barberService, dto.barberId);
      const cutEnd = addMinutes(startsAt, barberPricing.durationMin);
      const washEnd = addMinutes(startsAt, washService.durationMin);
      const bayLockEnd = addMinutes(
        startsAt,
        Math.max(washService.durationMin, barberPricing.durationMin + COMBO_WASH_BUFFER_MIN),
      );

      const [barber, bay] = await Promise.all([
        this.prisma.user.findFirst({
          where: { id: dto.barberId, role: Role.BARBER, locationId: dto.locationId, isActive: true },
          select: { id: true },
        }),
        this.prisma.resource.findFirst({
          where: {
            id: dto.washBayId,
            locationId: dto.locationId,
            kind: ResourceKind.WASH_BAY,
            isActive: true,
          },
          select: { id: true },
        }),
      ]);
      if (!barber) {
        throw new NotFoundException(`Barber ${dto.barberId} not found at location ${dto.locationId}`);
      }
      if (!bay) {
        throw new NotFoundException(`Wash bay ${dto.washBayId} not found at location ${dto.locationId}`);
      }

      const comboGroupId = randomUUID();
      const [barberAppointment, washAppointment] = await this.prisma.$transaction(
        async (tx) => {
          const blockConflict = await tx.timeBlock.findFirst({
            where: {
              locationId: dto.locationId,
              startsAt: { lt: bayLockEnd },
              endsAt: { gt: startsAt },
              OR: [{ barberId: null }, { barberId: dto.barberId }],
            },
            select: { id: true },
          });
          if (blockConflict) {
            throw new ConflictException('This time is blocked out at the selected branch');
          }

          await this.assertDailyCap(tx, dto.barberId, barberService.id, startsAt, barberPricing.maxDaily);

          const barberConflict = await tx.appointment.findFirst({
            where: {
              barberId: dto.barberId,
              status: { in: [...ACTIVE_STATUSES] },
              startsAt: { lt: cutEnd },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });
          if (barberConflict) {
            throw new ConflictException('Selected barber is no longer available for this slot');
          }

          const bayConflict = await tx.appointment.findFirst({
            where: {
              resourceId: dto.washBayId,
              status: { in: [...ACTIVE_STATUSES] },
              startsAt: { lt: bayLockEnd },
              lockedUntil: { gt: startsAt },
            },
            select: { id: true },
          });
          if (bayConflict) {
            throw new ConflictException('Selected wash bay is no longer available for this slot');
          }

          const createdBarberAppointment = await tx.appointment.create({
            data: {
              locationId: dto.locationId,
              customerId,
              serviceId: barberService.id,
              barberId: dto.barberId,
              startsAt,
              endsAt: cutEnd,
              lockedUntil: cutEnd,
              priceCentsSnapshot: barberPricing.priceCents,
              comboGroupId,
              notes: dto.notes ?? null,
            },
          });
          const createdWashAppointment = await tx.appointment.create({
            data: {
              locationId: dto.locationId,
              customerId,
              serviceId: washService.id,
              resourceId: dto.washBayId,
              startsAt,
              endsAt: washEnd,
              lockedUntil: bayLockEnd,
              priceCentsSnapshot: washService.priceCents,
              comboGroupId,
              vehicleReg: dto.vehicleReg ?? null,
            },
          });
          return [createdBarberAppointment, createdWashAppointment] as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        comboGroupId,
        barberAppointmentId: barberAppointment.id,
        washAppointmentId: washAppointment.id,
        startsAt: startsAt.toISOString(),
        washBayLockedUntil: bayLockEnd.toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create combo booking');
    }
  }

  /** Independent (non-combo) availability for a single barber or wash service. */
  async findAvailability(query: FindAvailabilityDto): Promise<AvailabilitySlot[]> {
    try {
      const window = await this.getOpenWindow(query.locationId, query.date);
      if (!window) {
        return [];
      }
      const { open, close } = window;

      const service = await this.prisma.service.findFirst({
        where: { id: query.serviceId, isActive: true },
      });
      if (!service) {
        throw new BadRequestException(`Service ${query.serviceId} not found or inactive`);
      }

      const [barbers, resources, appointments, blocks] = await Promise.all([
        service.kind === ServiceKind.BARBER
          ? this.prisma.user.findMany({
              where: { role: Role.BARBER, locationId: query.locationId, isActive: true },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                shifts: {
                  where: { startsAt: { lt: close }, endsAt: { gt: open } },
                  select: { startsAt: true, endsAt: true },
                },
              },
            })
          : Promise.resolve([]),
        this.prisma.resource.findMany({
          where: { locationId: query.locationId, isActive: true },
          select: { id: true, kind: true, name: true },
        }),
        this.prisma.appointment.findMany({
          where: {
            locationId: query.locationId,
            status: { in: [...ACTIVE_STATUSES] },
            startsAt: { lt: close },
            lockedUntil: { gt: open },
          },
          select: { barberId: true, resourceId: true, startsAt: true, endsAt: true, lockedUntil: true },
        }),
        this.prisma.timeBlock.findMany({
          where: { locationId: query.locationId, startsAt: { lt: close }, endsAt: { gt: open } },
          select: { barberId: true, startsAt: true, endsAt: true },
        }),
      ]);

      const chairs = resources.filter((resource) => resource.kind === ResourceKind.BARBER_CHAIR);
      const bays = resources.filter((resource) => resource.kind === ResourceKind.WASH_BAY);
      const slots: AvailabilitySlot[] = [];

      for (
        let cursor = open;
        addMinutes(cursor, service.durationMin) <= close;
        cursor = addMinutes(cursor, SLOT_STEP_MIN)
      ) {
        const slotEnd = addMinutes(cursor, service.durationMin);

        if (
          blocks.some(
            (block) => block.barberId === null && overlaps(block.startsAt, block.endsAt, cursor, slotEnd),
          )
        ) {
          continue;
        }

        if (service.kind === ServiceKind.BARBER) {
          const busyBarberIds = new Set(
            appointments
              .filter(
                (appointment) =>
                  appointment.barberId !== null &&
                  overlaps(appointment.startsAt, appointment.endsAt, cursor, slotEnd),
              )
              .map((appointment) => appointment.barberId as string),
          );
          if (chairs.length > 0 && busyBarberIds.size >= chairs.length) {
            continue;
          }
          const freeBarber = barbers.find(
            (barber) =>
              !busyBarberIds.has(barber.id) &&
              barber.shifts.some((shift) => shift.startsAt <= cursor && shift.endsAt >= slotEnd) &&
              !blocks.some(
                (block) =>
                  block.barberId === barber.id && overlaps(block.startsAt, block.endsAt, cursor, slotEnd),
              ),
          );
          if (!freeBarber) {
            continue;
          }
          slots.push({
            startsAt: cursor.toISOString(),
            endsAt: slotEnd.toISOString(),
            barberId: freeBarber.id,
            barberName: fullName(freeBarber.firstName, freeBarber.lastName),
            resourceId: null,
            resourceName: null,
          });
        } else {
          const freeBay = bays.find(
            (bay) =>
              !appointments.some(
                (appointment) =>
                  appointment.resourceId === bay.id &&
                  overlaps(appointment.startsAt, appointment.lockedUntil, cursor, slotEnd),
              ),
          );
          if (!freeBay) {
            continue;
          }
          slots.push({
            startsAt: cursor.toISOString(),
            endsAt: slotEnd.toISOString(),
            barberId: null,
            barberName: null,
            resourceId: freeBay.id,
            resourceName: freeBay.name,
          });
        }
      }

      return slots;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to compute availability');
    }
  }

  /** Books a single (non-combo) barber or wash appointment with a serializable conflict re-check. */
  async createBooking(
    dto: CreateBookingDto,
    actorId: string,
    actorRole: Role = Role.CUSTOMER,
  ): Promise<AppointmentRow> {
    try {
      // Staff book on behalf of a customer; the origin is stamped for the audit.
      const isStaff = actorRole !== Role.CUSTOMER;
      const customerId = isStaff && dto.customerId ? dto.customerId : actorId;
      const source =
        actorRole === Role.BARBER || actorRole === Role.WASH_ATTENDANT
          ? BookingSource.WALK_IN
          : isStaff
            ? BookingSource.RECEPTION
            : BookingSource.ONLINE;
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, isActive: true },
      });
      if (!service) {
        throw new BadRequestException(`Service ${dto.serviceId} not found or inactive`);
      }
      if (service.kind === ServiceKind.BARBER && !dto.barberId) {
        throw new BadRequestException('barberId is required for barber services');
      }
      if (service.kind === ServiceKind.WASH && !dto.washBayId) {
        throw new BadRequestException('washBayId is required for wash services');
      }

      const startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
        throw new BadRequestException('startsAt must be a future ISO-8601 timestamp');
      }

      // Resolve price & duration for this barber (seniority tier + override).
      let priceCents = service.priceCents;
      let durationMin = service.durationMin;
      let maxDaily: number | null = null;
      if (service.kind === ServiceKind.BARBER && dto.barberId) {
        const resolved = await this.resolveBarberPricing(service, dto.barberId);
        priceCents = resolved.priceCents;
        durationMin = resolved.durationMin;
        maxDaily = resolved.maxDaily;
      }
      const endsAt = addMinutes(startsAt, durationMin);

      const appointment = await this.prisma.$transaction(
        async (tx) => {
          const blockConflict = await tx.timeBlock.findFirst({
            where: {
              locationId: dto.locationId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
              OR:
                service.kind === ServiceKind.BARBER
                  ? [{ barberId: null }, { barberId: dto.barberId }]
                  : [{ barberId: null }],
            },
            select: { id: true },
          });
          if (blockConflict) {
            throw new ConflictException('This time is blocked out at the selected branch');
          }

          if (service.kind === ServiceKind.BARBER) {
            await this.assertDailyCap(tx, dto.barberId as string, service.id, startsAt, maxDaily);
            const conflict = await tx.appointment.findFirst({
              where: {
                barberId: dto.barberId,
                status: { in: [...ACTIVE_STATUSES] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
              select: { id: true },
            });
            if (conflict) {
              throw new ConflictException('Selected barber is no longer available for this slot');
            }
          } else {
            const conflict = await tx.appointment.findFirst({
              where: {
                resourceId: dto.washBayId,
                status: { in: [...ACTIVE_STATUSES] },
                startsAt: { lt: endsAt },
                lockedUntil: { gt: startsAt },
              },
              select: { id: true },
            });
            if (conflict) {
              throw new ConflictException('Selected wash bay is no longer available for this slot');
            }
          }

          return tx.appointment.create({
            data: {
              locationId: dto.locationId,
              customerId,
              serviceId: service.id,
              barberId: service.kind === ServiceKind.BARBER ? dto.barberId : null,
              resourceId: service.kind === ServiceKind.WASH ? dto.washBayId : null,
              startsAt,
              endsAt,
              lockedUntil: endsAt,
              priceCentsSnapshot: priceCents,
              source,
              vehicleReg: dto.vehicleReg ?? null,
              notes: dto.notes ?? null,
            },
            include: {
              customer: { select: { firstName: true, lastName: true } },
              service: { select: { name: true, kind: true } },
              barber: { select: { firstName: true, lastName: true } },
              resource: { select: { name: true } },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
        customerName: fullName(appointment.customer.firstName, appointment.customer.lastName),
        serviceName: appointment.service.name,
        serviceKind: appointment.service.kind,
        barberName: appointment.barber
          ? fullName(appointment.barber.firstName, appointment.barber.lastName)
          : null,
        resourceName: appointment.resource?.name ?? null,
        comboGroupId: appointment.comboGroupId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  /** Master calendar feed: every appointment in a branch's local day. */
  async daySchedule(query: DayScheduleQueryDto): Promise<AppointmentRow[]> {
    try {
      const window = await this.getOpenWindow(query.locationId, query.date, true);
      if (!window) {
        return [];
      }
      const appointments = await this.prisma.appointment.findMany({
        where: {
          locationId: query.locationId,
          startsAt: { lt: window.close },
          endsAt: { gt: window.open },
        },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          service: { select: { name: true, kind: true } },
          barber: { select: { firstName: true, lastName: true } },
          resource: { select: { name: true } },
        },
        orderBy: { startsAt: 'asc' },
      });

      return appointments.map((appointment) => ({
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
        customerName: fullName(appointment.customer.firstName, appointment.customer.lastName),
        serviceName: appointment.service.name,
        serviceKind: appointment.service.kind,
        barberName: appointment.barber
          ? fullName(appointment.barber.firstName, appointment.barber.lastName)
          : null,
        resourceName: appointment.resource?.name ?? null,
        comboGroupId: appointment.comboGroupId,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to load day schedule');
    }
  }

  /** A customer's own bookings, newest first. */
  async myBookings(customerId: string): Promise<MyBookingRow[]> {
    try {
      const appointments = await this.prisma.appointment.findMany({
        where: { customerId },
        include: {
          location: { select: { name: true } },
          service: { select: { name: true, kind: true, priceCents: true } },
          barber: { select: { firstName: true, lastName: true } },
          resource: { select: { name: true } },
        },
        orderBy: { startsAt: 'desc' },
        take: 50,
      });
      return appointments.map((appointment) => ({
        id: appointment.id,
        comboGroupId: appointment.comboGroupId,
        locationName: appointment.location.name,
        serviceName: appointment.service.name,
        serviceKind: appointment.service.kind,
        priceCents: appointment.priceCentsSnapshot ?? appointment.service.priceCents,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
        barberName: appointment.barber
          ? fullName(appointment.barber.firstName, appointment.barber.lastName)
          : null,
        resourceName: appointment.resource?.name ?? null,
        vehicleReg: appointment.vehicleReg,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to load bookings');
    }
  }

  /** Cancels a customer's future booking; a combo cancels both segments. */
  async cancelBooking(appointmentId: string, customerId: string): Promise<{ cancelled: number }> {
    try {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: appointmentId, customerId },
        select: { id: true, status: true, startsAt: true, comboGroupId: true },
      });
      if (!appointment) {
        throw new NotFoundException(`Booking ${appointmentId} not found`);
      }
      if (appointment.startsAt <= new Date()) {
        throw new BadRequestException('Past bookings cannot be cancelled');
      }
      const cancellable: AppointmentStatus[] = [
        AppointmentStatus.PENDING_PAYMENT,
        AppointmentStatus.CONFIRMED,
      ];
      if (!cancellable.includes(appointment.status)) {
        throw new ConflictException(`A ${appointment.status} booking cannot be cancelled`);
      }

      const result = await this.prisma.appointment.updateMany({
        where: appointment.comboGroupId
          ? { comboGroupId: appointment.comboGroupId, customerId }
          : { id: appointment.id },
        data: { status: AppointmentStatus.CANCELLED },
      });
      return { cancelled: result.count };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to cancel booking');
    }
  }

  /**
   * Resolves a branch's opening window for a local date, in UTC. Returns null
   * when the branch is closed; `fullDay` widens to the whole local day so the
   * calendar also shows out-of-hours records.
   */
  private async getOpenWindow(
    locationId: string,
    date: string,
    fullDay = false,
  ): Promise<{ open: Date; close: Date } | null> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { openingHours: true },
    });
    if (!location || !location.isActive) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    if (fullDay) {
      return {
        open: zonedTimeToUtc(date, '00:00', location.timezone),
        close: addMinutes(zonedTimeToUtc(date, '23:59', location.timezone), 1),
      };
    }
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const hours = location.openingHours.find((entry) => entry.weekday === weekday);
    if (!hours) {
      return null;
    }
    return {
      open: zonedTimeToUtc(date, hours.opensAt, location.timezone),
      close: zonedTimeToUtc(date, hours.closesAt, location.timezone),
    };
  }

  /**
   * Kiosk/reception status change: being served, checked in, no-show, late, …
   * Staff can set any appointment at their branch; a barber only their own.
   */
  async setStatus(
    appointmentId: string,
    status: AppointmentStatus,
    actor: { id: string; role: Role },
  ): Promise<{ id: string; status: AppointmentStatus }> {
    try {
      const allowed: AppointmentStatus[] = [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
        AppointmentStatus.LATE,
      ];
      if (!allowed.includes(status)) {
        throw new BadRequestException(`Status ${status} cannot be set from the kiosk`);
      }
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, barberId: true },
      });
      if (!appointment) {
        throw new NotFoundException(`Booking ${appointmentId} not found`);
      }
      if (actor.role === Role.BARBER && appointment.barberId !== actor.id) {
        throw new NotFoundException(`Booking ${appointmentId} not found`);
      }
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status },
        select: { id: true, status: true },
      });
      return updated;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update the booking status');
    }
  }

  /**
   * A barber adds a service to a client already in the chair. The extra service
   * becomes a linked appointment in the same visit (shared comboGroupId) starting
   * where the current one ends, priced for this barber, and every change is
   * logged for the admin dashboard. If the added time runs into the barber's
   * next booking, the first attempt is refused with OVERLAP_CONFIRM_REQUIRED —
   * retrying with acceptOverlap=true is the barber accepting responsibility.
   */
  async addServiceMidAppointment(
    appointmentId: string,
    dto: { serviceId: string; acceptOverlap?: boolean },
    barberId: string,
  ): Promise<{ visitGroupId: string; addedAppointmentId: string; endsAt: string; overlapAccepted: boolean }> {
    try {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          barberId,
          status: { in: [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS, AppointmentStatus.CONFIRMED] },
        },
      });
      if (!appointment) {
        throw new NotFoundException(`Booking ${appointmentId} not found for this barber`);
      }
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, kind: ServiceKind.BARBER, isActive: true },
      });
      if (!service) {
        throw new BadRequestException('Service not found or not a barber service');
      }
      const pricing = await this.resolveBarberPricing(service, barberId);

      // The visit currently ends where its last linked segment ends.
      const visitGroupId = appointment.comboGroupId ?? randomUUID();
      const visitEnd = appointment.comboGroupId
        ? (
            await this.prisma.appointment.aggregate({
              where: { comboGroupId: visitGroupId, barberId },
              _max: { endsAt: true },
            })
          )._max.endsAt ?? appointment.endsAt
        : appointment.endsAt;
      const addedEnd = addMinutes(visitEnd, pricing.durationMin);

      // Does the extra time eat into the barber's next active booking?
      const nextBooking = await this.prisma.appointment.findFirst({
        where: {
          barberId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { gte: visitEnd, lt: addedEnd },
          // NB: a plain NOT{comboGroupId} would skip NULL rows (SQL null semantics)
          OR: [{ comboGroupId: null }, { comboGroupId: { not: visitGroupId } }],
          id: { not: appointment.id },
        },
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true },
      });
      if (nextBooking && !dto.acceptOverlap) {
        throw new ConflictException({
          code: 'OVERLAP_CONFIRM_REQUIRED',
          message:
            'Adding this service runs into your next booking. Accepting it makes keeping the next client on time your responsibility.',
          nextBookingAt: nextBooking.startsAt.toISOString(),
        });
      }

      const [added] = await this.prisma.$transaction([
        this.prisma.appointment.create({
          data: {
            locationId: appointment.locationId,
            customerId: appointment.customerId,
            serviceId: service.id,
            barberId,
            startsAt: visitEnd,
            endsAt: addedEnd,
            lockedUntil: addedEnd,
            status: appointment.status,
            priceCentsSnapshot: pricing.priceCents,
            source: BookingSource.WALK_IN,
            comboGroupId: visitGroupId,
          },
          select: { id: true, endsAt: true },
        }),
        this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { comboGroupId: visitGroupId },
        }),
        this.prisma.serviceChangeLog.create({
          data: {
            appointmentId: appointment.id,
            changedById: barberId,
            action: 'ADDED',
            serviceName: service.name,
            priceCents: pricing.priceCents,
            minutes: pricing.durationMin,
            overlapAccepted: Boolean(nextBooking && dto.acceptOverlap),
          },
        }),
      ]);
      return {
        visitGroupId,
        addedAppointmentId: added.id,
        endsAt: added.endsAt.toISOString(),
        overlapAccepted: Boolean(nextBooking && dto.acceptOverlap),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add the service');
    }
  }

  private pickService(services: readonly Service[], serviceId: string, kind: ServiceKind): Service {
    const service = services.find((entry) => entry.id === serviceId && entry.kind === kind);
    if (!service) {
      throw new BadRequestException(`Service ${serviceId} is not an active ${kind} service`);
    }
    return service;
  }
}
