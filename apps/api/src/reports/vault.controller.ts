import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentStatus, OrderStatus, Role, ServiceKind } from '@ta-spiru/database';
import { compareSync } from 'bcryptjs';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

export const VAULT_CODE_KEY = 'vault.codeHash';
export const SALES_HIDDEN_KEY = 'sales.hidden';

class VaultDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VaultController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  /**
   * Item counts for the dashboards — how many haircuts, washes, products.
   * Deliberately carries no monetary values; money lives behind the vault.
   */
  @Get('sales-counts')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  async salesCounts(@Query('date') date?: string): Promise<{
    date: string;
    barberServices: number;
    washServices: number;
    productsSold: number;
  }> {
    try {
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const [byKind, orders] = await Promise.all([
        this.prisma.appointment.groupBy({
          by: ['serviceId'],
          where: { status: AppointmentStatus.COMPLETED, startsAt: { gte: dayStart, lt: dayEnd } },
          _count: { _all: true },
        }),
        this.prisma.orderItem.aggregate({
          where: {
            order: {
              status: { in: [OrderStatus.PAID, OrderStatus.FULFILLED] },
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          },
          _sum: { quantity: true },
        }),
      ]);
      const serviceKinds = await this.prisma.service.findMany({
        where: { id: { in: byKind.map((b) => b.serviceId) } },
        select: { id: true, kind: true },
      });
      const kindOf = new Map(serviceKinds.map((s) => [s.id, s.kind]));
      let barberServices = 0;
      let washServices = 0;
      for (const b of byKind) {
        if (kindOf.get(b.serviceId) === ServiceKind.WASH) washServices += b._count._all;
        else barberServices += b._count._all;
      }
      return { date: day, barberServices, washServices, productsSold: orders._sum.quantity ?? 0 };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build the counts');
    }
  }

  /**
   * The owner's hidden sales section. Opens only with the vault code; entering
   * the code REVERSED wipes monetary sales from the whole system until the
   * owner restores them. Clock in/out durations ride along, internal use only.
   */
  @Post('sales-vault')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  async vault(@Body() dto: VaultDto): Promise<Record<string, unknown>> {
    try {
      const { match, reversed } = await this.checkCode(dto.code);
      if (reversed) {
        await this.setHidden(true);
        return { wiped: true };
      }
      if (!match) throw new ForbiddenException('Wrong code');
      if (await this.isHidden()) return { wiped: true };

      const [revenue, timeEntries] = await Promise.all([
        this.reports.revenueSplits({ from: dto.from, to: dto.to }),
        this.prisma.timeEntry.findMany({
          where: { clockInAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { clockInAt: 'desc' },
          take: 100,
        }),
      ]);
      return {
        wiped: false,
        revenue,
        timeclock: timeEntries.map((t) => ({
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          clockInAt: t.clockInAt.toISOString(),
          clockOutAt: t.clockOutAt?.toISOString() ?? null,
          minutes: t.clockOutAt
            ? Math.round((t.clockOutAt.getTime() - t.clockInAt.getTime()) / 60000)
            : null,
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to open the vault');
    }
  }

  /** Owner-only: bring wiped sales back. Requires the correct (forward) code. */
  @Post('sales-vault/restore')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  async restore(@Body() dto: VaultDto): Promise<{ restored: boolean }> {
    try {
      const { match } = await this.checkCode(dto.code);
      if (!match) throw new ForbiddenException('Wrong code');
      await this.setHidden(false);
      return { restored: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to restore sales');
    }
  }

  private async checkCode(code: string): Promise<{ match: boolean; reversed: boolean }> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: VAULT_CODE_KEY } });
    if (!row) throw new ForbiddenException('Vault is not configured');
    const match = compareSync(code, row.value);
    const reversed = !match && compareSync(code.split('').reverse().join(''), row.value);
    return { match, reversed };
  }

  private async isHidden(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: SALES_HIDDEN_KEY } });
    return row?.value === 'true';
  }

  private async setHidden(hidden: boolean): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: SALES_HIDDEN_KEY },
      update: { value: String(hidden) },
      create: { key: SALES_HIDDEN_KEY, value: String(hidden) },
    });
  }
}
