import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ComboSlot } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { BookingsService, ComboBookingResult } from './bookings.service';
import { CreateComboBookingDto } from './dto/create-combo-booking.dto';
import { FindComboAvailabilityDto } from './dto/find-combo-availability.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('combo-availability')
  findComboAvailability(@Query() query: FindComboAvailabilityDto): Promise<ComboSlot[]> {
    return this.bookingsService.findComboAvailability(query);
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
