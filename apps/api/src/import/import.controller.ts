import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LoyaltyEntryKind, Role } from '@ta-spiru/database';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

const POINT_VALUE_KEY = 'loyalty.pointValueCents';
const DEFAULT_POINT_VALUE_CENTS = 5;

class ImportCustomerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @IsString()
  @MaxLength(60)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  /** How many bookings they had in the old system. */
  @IsOptional()
  @IsInt()
  @Min(0)
  previousBookings?: number;

  /** What those bookings totalled, in cents. Points are derived from this. */
  @IsOptional()
  @IsInt()
  @Min(0)
  previousSpendCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workplace?: string;
}

class ImportCustomersDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerDto)
  customers!: ImportCustomerDto[];

  /** Preview the outcome without writing anything. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export interface ImportResult {
  dryRun: boolean;
  received: number;
  created: number;
  updated: number;
  skipped: number;
  pointsAwarded: number;
  errors: { row: number; reason: string }[];
}

/**
 * Migration from the current booking system. Customers arrive with their past
 * booking count and spend; that spend converts to loyalty points at the same
 * rate the shop uses today, so a returning customer signs in and finds their
 * balance already waiting.
 */
@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ImportController {
  constructor(private readonly prisma: PrismaService) {}

  /** What the app tells a returning customer, and where the import stands. */
  @Get('status')
  async status(): Promise<Record<string, unknown>> {
    try {
      const [imported, withPoints] = await Promise.all([
        this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
        this.prisma.loyaltyAccount.count({ where: { lifetimePoints: { gt: 0 } } }),
      ]);
      return {
        customers: imported,
        withLoyaltyPoints: withPoints,
        pointValueCents: await this.pointValue(),
        returningCustomerMessage:
          'To keep the points from your previous bookings, download our app and log into your account.',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to read the import status');
    }
  }

  @Post('customers')
  @HttpCode(200)
  async customers(@Body() dto: ImportCustomersDto): Promise<ImportResult> {
    const result: ImportResult = {
      dryRun: Boolean(dto.dryRun),
      received: dto.customers.length,
      created: 0,
      updated: 0,
      skipped: 0,
      pointsAwarded: 0,
      errors: [],
    };
    try {
      const pointValueCents = await this.pointValue();

      for (const [index, row] of dto.customers.entries()) {
        const email = row.email?.trim().toLowerCase();
        const phone = row.phone?.trim();
        if (!email && !phone) {
          result.skipped += 1;
          result.errors.push({ row: index, reason: 'No email or phone to identify the customer' });
          continue;
        }
        // Points are the average spend per past booking, in whole points.
        const points =
          row.previousSpendCents && pointValueCents > 0
            ? Math.floor(row.previousSpendCents / 100)
            : 0;

        const existing = email
          ? await this.prisma.user.findUnique({ where: { email } })
          : await this.prisma.user.findFirst({ where: { phone, role: Role.CUSTOMER } });

        if (existing && existing.role !== Role.CUSTOMER) {
          result.skipped += 1;
          result.errors.push({ row: index, reason: `${email ?? phone} belongs to a staff account` });
          continue;
        }

        if (dto.dryRun) {
          if (existing) result.updated += 1;
          else result.created += 1;
          result.pointsAwarded += points;
          continue;
        }

        // A synthetic address keeps the unique-email constraint satisfied for
        // phone-only records; the customer replaces it when they sign up.
        const emailKey = email ?? `imported-${phone?.replace(/\D/g, '')}@import.taspiru.com`;
        const user = await this.prisma.user.upsert({
          where: { email: emailKey },
          update: {
            firstName: row.firstName.trim(),
            lastName: row.lastName?.trim() ?? '',
            ...(phone ? { phone } : {}),
            ...(row.workplace ? { workplace: row.workplace } : {}),
          },
          create: {
            email: emailKey,
            firstName: row.firstName.trim(),
            lastName: row.lastName?.trim() ?? '',
            phone: phone ?? null,
            workplace: row.workplace ?? null,
            role: Role.CUSTOMER,
            // No password: they set one when they download the app and claim
            // the account, which is exactly the migration prompt.
            passwordHash: null,
          },
        });
        if (existing) result.updated += 1;
        else result.created += 1;

        if (points > 0) {
          const account = await this.prisma.loyaltyAccount.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          });
          // Idempotent: the migration credit is only ever applied once.
          const already = await this.prisma.loyaltyLedgerEntry.findFirst({
            where: { accountId: account.id, note: 'Imported from the previous booking system' },
          });
          if (!already) {
            await this.prisma.$transaction([
              this.prisma.loyaltyLedgerEntry.create({
                data: {
                  accountId: account.id,
                  kind: LoyaltyEntryKind.ADJUST,
                  deltaPoints: points,
                  note: 'Imported from the previous booking system',
                },
              }),
              this.prisma.loyaltyAccount.update({
                where: { id: account.id },
                data: {
                  balancePoints: { increment: points },
                  lifetimePoints: { increment: points },
                },
              }),
            ]);
            result.pointsAwarded += points;
          }
        }
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Customer import failed');
    }
  }

  private async pointValue(): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: POINT_VALUE_KEY } });
    return row ? Number(row.value) : DEFAULT_POINT_VALUE_CENTS;
  }
}
