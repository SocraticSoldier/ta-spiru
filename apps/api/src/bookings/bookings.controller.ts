import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { AddServiceDto, RescheduleBookingDto, UpdateAppointmentStatusDto } from './dto/kiosk.dtos';
import { AppointmentRow, AvailabilitySlot, ComboSlot, MyBookingRow } from '@ta-spiru/shared';
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
    return this.bookingsService.createBooking(dto, user.id, user.role);
  }

  /** Kiosk/reception: set the client status (being served, no-show, late, …). */
  @Patch(':appointmentId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  setStatus(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; status: string }> {
    return this.bookingsService.setStatus(appointmentId, dto.status, user);
  }

  /** Reception/kiosk: move a client to a new time and/or barber. */
  @Patch(':appointmentId/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER)
  reschedule(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppointmentRow> {
    return this.bookingsService.rescheduleBooking(appointmentId, dto, user);
  }

  /** Barber kiosk: add a service to the client in the chair. */
  @Post(':appointmentId/add-service')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARBER)
  addService(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: AddServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ visitGroupId: string; addedAppointmentId: string; endsAt: string; overlapAccepted: boolean }> {
    return this.bookingsService.addServiceMidAppointment(appointmentId, dto, user.id);
  }

  @Post('combo')
  @UseGuards(JwtAuthGuard)
  createComboBooking(
    @Body() dto: CreateComboBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ComboBookingResult> {
    return this.bookingsService.createComboBooking(dto, user.id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  myBookings(@CurrentUser() user: AuthenticatedUser): Promise<MyBookingRow[]> {
    return this.bookingsService.myBookings(user.id);
  }

  @Post(':appointmentId/cancel')
  @UseGuards(JwtAuthGuard)
  cancelBooking(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ cancelled: number }> {
    return this.bookingsService.cancelBooking(appointmentId, user.id);
  }
}
