import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentStatus, LeaveKind, LeaveStatus, Prisma, Role } from '@ta-spiru/database';
import { hashSync } from 'bcryptjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';
import { zonedTimeToUtc } from '../bookings/utils/time.util';
import {
  AddDocumentDto,
  CreateLeaveDto,
  CreateTeamMemberDto,
  DecideLeaveDto,
  SetShiftsDto,
  UpdateTeamMemberDto,
} from './dto/team.dtos';

const STAFF_ROLES: readonly Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.RECEPTIONIST,
  Role.BARBER,
  Role.WASH_ATTENDANT,
];

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  locationId: string | null;
  locationName: string | null;
  seniority: string | null;
  stationNo: number | null;
  entrance: string | null;
  photoUrl: string | null;
  minQueueGapMin: number | null;
  acceptsBookings: boolean;
  offDays: number[];
  leaveAllowanceDays: number;
  employmentDate: string | null;
  terminationDate: string | null;
  isActive: boolean;
}

@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly prisma: PrismaService) {}

  /** The team list for the admin dashboard, optionally filtered by branch. */
  @Get()
  @Roles(Role.MANAGER)
  async list(
    @Query('locationId') locationId?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<TeamMemberRow[]> {
    try {
      const staff = await this.prisma.user.findMany({
        where: {
          role: { in: [...STAFF_ROLES] },
          ...(locationId ? { locationId } : {}),
          ...(includeInactive === 'true' ? {} : { isActive: true }),
        },
        orderBy: [{ role: 'asc' }, { stationNo: 'asc' }, { firstName: 'asc' }],
        include: { location: { select: { name: true } } },
      });
      return staff.map((s) => this.toRow(s));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list the team');
    }
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateTeamMemberDto): Promise<TeamMemberRow> {
    try {
      if (!STAFF_ROLES.includes(dto.role)) {
        throw new BadRequestException('That role cannot be created from the team tab');
      }
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new BadRequestException(`${email} already has an account`);
      const created = await this.prisma.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() ?? '',
          role: dto.role,
          locationId: dto.locationId ?? null,
          phone: dto.phone ?? null,
          seniority: dto.seniority ?? (dto.role === Role.BARBER ? 'NORMAL' : null),
          stationNo: dto.stationNo ?? null,
          entrance: dto.entrance ?? null,
          // A temporary password; the member sets their own on first sign-in.
          passwordHash: hashSync('Staff!2026', 12),
          pinHash: hashSync('1234', 10),
        },
        include: { location: { select: { name: true } } },
      });
      return this.toRow(created);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create the team member');
    }
  }

  /** One member's full profile: details, service overrides and leave balances. */
  @Get(':id')
  @Roles(Role.MANAGER)
  async detail(@Param('id') id: string): Promise<Record<string, unknown>> {
    try {
      const member = await this.prisma.user.findFirst({
        where: { id, role: { in: [...STAFF_ROLES] } },
        include: {
          location: { select: { name: true } },
          serviceOverrides: { include: { service: { select: { name: true, durationMin: true, priceCents: true } } } },
        },
      });
      if (!member) throw new NotFoundException('Team member not found');

      const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
      const leave = await this.prisma.leaveRequest.findMany({
        where: { userId: id, date: { gte: yearStart } },
        orderBy: { date: 'desc' },
      });
      const approved = leave.filter((l) => l.status === LeaveStatus.APPROVED);
      const leaveTaken = approved.filter((l) => l.kind === LeaveKind.LEAVE).length;
      const sickTaken = approved.filter((l) => l.kind === LeaveKind.SICK).length;

      return {
        ...this.toRow(member),
        services: member.serviceOverrides.map((o) => ({
          serviceId: o.serviceId,
          name: o.service.name,
          isEnabled: o.isEnabled,
          priceCents: o.priceCents ?? o.service.priceCents,
          durationMin: o.durationMin ?? o.service.durationMin,
          maxDaily: o.maxDaily,
        })),
        leave: {
          allowanceDays: member.leaveAllowanceDays,
          taken: leaveTaken,
          remaining: member.leaveAllowanceDays - leaveTaken,
          sickTaken,
          entries: leave.map((l) => ({
            id: l.id,
            kind: l.kind,
            date: l.date.toISOString().slice(0, 10),
            status: l.status,
            notes: l.notes,
          })),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load the team member');
    }
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto): Promise<TeamMemberRow> {
    try {
      const member = await this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
      if (!member) throw new NotFoundException('Team member not found');
      if (dto.role && !STAFF_ROLES.includes(dto.role)) {
        throw new BadRequestException('That role is not a staff role');
      }
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.seniority !== undefined ? { seniority: dto.seniority } : {}),
          ...(dto.stationNo !== undefined ? { stationNo: dto.stationNo } : {}),
          ...(dto.entrance !== undefined ? { entrance: dto.entrance } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
          ...(dto.minQueueGapMin !== undefined ? { minQueueGapMin: dto.minQueueGapMin } : {}),
          ...(dto.acceptsBookings !== undefined ? { acceptsBookings: dto.acceptsBookings } : {}),
          ...(dto.offDays !== undefined ? { offDays: dto.offDays } : {}),
          ...(dto.leaveAllowanceDays !== undefined ? { leaveAllowanceDays: dto.leaveAllowanceDays } : {}),
          ...(dto.employmentDate !== undefined ? { employmentDate: new Date(dto.employmentDate) } : {}),
          ...(dto.terminationDate !== undefined ? { terminationDate: new Date(dto.terminationDate) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { location: { select: { name: true } } },
      });
      return this.toRow(updated);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update the team member');
    }
  }

  /** Remove a member from the team (deactivate — their history is kept). */
  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    try {
      const member = await this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
      if (!member) throw new NotFoundException('Team member not found');
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false, acceptsBookings: false, terminationDate: new Date() },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove the team member');
    }
  }

  /** A barber's month: bookings made/missed, retained vs new clients, leave. */
  @Get(':id/performance')
  @Roles(Role.MANAGER)
  async performance(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<Record<string, unknown>> {
    try {
      const member = await this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
      if (!member) throw new NotFoundException('Team member not found');
      const now = new Date();
      const start = from
        ? new Date(`${from}T00:00:00.000Z`)
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = to ? new Date(`${to}T23:59:59.999Z`) : now;

      const appts = await this.prisma.appointment.findMany({
        where: { barberId: id, startsAt: { gte: start, lte: end } },
        select: { customerId: true, status: true, startsAt: true },
      });
      const completed = appts.filter((a) => a.status === AppointmentStatus.COMPLETED);
      const missed = appts.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;

      // A client is "retained" if they had seen this barber before this window.
      const customerIds = [...new Set(completed.map((a) => a.customerId))];
      const earlier = await this.prisma.appointment.findMany({
        where: { barberId: id, customerId: { in: customerIds }, startsAt: { lt: start } },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      const returning = new Set(earlier.map((e) => e.customerId));
      const retained = customerIds.filter((c) => returning.has(c)).length;

      const leave = await this.prisma.leaveRequest.findMany({
        where: { userId: id, status: LeaveStatus.APPROVED, date: { gte: start, lte: end } },
      });
      const changes = await this.prisma.serviceChangeLog.count({
        where: { changedById: id, createdAt: { gte: start, lte: end } },
      });

      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        bookingsMade: appts.length,
        bookingsCompleted: completed.length,
        bookingsMissed: missed,
        clientsRetained: retained,
        clientsNew: customerIds.length - retained,
        leaveDays: leave.filter((l) => l.kind === LeaveKind.LEAVE).length,
        sickDays: leave.filter((l) => l.kind === LeaveKind.SICK).length,
        serviceUpsells: changes,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build the performance report');
    }
  }

  // ── Leave & sick ────────────────────────────────────────────────────────

  /** Staff request their own days; managers may file for anyone. */
  @Post(':id/leave')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  async requestLeave(
    @Param('id') id: string,
    @Body() dto: CreateLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ created: number; status: LeaveStatus }> {
    try {
      const isManager = user.role === Role.ADMIN || user.role === Role.MANAGER;
      if (!isManager && user.id !== id) {
        throw new ForbiddenException('You can only request your own leave');
      }
      const member = await this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
      if (!member) throw new NotFoundException('Team member not found');

      // A manager filing leave approves it outright; staff requests wait.
      const status = isManager ? LeaveStatus.APPROVED : LeaveStatus.PENDING;
      const rows = dto.dates.map((d) => ({
        userId: id,
        kind: dto.kind,
        date: new Date(`${d}T00:00:00.000Z`),
        status,
        notes: dto.notes ?? null,
      }));
      const result = await this.prisma.leaveRequest.createMany({ data: rows, skipDuplicates: true });

      // Tell the admins, and confirm to the member when a manager filed it.
      const admins = await this.prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
        select: { id: true },
      });
      const who = fullName(member.firstName, member.lastName);
      const label = dto.kind === LeaveKind.SICK ? 'Sick leave' : 'Leave';
      await this.prisma.notification.createMany({
        data: [
          ...admins
            .filter((a) => a.id !== user.id)
            .map((a) => ({
              userId: a.id,
              kind: 'LEAVE',
              title: `${label} ${status === LeaveStatus.APPROVED ? 'recorded' : 'requested'}: ${who}`,
              body: `${result.count} day(s) from ${dto.dates[0]}`,
            })),
          ...(isManager && user.id !== id
            ? [{ userId: id, kind: 'LEAVE', title: `${label} recorded for you`, body: `${result.count} day(s)` }]
            : []),
        ],
      });
      return { created: result.count, status };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to record the leave');
    }
  }

  @Patch('leave/:leaveId')
  @Roles(Role.ADMIN)
  async decideLeave(@Param('leaveId') leaveId: string, @Body() dto: DecideLeaveDto): Promise<{ ok: true }> {
    try {
      const entry = await this.prisma.leaveRequest.findUnique({ where: { id: leaveId } });
      if (!entry) throw new NotFoundException('Leave request not found');
      await this.prisma.leaveRequest.update({ where: { id: leaveId }, data: { status: dto.status } });
      await this.prisma.notification.create({
        data: {
          userId: entry.userId,
          kind: 'LEAVE',
          title: `Leave ${dto.status.toLowerCase()}`,
          body: entry.date.toISOString().slice(0, 10),
        },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update the leave request');
    }
  }

  /**
   * Set a member's working windows for one day. Two windows make the split
   * shift the shop actually works (e.g. 08:30–13:15 and 13:45–19:00); the
   * availability engine already treats each window as separately bookable.
   */
  @Post(':id/shifts')
  @Roles(Role.MANAGER)
  async setShifts(
    @Param('id') id: string,
    @Body() dto: SetShiftsDto,
  ): Promise<{ date: string; windows: { startsAt: string; endsAt: string }[] }> {
    try {
      const [member, location] = await Promise.all([
        this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } }),
        this.prisma.location.findUnique({ where: { id: dto.locationId }, select: { id: true, timezone: true } }),
      ]);
      if (!member) throw new NotFoundException('Team member not found');
      if (!location) throw new NotFoundException('Branch not found');

      const windows = dto.windows.map((w) => ({
        startsAt: zonedTimeToUtc(dto.date, w.startsAt, location.timezone),
        endsAt: zonedTimeToUtc(dto.date, w.endsAt, location.timezone),
      }));
      for (const w of windows) {
        if (w.endsAt <= w.startsAt) {
          throw new BadRequestException('A shift must end after it starts');
        }
      }
      windows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      windows.reduce<Date | null>((previousEnd, window) => {
        if (previousEnd && window.startsAt < previousEnd) {
          throw new BadRequestException('Shift windows must not overlap');
        }
        return window.endsAt;
      }, null);

      const dayStart = new Date(`${dto.date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 48 * 60 * 60 * 1000);
      await this.prisma.$transaction([
        this.prisma.shift.deleteMany({
          where: { userId: id, startsAt: { gte: new Date(dayStart.getTime() - 24 * 60 * 60 * 1000), lt: dayEnd } },
        }),
        this.prisma.shift.createMany({
          data: windows.map((w) => ({ userId: id, locationId: dto.locationId, ...w })),
        }),
      ]);

      await this.prisma.notification.create({
        data: {
          userId: id,
          kind: 'ROSTER',
          title: `Your roster changed for ${dto.date}`,
          body: windows.length
            ? windows.map((w) => `${w.startsAt.toISOString().slice(11, 16)}–${w.endsAt.toISOString().slice(11, 16)} UTC`).join(', ')
            : 'No shift that day',
        },
      });

      return {
        date: dto.date,
        windows: windows.map((w) => ({ startsAt: w.startsAt.toISOString(), endsAt: w.endsAt.toISOString() })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to set the shifts');
    }
  }

  // ── Documents ───────────────────────────────────────────────────────────

  /** Contracts, ID copies and certificates, grouped into folders. */
  @Get(':id/documents')
  @Roles(Role.MANAGER)
  async documents(@Param('id') id: string): Promise<Record<string, unknown>[]> {
    try {
      const docs = await this.prisma.staffDocument.findMany({
        where: { userId: id },
        orderBy: [{ folder: 'asc' }, { createdAt: 'desc' }],
      });
      return docs.map((d) => ({
        id: d.id,
        folder: d.folder,
        name: d.name,
        url: d.url,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list the documents');
    }
  }

  @Post(':id/documents')
  @Roles(Role.ADMIN)
  async addDocument(
    @Param('id') id: string,
    @Body() dto: AddDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; folder: string }> {
    try {
      const member = await this.prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
      if (!member) throw new NotFoundException('Team member not found');
      const doc = await this.prisma.staffDocument.create({
        data: {
          userId: id,
          folder: dto.folder?.trim() || 'General',
          name: dto.name.trim(),
          url: dto.url,
          mimeType: dto.mimeType ?? null,
          sizeBytes: dto.sizeBytes ?? null,
          uploadedById: user.id,
        },
      });
      return { id: doc.id, folder: doc.folder };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to add the document');
    }
  }

  @Delete('documents/:documentId')
  @Roles(Role.ADMIN)
  async removeDocument(@Param('documentId') documentId: string): Promise<{ ok: true }> {
    try {
      const doc = await this.prisma.staffDocument.findUnique({ where: { id: documentId } });
      if (!doc) throw new NotFoundException('Document not found');
      await this.prisma.staffDocument.delete({ where: { id: documentId } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove the document');
    }
  }

  // ── Personal staff app ──────────────────────────────────────────────────

  /**
   * Everything a staff member needs on their own phone: their upcoming roster,
   * leave and sick balances with recent requests, and their documents. No
   * colleague's data and no money.
   */
  @Get('me/overview')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  async myOverview(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    try {
      const now = new Date();
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const [me, shifts, leave, documents, unread] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { location: { select: { name: true } } },
        }),
        this.prisma.shift.findMany({
          where: { userId: user.id, endsAt: { gte: now } },
          orderBy: { startsAt: 'asc' },
          take: 30,
          include: { location: { select: { name: true } } },
        }),
        this.prisma.leaveRequest.findMany({
          where: { userId: user.id, date: { gte: yearStart } },
          orderBy: { date: 'desc' },
        }),
        this.prisma.staffDocument.findMany({
          where: { userId: user.id },
          orderBy: [{ folder: 'asc' }, { createdAt: 'desc' }],
        }),
        this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ]);
      const approved = leave.filter((l) => l.status === LeaveStatus.APPROVED);
      const leaveTaken = approved.filter((l) => l.kind === LeaveKind.LEAVE).length;
      return {
        name: fullName(me.firstName, me.lastName),
        role: me.role,
        locationName: me.location?.name ?? null,
        stationNo: me.stationNo,
        unreadNotifications: unread,
        roster: shifts.map((s) => ({
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          locationName: s.location.name,
        })),
        leave: {
          allowanceDays: me.leaveAllowanceDays,
          taken: leaveTaken,
          remaining: me.leaveAllowanceDays - leaveTaken,
          sickTaken: approved.filter((l) => l.kind === LeaveKind.SICK).length,
          pending: leave.filter((l) => l.status === LeaveStatus.PENDING).length,
          recent: leave.slice(0, 10).map((l) => ({
            id: l.id,
            kind: l.kind,
            date: l.date.toISOString().slice(0, 10),
            status: l.status,
          })),
        },
        documents: documents.map((d) => ({ id: d.id, folder: d.folder, name: d.name, url: d.url })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load your overview');
    }
  }

  /** The roster: who is on, off, or on leave for a given day. */
  @Get('roster/day')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  async roster(@Query('date') date?: string, @Query('locationId') locationId?: string): Promise<Record<string, unknown>[]> {
    try {
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const weekday = dayStart.getUTCDay();

      const staff = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.BARBER, Role.RECEPTIONIST, Role.WASH_ATTENDANT, Role.MANAGER] },
          isActive: true,
          ...(locationId ? { locationId } : {}),
        },
        orderBy: [{ stationNo: 'asc' }, { firstName: 'asc' }],
        include: {
          location: { select: { name: true } },
          shifts: { where: { startsAt: { gte: dayStart, lt: dayEnd } }, orderBy: { startsAt: 'asc' } },
          leaveRequests: { where: { date: dayStart, status: LeaveStatus.APPROVED } },
        },
      });

      return staff.map((s) => {
        const onLeave = s.leaveRequests[0];
        const isOffDay = s.offDays.includes(weekday);
        return {
          id: s.id,
          name: fullName(s.firstName, s.lastName),
          role: s.role,
          locationName: s.location?.name ?? null,
          stationNo: s.stationNo,
          status: onLeave ? onLeave.kind : isOffDay ? 'OFF' : s.shifts.length ? 'ON' : 'NOT_ROSTERED',
          shifts: s.shifts.map((sh) => ({
            startsAt: sh.startsAt.toISOString(),
            endsAt: sh.endsAt.toISOString(),
          })),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build the roster');
    }
  }

  private toRow(
    s: Prisma.UserGetPayload<{ include: { location: { select: { name: true } } } }>,
  ): TeamMemberRow {
    return {
      id: s.id,
      name: fullName(s.firstName, s.lastName),
      email: s.email,
      phone: s.phone,
      role: s.role,
      locationId: s.locationId,
      locationName: s.location?.name ?? null,
      seniority: s.seniority,
      stationNo: s.stationNo,
      entrance: s.entrance,
      photoUrl: s.photoUrl,
      minQueueGapMin: s.minQueueGapMin,
      acceptsBookings: s.acceptsBookings,
      offDays: s.offDays,
      leaveAllowanceDays: s.leaveAllowanceDays,
      employmentDate: s.employmentDate?.toISOString() ?? null,
      terminationDate: s.terminationDate?.toISOString() ?? null,
      isActive: s.isActive,
    };
  }
}
