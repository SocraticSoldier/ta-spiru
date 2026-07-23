import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  QueueEntry,
  QueueStatus,
  ResourceKind,
  Role,
  Service,
  ServiceKind,
} from '@ta-spiru/database';
import {
  JoinQueueResponse,
  QueueEntryView,
  QueueSnapshot,
  QueueUpdatedEvent,
  UpsellSuggestion,
} from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_CHANNEL, RedisService } from '../redis/redis.service';
import { JoinQueueDto } from './dto/queue.dtos';

const ACTIVE_QUEUE_STATUSES: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_SERVICE,
];

type EntryWithService = QueueEntry & { service: Pick<Service, 'name' | 'durationMin'> };

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /** Authenticated customer joins the live queue; walk-ins are named by reception. */
  async join(
    dto: JoinQueueDto,
    displayName: string,
    customerId: string | null,
  ): Promise<JoinQueueResponse> {
    try {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, isActive: true },
      });
      if (!service) {
        throw new BadRequestException(`Service ${dto.serviceId} not found or inactive`);
      }

      if (customerId) {
        const existing = await this.prisma.queueEntry.findFirst({
          where: {
            customerId,
            locationId: dto.locationId,
            status: { in: [...ACTIVE_QUEUE_STATUSES] },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException('Customer is already in this queue');
        }
      }

      const entry = await this.prisma.queueEntry.create({
        data: {
          locationId: dto.locationId,
          customerId,
          displayName,
          serviceId: service.id,
          serviceKind: service.kind,
          vehicleReg: dto.vehicleReg ?? null,
        },
        include: { service: { select: { name: true, durationMin: true } } },
      });

      const [snapshot, upsell] = await Promise.all([
        this.snapshot(dto.locationId),
        service.kind === ServiceKind.BARBER ? this.buildUpsell(dto.locationId) : Promise.resolve(null),
      ]);
      await this.publish(snapshot);

      const view = snapshot.entries.find((candidate) => candidate.id === entry.id);
      return {
        entry: view ?? this.toView(entry, null, null),
        upsell,
      };
    } catch (error) {
      throw this.wrap(error, 'Failed to join queue');
    }
  }

  async transition(
    entryId: string,
    nextStatus: QueueStatus,
    actor: AuthenticatedUser,
  ): Promise<QueueEntryView> {
    try {
      const entry = await this.prisma.queueEntry.findUnique({
        where: { id: entryId },
        select: { id: true, status: true, locationId: true, customerId: true },
      });
      if (!entry) {
        throw new NotFoundException(`Queue entry ${entryId} not found`);
      }
      if (
        actor.role === Role.CUSTOMER &&
        (entry.customerId !== actor.id || nextStatus !== QueueStatus.LEFT)
      ) {
        throw new BadRequestException('Customers can only leave their own queue entry');
      }
      this.assertTransition(entry.status, nextStatus);

      const now = new Date();
      const updated = await this.prisma.queueEntry.update({
        where: { id: entryId },
        data: {
          status: nextStatus,
          ...(nextStatus === QueueStatus.CALLED ? { calledAt: now } : {}),
          ...(nextStatus === QueueStatus.IN_SERVICE ? { startedAt: now } : {}),
          ...(nextStatus === QueueStatus.COMPLETED ? { completedAt: now } : {}),
        },
        include: { service: { select: { name: true, durationMin: true } } },
      });

      const snapshot = await this.snapshot(entry.locationId);
      await this.publish(snapshot);
      return snapshot.entries.find((candidate) => candidate.id === entryId) ?? this.toView(updated, null, null);
    } catch (error) {
      throw this.wrap(error, 'Failed to update queue entry');
    }
  }

  async snapshot(locationId: string): Promise<QueueSnapshot> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true, name: true },
      });
      if (!location) {
        throw new NotFoundException(`Location ${locationId} not found`);
      }

      const [entries, clockedIn] = await Promise.all([
        this.prisma.queueEntry.findMany({
          where: { locationId, status: { in: [...ACTIVE_QUEUE_STATUSES] } },
          include: { service: { select: { name: true, durationMin: true } } },
          orderBy: { joinedAt: 'asc' },
        }),
        this.prisma.timeEntry.findMany({
          where: { locationId, clockOutAt: null },
          select: { user: { select: { role: true } } },
        }),
      ]);

      const staffCount = (kind: ServiceKind): number => {
        const role = kind === ServiceKind.BARBER ? Role.BARBER : Role.WASH_ATTENDANT;
        return clockedIn.filter((punch) => punch.user.role === role).length;
      };

      const waitingByKind = new Map<ServiceKind, number>();
      const aheadMinutesByKind = new Map<ServiceKind, number>();
      const views = entries.map((entry) => {
        if (entry.status !== QueueStatus.WAITING) {
          return this.toView(entry, null, null);
        }
        const position = (waitingByKind.get(entry.serviceKind) ?? 0) + 1;
        waitingByKind.set(entry.serviceKind, position);

        const aheadMinutes = aheadMinutesByKind.get(entry.serviceKind) ?? 0;
        const parallelism = Math.max(staffCount(entry.serviceKind), 1);
        const estimatedWaitMin = Math.round(aheadMinutes / parallelism);
        aheadMinutesByKind.set(entry.serviceKind, aheadMinutes + entry.service.durationMin);

        return this.toView(entry, position, estimatedWaitMin);
      });

      return {
        locationId: location.id,
        locationName: location.name,
        generatedAt: new Date().toISOString(),
        entries: views,
      };
    } catch (error) {
      throw this.wrap(error, 'Failed to load queue');
    }
  }

  /**
   * Dynamic upsell: when a haircut joins the queue and a wash bay is free
   * right now, suggest the cheapest combo-eligible wash.
   */
  private async buildUpsell(locationId: string): Promise<UpsellSuggestion | null> {
    const now = new Date();
    const [bays, busyBays, queuedWashes, washService] = await Promise.all([
      this.prisma.resource.count({
        where: { locationId, kind: ResourceKind.WASH_BAY, isActive: true },
      }),
      this.prisma.appointment.count({
        where: {
          locationId,
          resourceId: { not: null },
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS] },
          startsAt: { lte: now },
          lockedUntil: { gte: now },
        },
      }),
      this.prisma.queueEntry.count({
        where: { locationId, serviceKind: ServiceKind.WASH, status: { in: [...ACTIVE_QUEUE_STATUSES] } },
      }),
      this.prisma.service.findFirst({
        where: { kind: ServiceKind.WASH, isComboEligible: true, isActive: true },
        orderBy: { priceCents: 'asc' },
      }),
    ]);

    if (!washService || bays === 0 || busyBays + queuedWashes >= bays) {
      return null;
    }
    return {
      serviceId: washService.id,
      serviceName: washService.name,
      priceCents: washService.priceCents,
      durationMin: washService.durationMin,
      reason: 'A wash bay is free right now — get your car detailed while you wait for your cut.',
    };
  }

  private assertTransition(current: QueueStatus, next: QueueStatus): void {
    const allowed: Record<QueueStatus, readonly QueueStatus[]> = {
      [QueueStatus.WAITING]: [QueueStatus.CALLED, QueueStatus.IN_SERVICE, QueueStatus.LEFT],
      [QueueStatus.CALLED]: [QueueStatus.IN_SERVICE, QueueStatus.WAITING, QueueStatus.LEFT],
      [QueueStatus.IN_SERVICE]: [QueueStatus.COMPLETED],
      [QueueStatus.COMPLETED]: [],
      [QueueStatus.LEFT]: [],
    };
    if (!allowed[current].includes(next)) {
      throw new ConflictException(`Cannot move queue entry from ${current} to ${next}`);
    }
  }

  private async publish(snapshot: QueueSnapshot): Promise<void> {
    const event: QueueUpdatedEvent = { type: 'queue.updated', snapshot };
    await this.redisService.publish(QUEUE_CHANNEL(snapshot.locationId), event);
  }

  private toView(
    entry: EntryWithService,
    position: number | null,
    estimatedWaitMin: number | null,
  ): QueueEntryView {
    return {
      id: entry.id,
      displayName: entry.displayName,
      serviceName: entry.service.name,
      serviceKind: entry.serviceKind,
      status: entry.status,
      vehicleReg: entry.vehicleReg,
      joinedAt: entry.joinedAt.toISOString(),
      position,
      estimatedWaitMin,
    };
  }

  private wrap(error: unknown, fallback: string): HttpException {
    return error instanceof HttpException ? error : new InternalServerErrorException(fallback);
  }
}
