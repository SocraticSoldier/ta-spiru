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
  Put,
  UseGuards,
} from '@nestjs/common';
import { Coupon, CouponKind, Role } from '@ta-spiru/database';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';

const POINT_VALUE_KEY = 'loyalty.pointValueCents';
const DEFAULT_POINT_VALUE_CENTS = 5; // 100 points = €5

class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may only contain letters, numbers, dashes and underscores' })
  code!: string;

  @IsEnum(CouponKind)
  kind!: CouponKind;

  /** Percent (1–100) for PERCENT, cents for AMOUNT. */
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsBoolean()
  lowPeakOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  locationId?: string;
}

class PointValueDto {
  @IsInt()
  @Min(1)
  pointValueCents!: number;
}

export interface CouponRow {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  validFrom: string | null;
  validUntil: string | null;
  locationId: string | null;
  lowPeakOnly: boolean;
  maxRedemptions: number | null;
  redemptions: number;
  isActive: boolean;
  notes: string | null;
  isBirthdayReward: boolean;
}

@Controller('coupons')
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin list of every code. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async list(): Promise<CouponRow[]> {
    try {
      const rows = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((c) => this.toRow(c));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list coupons');
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateCouponDto): Promise<CouponRow> {
    try {
      const code = dto.code.toUpperCase();
      if (dto.kind === CouponKind.PERCENT && dto.value > 100) {
        throw new BadRequestException('A percent discount cannot exceed 100');
      }
      const existing = await this.prisma.coupon.findUnique({ where: { code } });
      if (existing) throw new BadRequestException(`Code ${code} already exists`);
      const c = await this.prisma.coupon.create({
        data: {
          code,
          kind: dto.kind,
          value: dto.value,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          locationId: dto.locationId ?? null,
          lowPeakOnly: dto.lowPeakOnly ?? false,
          maxRedemptions: dto.maxRedemptions ?? null,
          notes: dto.notes ?? null,
        },
      });
      return this.toRow(c);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create the coupon');
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async toggle(@Param('id') id: string, @Body('isActive') isActive: boolean): Promise<CouponRow> {
    try {
      const found = await this.prisma.coupon.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Coupon not found');
      const c = await this.prisma.coupon.update({ where: { id }, data: { isActive: Boolean(isActive) } });
      return this.toRow(c);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update the coupon');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    try {
      const found = await this.prisma.coupon.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Coupon not found');
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove the coupon');
    }
  }

  /**
   * Check a code at the till / checkout: returns the discount it grants on the
   * given amount. Redemption counting happens when the sale settles.
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ code: string; discountCents: number; lowPeakOnly: boolean }> {
    try {
      const c = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } });
      const now = new Date();
      if (!c || !c.isActive) throw new BadRequestException('That code is not valid');
      if (c.validFrom && now < c.validFrom) throw new BadRequestException('That code is not active yet');
      if (c.validUntil && now > c.validUntil) throw new BadRequestException('That code has expired');
      if (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions) {
        throw new BadRequestException('That code has been fully redeemed');
      }
      if (c.locationId && dto.locationId && c.locationId !== dto.locationId) {
        throw new BadRequestException('That code is not valid at this branch');
      }
      if (c.isBirthdayReward) {
        const customer = await this.prisma.user.findUnique({ where: { id: user.id }, select: { birthday: true } });
        if (!customer?.birthday || customer.birthday.getUTCMonth() !== now.getUTCMonth()) {
          throw new BadRequestException('That code only applies during your birthday month');
        }
      }
      const discountCents =
        c.kind === CouponKind.PERCENT
          ? Math.floor((dto.amountCents * c.value) / 100)
          : Math.min(c.value, dto.amountCents);
      return { code: c.code, discountCents, lowPeakOnly: c.lowPeakOnly };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to validate the code');
    }
  }

  /** What a loyalty point is worth (owner-tunable; default 100 pts = €5). */
  @Get('loyalty-point-value')
  @UseGuards(JwtAuthGuard)
  async pointValue(): Promise<{ pointValueCents: number }> {
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key: POINT_VALUE_KEY } });
      return { pointValueCents: row ? Number(row.value) : DEFAULT_POINT_VALUE_CENTS };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to read the point value');
    }
  }

  @Put('loyalty-point-value')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async setPointValue(@Body() dto: PointValueDto): Promise<{ pointValueCents: number }> {
    try {
      await this.prisma.appSetting.upsert({
        where: { key: POINT_VALUE_KEY },
        update: { value: String(dto.pointValueCents) },
        create: { key: POINT_VALUE_KEY, value: String(dto.pointValueCents) },
      });
      return { pointValueCents: dto.pointValueCents };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to set the point value');
    }
  }

  private toRow(c: Coupon): CouponRow {
    return {
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: c.value,
      validFrom: c.validFrom?.toISOString() ?? null,
      validUntil: c.validUntil?.toISOString() ?? null,
      locationId: c.locationId,
      lowPeakOnly: c.lowPeakOnly,
      maxRedemptions: c.maxRedemptions,
      redemptions: c.redemptions,
      isActive: c.isActive,
      notes: c.notes,
      isBirthdayReward: c.isBirthdayReward,
    };
  }
}
