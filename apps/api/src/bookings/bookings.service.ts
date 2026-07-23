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
  Prisma,
  ResourceKind,
  Role,
  Service,
  ServiceKind,
} from '@ta-spiru/database';
import { COMBO_WASH_BUFFER_MIN, ComboSlot, SLOT_STEP_MIN } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComboBookingDto } from './dto/create-combo-booking.dto';
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

      const [barbers, resources, appointments] = await Promise.all([
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
            barber.shifts.some((shift) => shift.startsAt <= cursor && shift.endsAt >= cutEnd),
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
          barberName: `${freeBarber.firstName} ${freeBarber.lastName}`,
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
      const cutEnd = addMinutes(startsAt, barberService.durationMin);
      const washEnd = addMinutes(startsAt, washService.durationMin);
      const bayLockEnd = addMinutes(
        startsAt,
        Math.max(washService.durationMin, barberService.durationMin + COMBO_WASH_BUFFER_MIN),
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

  private pickService(services: readonly Service[], serviceId: string, kind: ServiceKind): Service {
    const service = services.find((entry) => entry.id === serviceId && entry.kind === kind);
    if (!service) {
      throw new BadRequestException(`Service ${serviceId} is not an active ${kind} service`);
    }
    return service;
  }
}
