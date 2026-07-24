import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Prisma, Role, WaitingListStatus } from '@ta-spiru/database';
import type { WaitingListRow, WaitingListStatusName } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  JoinWaitingListDto,
  UpdateWaitingListDto,
  WaitingListQueryDto,
} from './dto/waiting-list.dtos';

type EntryWithRelations = Prisma.WaitingListEntryGetPayload<{
  include: {
    customer: { select: { firstName: true; lastName: true; phone: true } };
    barber: { select: { firstName: true; lastName: true } };
    service: { select: { name: true } };
  };
}>;

const INCLUDE = {
  customer: { select: { firstName: true, lastName: true, phone: true } },
  barber: { select: { firstName: true, lastName: true } },
  service: { select: { name: true } },
} as const;

@Controller('waiting-list')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WaitingListController {
  constructor(private readonly prisma: PrismaService) {}

  /** A customer joins the list for a fully-booked barber (or "any barber"). */
  @Post()
  async join(
    @Body() dto: JoinWaitingListDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WaitingListRow> {
    try {
      const [location, service] = await Promise.all([
        this.prisma.location.findUnique({ where: { id: dto.locationId }, select: { id: true } }),
        this.prisma.service.findFirst({
          where: { id: dto.serviceId, isActive: true },
          select: { id: true },
        }),
      ]);
      if (!location) throw new NotFoundException('Location not found');
      if (!service) throw new BadRequestException('Service not found or inactive');

      if (dto.barberId) {
        const barber = await this.prisma.user.findFirst({
          where: { id: dto.barberId, role: Role.BARBER, locationId: dto.locationId },
          select: { id: true },
        });
        if (!barber) throw new NotFoundException('Barber not found at this location');
      }

      const forDate = new Date(`${dto.forDate}T00:00:00.000Z`);
      const existing = await this.prisma.waitingListEntry.findFirst({
        where: {
          customerId: user.id,
          locationId: dto.locationId,
          barberId: dto.barberId ?? null,
          forDate,
          status: { in: [WaitingListStatus.WAITING, WaitingListStatus.OFFERED] },
        },
        include: INCLUDE,
      });
      if (existing) return this.toRow(existing);

      const entry = await this.prisma.waitingListEntry.create({
        data: {
          locationId: dto.locationId,
          customerId: user.id,
          barberId: dto.barberId ?? null,
          serviceId: dto.serviceId,
          forDate,
          notes: dto.notes ?? null,
        },
        include: INCLUDE,
      });
      return this.toRow(entry);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to join the waiting list');
    }
  }

  /** Reception/admin view of the list for a branch and day. */
  @Get()
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  async list(@Query() query: WaitingListQueryDto): Promise<WaitingListRow[]> {
    try {
      const entries = await this.prisma.waitingListEntry.findMany({
        where: {
          locationId: query.locationId,
          ...(query.date ? { forDate: new Date(`${query.date}T00:00:00.000Z`) } : {}),
          status: query.status ?? { in: [WaitingListStatus.WAITING, WaitingListStatus.OFFERED] },
        },
        orderBy: { createdAt: 'asc' }, // first come, first served
        include: INCLUDE,
      });
      return entries.map((e) => this.toRow(e));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list the waiting list');
    }
  }

  /** The signed-in customer's own waiting-list entries. */
  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<WaitingListRow[]> {
    try {
      const entries = await this.prisma.waitingListEntry.findMany({
        where: { customerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: INCLUDE,
      });
      return entries.map((e) => this.toRow(e));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load your waiting list');
    }
  }

  /** Reception moves an entry along: offered / booked / cancelled. */
  @Patch(':id')
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  async update(@Param('id') id: string, @Body() dto: UpdateWaitingListDto): Promise<WaitingListRow> {
    try {
      const found = await this.prisma.waitingListEntry.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Waiting list entry not found');
      const entry = await this.prisma.waitingListEntry.update({
        where: { id },
        data: { status: dto.status },
        include: INCLUDE,
      });
      return this.toRow(entry);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update the waiting list entry');
    }
  }

  /** A customer withdraws from the list. */
  @Delete(':id')
  async leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    try {
      const found = await this.prisma.waitingListEntry.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Waiting list entry not found');
      const isStaff = user.role === Role.ADMIN || user.role === Role.MANAGER || user.role === Role.RECEPTIONIST;
      if (found.customerId !== user.id && !isStaff) {
        throw new NotFoundException('Waiting list entry not found');
      }
      await this.prisma.waitingListEntry.update({
        where: { id },
        data: { status: WaitingListStatus.CANCELLED },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to leave the waiting list');
    }
  }

  private toRow(entry: EntryWithRelations): WaitingListRow {
    return {
      id: entry.id,
      locationId: entry.locationId,
      customerName: fullName(entry.customer.firstName, entry.customer.lastName),
      customerPhone: entry.customer.phone,
      barberId: entry.barberId,
      barberName: entry.barber ? fullName(entry.barber.firstName, entry.barber.lastName) : null,
      serviceId: entry.serviceId,
      serviceName: entry.service.name,
      forDate: entry.forDate.toISOString().slice(0, 10),
      status: entry.status as WaitingListStatusName,
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
