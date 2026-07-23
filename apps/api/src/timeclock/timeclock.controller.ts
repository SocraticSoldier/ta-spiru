import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { KioskStaffMember, PunchResult, TimeEntryRow } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { EntriesQueryDto, PunchDto, SetPinDto, UpdateTimeEntryDto } from './dto/timeclock.dtos';
import { TimeclockService } from './timeclock.service';

@Controller('timeclock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeclockController {
  constructor(private readonly timeclockService: TimeclockService) {}

  /** Called from the in-store kiosk session; the PIN identifies the individual staff member. */
  @Post('punch')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  punch(@Body() dto: PunchDto): Promise<PunchResult> {
    return this.timeclockService.punch(dto);
  }

  /** Kiosk staff grid for a branch (device session scopes the location). */
  @Get('staff')
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  roster(@Query('locationId') locationId: string): Promise<KioskStaffMember[]> {
    return this.timeclockService.roster(locationId);
  }

  @Post('pin')
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  setPin(@Body() dto: SetPinDto, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    return this.timeclockService.setPin(dto, user);
  }

  @Get('entries')
  @Roles(Role.MANAGER)
  entries(@Query() query: EntriesQueryDto): Promise<TimeEntryRow[]> {
    return this.timeclockService.entries(query);
  }

  @Patch('entries/:entryId')
  @Roles(Role.MANAGER)
  updateEntry(
    @Param('entryId') entryId: string,
    @Body() dto: UpdateTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimeEntryRow> {
    return this.timeclockService.updateEntry(entryId, dto, user);
  }
}
