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
  Post,
  UseGuards,
} from '@nestjs/common';
import { VehicleSize } from '@ta-spiru/database';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';

class AddVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @Matches(/^[A-Za-z0-9 -]+$/, { message: 'reg may only contain letters, numbers, spaces and dashes' })
  reg!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  make!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  model!: string;

  @IsEnum(VehicleSize)
  size!: VehicleSize;
}

class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1930)
  @Max(2100)
  birthYear?: number;
}

export interface VehicleRow {
  id: string;
  reg: string;
  make: string;
  model: string;
  size: VehicleSize;
}

export interface MemberRow {
  id: string;
  name: string;
  birthYear: number | null;
}

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in customer's saved cars — offered when booking a wash. */
  @Get('vehicles')
  async vehicles(@CurrentUser() user: AuthenticatedUser): Promise<VehicleRow[]> {
    try {
      const rows = await this.prisma.vehicle.findMany({
        where: { ownerId: user.id, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((v) => ({ id: v.id, reg: v.reg, make: v.make, model: v.model, size: v.size }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load your vehicles');
    }
  }

  @Post('vehicles')
  async addVehicle(@Body() dto: AddVehicleDto, @CurrentUser() user: AuthenticatedUser): Promise<VehicleRow> {
    try {
      const reg = dto.reg.trim().toUpperCase();
      const existing = await this.prisma.vehicle.findUnique({
        where: { ownerId_reg: { ownerId: user.id, reg } },
      });
      if (existing) {
        if (existing.isActive) throw new BadRequestException(`${reg} is already on your account`);
        const revived = await this.prisma.vehicle.update({
          where: { id: existing.id },
          data: { isActive: true, make: dto.make, model: dto.model, size: dto.size },
        });
        return { id: revived.id, reg: revived.reg, make: revived.make, model: revived.model, size: revived.size };
      }
      const v = await this.prisma.vehicle.create({
        data: { ownerId: user.id, reg, make: dto.make, model: dto.model, size: dto.size },
      });
      return { id: v.id, reg: v.reg, make: v.make, model: v.model, size: v.size };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to add the vehicle');
    }
  }

  @Delete('vehicles/:id')
  async removeVehicle(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    try {
      const v = await this.prisma.vehicle.findFirst({ where: { id, ownerId: user.id } });
      if (!v) throw new NotFoundException('Vehicle not found');
      await this.prisma.vehicle.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove the vehicle');
    }
  }

  /** Family members on the account. Points always stay on the parent account. */
  @Get('members')
  async members(@CurrentUser() user: AuthenticatedUser): Promise<MemberRow[]> {
    try {
      const rows = await this.prisma.accountMember.findMany({
        where: { accountId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((m) => ({ id: m.id, name: m.name, birthYear: m.birthYear }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load your members');
    }
  }

  @Post('members')
  async addMember(@Body() dto: AddMemberDto, @CurrentUser() user: AuthenticatedUser): Promise<MemberRow> {
    try {
      const m = await this.prisma.accountMember.create({
        data: { accountId: user.id, name: dto.name.trim(), birthYear: dto.birthYear ?? null },
      });
      return { id: m.id, name: m.name, birthYear: m.birthYear };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to add the member');
    }
  }

  @Delete('members/:id')
  async removeMember(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    try {
      const m = await this.prisma.accountMember.findFirst({ where: { id, accountId: user.id } });
      if (!m) throw new NotFoundException('Member not found');
      await this.prisma.accountMember.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove the member');
    }
  }
}
