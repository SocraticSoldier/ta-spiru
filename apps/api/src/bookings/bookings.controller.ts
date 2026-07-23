import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { AppointmentRow, AvailabilitySlot, ComboSlot } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { BookingsService, ComboBookingResult } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateComboBookingDto } from './dto/create-combo-booking.dto';
import { DayScheduleQueryDto, FindAvailabilityDto } from './dto/find-availability.dto';
import { FindComboAvailabilityDto } from './dto/find-combo-availability.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('availability')
  findAvailability(@Query() query: FindAvailabilityDto): Promise<AvailabilitySlot[]> {
    return this.bookingsService.findAvailability(query);
  }

  @Get('combo-availability')
  findComboAvailability(@Query() query: FindComboAvailabilityDto): Promise<ComboSlot[]> {
    return this.bookingsService.findComboAvailability(query);
  }

  @Get('day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  daySchedule(@Query() query: DayScheduleQueryDto): Promise<AppointmentRow[]> {
    return this.bookingsService.daySchedule(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppointmentRow> {
    return this.bookingsService.createBooking(dto, user.id);
  }

  @Post('combo')
  @UseGuards(JwtAuthGuard)
  createComboBooking(
    @Body() dto: CreateComboBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ComboBookingResult> {
    return this.bookingsService.createComboBooking(dto, user.id);
  }
}
