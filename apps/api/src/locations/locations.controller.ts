import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { LocationSummary, StaffOption } from '@ta-spiru/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationDetail, LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(): Promise<LocationSummary[]> {
    return this.locationsService.findAll();
  }

  @Get(':locationId')
  findOne(@Param('locationId') locationId: string): Promise<LocationDetail> {
    return this.locationsService.findOne(locationId);
  }

  @Get(':locationId/barbers')
  barbers(@Param('locationId') locationId: string): Promise<StaffOption[]> {
    return this.locationsService.barbers(locationId);
  }

  @Patch(':locationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @Param('locationId') locationId: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationSummary> {
    return this.locationsService.update(locationId, dto);
  }
}
