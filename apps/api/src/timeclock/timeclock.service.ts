import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { Location, Prisma, Role, TimeEntry, User } from '@ta-spiru/database';
import { KioskStaffMember, PunchResult, TimeEntryRow } from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { fullName } from '../common/name.util';
import { EntriesQueryDto, PunchDto, SetPinDto, UpdateTimeEntryDto } from './dto/timeclock.dtos';

type EntryWithNames = TimeEntry & {
  user: Pick<User, 'firstName' | 'lastName' | 'role'>;
  location: Pick<Location, 'name'>;
};

@Injectable()
export class TimeclockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kiosk punch: verifies the staff PIN, then toggles clock-in / clock-out. */
  async punch(dto: PunchDto): Promise<PunchResult> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user || !user.isActive || user.role === Role.CUSTOMER) {
        throw new NotFoundException('Staff member not found');
      }
      if (!user.pinHash) {
        throw new BadRequestException('No PIN set for this staff member');
      }
      const pinValid = await compare(dto.pin, user.pinHash);
      if (!pinValid) {
        throw new UnauthorizedException('Incorrect PIN');
      }

      const openEntry = await this.prisma.timeEntry.findFirst({
        where: { userId: user.id, clockOutAt: null },
        orderBy: { clockInAt: 'desc' },
      });

      if (openEntry) {
        const closed = await this.prisma.timeEntry.update({
          where: { id: openEntry.id },
          data: { clockOutAt: new Date() },
          include: {
            user: { select: { firstName: true, lastName: true, role: true } },
            location: { select: { name: true } },
          },
        });
        return { action: 'CLOCK_OUT', entry: this.toRow(closed) };
      }

      const opened = await this.prisma.timeEntry.create({
        data: { userId: user.id, locationId: dto.locationId },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          location: { select: { name: true } },
        },
      });
      return { action: 'CLOCK_IN', entry: this.toRow(opened) };
    } catch (error) {
      throw this.wrap(error, 'Timeclock punch failed');
    }
  }

  /** Clockable staff at a branch with live clocked-in status, for the kiosk grid. */
  async roster(locationId: string): Promise<KioskStaffMember[]> {
    try {
      const staff = await this.prisma.user.findMany({
        where: { locationId, isActive: true, role: { not: Role.CUSTOMER } },
        select: { id: true, firstName: true, lastName: true, role: true, pinHash: true },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      });
      const openEntries = await this.prisma.timeEntry.findMany({
        where: { locationId, clockOutAt: null, userId: { in: staff.map((member) => member.id) } },
        select: { userId: true, clockInAt: true },
      });
      const openByUser = new Map(openEntries.map((entry) => [entry.userId, entry.clockInAt]));

      return staff.map((member) => {
        const since = openByUser.get(member.id) ?? null;
        return {
          id: member.id,
          name: fullName(member.firstName, member.lastName),
          role: member.role,
          hasPin: member.pinHash !== null,
          clockedIn: since !== null,
          clockedInSince: since?.toISOString() ?? null,
        };
      });
    } catch (error) {
      throw this.wrap(error, 'Failed to load kiosk roster');
    }
  }

  async setPin(dto: SetPinDto, actor: AuthenticatedUser): Promise<{ ok: true }> {
    if (actor.role === Role.CUSTOMER) {
      throw new ForbiddenException('Only staff can set a timeclock PIN');
    }
    try {
      await this.prisma.user.update({
        where: { id: actor.id },
        data: { pinHash: await hash(dto.pin, 10) },
      });
      return { ok: true };
    } catch (error) {
      throw this.wrap(error, 'Failed to set PIN');
    }
  }

  async entries(query: EntriesQueryDto): Promise<TimeEntryRow[]> {
    try {
      const date = query.date ?? new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const where: Prisma.TimeEntryWhereInput = {
        clockInAt: { gte: dayStart, lt: dayEnd },
        ...(query.locationId ? { locationId: query.locationId } : {}),
      };
      const rows = await this.prisma.timeEntry.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          location: { select: { name: true } },
        },
        orderBy: { clockInAt: 'asc' },
      });
      return rows.map((row) => this.toRow(row));
    } catch (error) {
      throw this.wrap(error, 'Failed to list time entries');
    }
  }

  /** Manager correction of a punch pair. */
  async updateEntry(entryId: string, dto: UpdateTimeEntryDto, actor: AuthenticatedUser): Promise<TimeEntryRow> {
    try {
      const entry = await this.prisma.timeEntry.findUnique({
        where: { id: entryId },
        select: { locationId: true },
      });
      if (!entry) {
        throw new NotFoundException(`Time entry ${entryId} not found`);
      }
      if (actor.role === Role.MANAGER && actor.locationId !== entry.locationId) {
        throw new ForbiddenException('Managers can only adjust entries at their own branch');
      }

      const clockInAt = dto.clockInAt ? new Date(dto.clockInAt) : undefined;
      const clockOutAt = dto.clockOutAt ? new Date(dto.clockOutAt) : undefined;
      if (clockInAt && clockOutAt && clockOutAt <= clockInAt) {
        throw new BadRequestException('clockOutAt must be after clockInAt');
      }

      const updated = await this.prisma.timeEntry.update({
        where: { id: entryId },
        data: { ...(clockInAt ? { clockInAt } : {}), ...(clockOutAt ? { clockOutAt } : {}) },
        include: {
          user: { select: { firstName: true, lastName: true, role: true } },
          location: { select: { name: true } },
        },
      });
      return this.toRow(updated);
    } catch (error) {
      throw this.wrap(error, 'Failed to update time entry');
    }
  }

  private toRow(entry: EntryWithNames): TimeEntryRow {
    return {
      id: entry.id,
      userId: entry.userId,
      staffName: fullName(entry.user.firstName, entry.user.lastName),
      role: entry.user.role,
      locationId: entry.locationId,
      locationName: entry.location.name,
      clockInAt: entry.clockInAt.toISOString(),
      clockOutAt: entry.clockOutAt?.toISOString() ?? null,
      workedMinutes: entry.clockOutAt
        ? Math.round((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60_000)
        : null,
    };
  }

  private wrap(error: unknown, fallback: string): HttpException {
    return error instanceof HttpException ? error : new InternalServerErrorException(fallback);
  }
}
