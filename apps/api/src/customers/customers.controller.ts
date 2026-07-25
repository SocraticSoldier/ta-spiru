import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactChannel, Prisma, Role } from '@ta-spiru/database';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';

class UpdateProfileDto {
  @IsOptional()
  @IsISO8601()
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workplace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  staffNumber?: string;

  /** How they want reminders. An SMS still goes out if their barber is off. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(ContactChannel, { each: true })
  contactChannels?: ContactChannel[];
}

class FlagStaffDto {
  @IsBoolean()
  isTaSpiruStaff!: boolean;
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in customer's own profile and reminder preferences. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    try {
      const u = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          birthday: true,
          occupation: true,
          workplace: true,
          staffNumber: true,
          isTaSpiruStaff: true,
          contactChannels: true,
        },
      });
      return {
        ...u,
        name: fullName(u.firstName, u.lastName),
        birthday: u.birthday?.toISOString().slice(0, 10) ?? null,
        // Stated for the app: reminders follow the chosen channels, but a barber
        // falling ill always triggers an SMS so nobody turns up to a closed chair.
        alwaysSmsOnBarberUnavailable: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load your profile');
    }
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(dto.birthday !== undefined ? { birthday: new Date(dto.birthday) } : {}),
          ...(dto.occupation !== undefined ? { occupation: dto.occupation } : {}),
          ...(dto.workplace !== undefined ? { workplace: dto.workplace } : {}),
          ...(dto.staffNumber !== undefined ? { staffNumber: dto.staffNumber } : {}),
          ...(dto.contactChannels !== undefined ? { contactChannels: dto.contactChannels } : {}),
        },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update your profile');
    }
  }

  /**
   * Admin customer search across every detail, split into the three groups the
   * office keeps apart: paying customers, neighbouring-company staff on a
   * discount, and Ta' Spiru's own staff. Money never appears here.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  async search(
    @Query('q') q?: string,
    @Query('group') group?: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      const term = (q ?? '').trim();
      // Each word must match somewhere (any field), so a full name like "Wendy
      // Borg" matches firstName+lastName even though neither field alone
      // contains the two-word string.
      const words = term.split(/\s+/).filter(Boolean);
      const wordFilter = (word: string): Prisma.UserWhereInput => {
        const contains = { contains: word, mode: Prisma.QueryMode.insensitive };
        return {
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
            { phone: contains },
            { occupation: contains },
            { workplace: contains },
            { staffNumber: contains },
            { vehicles: { some: { reg: contains } } },
            { accountMembers: { some: { name: contains } } },
          ],
        };
      };
      const groupFilter: Prisma.UserWhereInput =
        group === 'staff'
          ? { isTaSpiruStaff: true }
          : group === 'company'
            ? { isTaSpiruStaff: false, workplace: { not: null } }
            : group === 'customer'
              ? { isTaSpiruStaff: false, workplace: null }
              : {};
      const customers = await this.prisma.user.findMany({
        where: {
          role: Role.CUSTOMER,
          ...groupFilter,
          ...(words.length > 0 ? { AND: words.map(wordFilter) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          vehicles: { where: { isActive: true }, select: { reg: true, make: true, model: true } },
          accountMembers: { select: { name: true } },
          loyaltyAccount: { select: { tier: true, balancePoints: true } },
          _count: { select: { customerAppointments: true } },
        },
      });
      return customers.map((c) => ({
        id: c.id,
        name: fullName(c.firstName, c.lastName),
        email: c.email,
        phone: c.phone,
        group: c.isTaSpiruStaff ? 'TA_SPIRU_STAFF' : c.workplace ? 'COMPANY_STAFF' : 'CUSTOMER',
        workplace: c.workplace,
        occupation: c.occupation,
        staffNumber: c.staffNumber,
        birthday: c.birthday?.toISOString().slice(0, 10) ?? null,
        vehicles: c.vehicles.map((v) => `${v.reg} · ${v.make} ${v.model}`),
        members: c.accountMembers.map((m) => m.name),
        loyaltyTier: c.loyaltyAccount?.tier ?? null,
        loyaltyPoints: c.loyaltyAccount?.balancePoints ?? 0,
        visits: c._count.customerAppointments,
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to search customers');
    }
  }

  /** Mark (or clear) a customer as Ta' Spiru staff — gates the internal discount. */
  @Patch(':id/staff-flag')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async setStaffFlag(@Param('id') id: string, @Body() dto: FlagStaffDto): Promise<{ ok: true }> {
    try {
      const customer = await this.prisma.user.findFirst({ where: { id, role: Role.CUSTOMER } });
      if (!customer) throw new NotFoundException('Customer not found');
      await this.prisma.user.update({ where: { id }, data: { isTaSpiruStaff: dto.isTaSpiruStaff } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update the customer');
    }
  }
}
