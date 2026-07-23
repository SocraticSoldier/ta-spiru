import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { TimeBlockRow } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CreateTimeBlockDto, TimeBlocksQueryDto } from './dto/time-blocks.dtos';
import { TimeBlocksService } from './time-blocks.service';

@Controller('time-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeBlocksController {
  constructor(private readonly timeBlocksService: TimeBlocksService) {}

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateTimeBlockDto, @CurrentUser() user: AuthenticatedUser): Promise<TimeBlockRow> {
    return this.timeBlocksService.create(dto, user);
  }

  @Get()
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  list(@Query() query: TimeBlocksQueryDto): Promise<TimeBlockRow[]> {
    return this.timeBlocksService.list(query);
  }

  @Delete(':blockId')
  @Roles(Role.MANAGER)
  remove(@Param('blockId') blockId: string): Promise<{ ok: true }> {
    return this.timeBlocksService.remove(blockId);
  }
}
