import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * In-app notification centre. Roster changes, leave decisions and barber
 * service-change alerts land here; a mobile push transport can fan out from
 * the same records without changing any caller.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<NotificationRow[]> {
    try {
      const rows = await this.prisma.notification.findMany({
        where: { userId: user.id, ...(unreadOnly === 'true' ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load notifications');
    }
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    try {
      const count = await this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
      return { count };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to count notifications');
    }
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    try {
      const n = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
      if (!n) throw new NotFoundException('Notification not found');
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to mark the notification read');
    }
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    try {
      const res = await this.prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: res.count };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to mark notifications read');
    }
  }
}
