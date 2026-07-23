import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { QueueStatus, Role } from '@ta-spiru/database';
import { JoinQueueResponse, QueueEntryView, QueueSnapshot } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { JoinQueueDto, QueueQueryDto, WalkInQueueDto } from './dto/queue.dtos';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  snapshot(@Query() query: QueueQueryDto): Promise<QueueSnapshot> {
    return this.queueService.snapshot(query.locationId);
  }

  /** Public read-only feed for the in-store TV displays, addressed by branch slug. */
  @Get('board/:locationSlug')
  async board(@Param('locationSlug') locationSlug: string): Promise<QueueSnapshot> {
    const location = await this.prisma.location.findUnique({
      where: { slug: locationSlug },
      select: { id: true },
    });
    if (!location) {
      return this.queueService.snapshot(locationSlug); // throws NotFoundException with a clear message
    }
    return this.queueService.snapshot(location.id);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async join(
    @Body() dto: JoinQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JoinQueueResponse> {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    const displayName = profile ? `${profile.firstName} ${profile.lastName.charAt(0)}.` : 'Guest';
    return this.queueService.join(dto, displayName, user.id);
  }

  @Post('walk-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  walkIn(@Body() dto: WalkInQueueDto): Promise<JoinQueueResponse> {
    return this.queueService.join(dto, dto.displayName, null);
  }

  @Post(':entryId/call')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  call(@Param('entryId') entryId: string, @CurrentUser() user: AuthenticatedUser): Promise<QueueEntryView> {
    return this.queueService.transition(entryId, QueueStatus.CALLED, user);
  }

  @Post(':entryId/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  start(@Param('entryId') entryId: string, @CurrentUser() user: AuthenticatedUser): Promise<QueueEntryView> {
    return this.queueService.transition(entryId, QueueStatus.IN_SERVICE, user);
  }

  @Post(':entryId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT)
  complete(@Param('entryId') entryId: string, @CurrentUser() user: AuthenticatedUser): Promise<QueueEntryView> {
    return this.queueService.transition(entryId, QueueStatus.COMPLETED, user);
  }

  @Post(':entryId/leave')
  @UseGuards(JwtAuthGuard)
  leave(@Param('entryId') entryId: string, @CurrentUser() user: AuthenticatedUser): Promise<QueueEntryView> {
    return this.queueService.transition(entryId, QueueStatus.LEFT, user);
  }
}
