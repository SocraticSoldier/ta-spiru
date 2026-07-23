import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { TimeBlockRow } from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { addMinutes, zonedTimeToUtc } from '../bookings/utils/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { fullName } from '../common/name.util';
import { CreateTimeBlockDto, TimeBlocksQueryDto } from './dto/time-blocks.dtos';

@Injectable()
export class TimeBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTimeBlockDto, actor: AuthenticatedUser): Promise<TimeBlockRow> {
    try {
      const startsAt = new Date(dto.startsAt);
      const endsAt = new Date(dto.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        throw new BadRequestException('endsAt must be after startsAt');
      }
      if (dto.barberId) {
        const barber = await this.prisma.user.findFirst({
          where: { id: dto.barberId, role: Role.BARBER, locationId: dto.locationId, isActive: true },
          select: { id: true },
        });
        if (!barber) {
          throw new NotFoundException(`Barber ${dto.barberId} not found at location ${dto.locationId}`);
        }
      }

      const block = await this.prisma.timeBlock.create({
        data: {
          locationId: dto.locationId,
          barberId: dto.barberId ?? null,
          startsAt,
          endsAt,
          reason: dto.reason ?? null,
          createdById: actor.id,
        },
        include: { barber: { select: { firstName: true, lastName: true } } },
      });
      return this.toRow(block);
    } catch (error) {
      throw this.wrap(error, 'Failed to create time block');
    }
  }

  async list(query: TimeBlocksQueryDto): Promise<TimeBlockRow[]> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: query.locationId },
        select: { timezone: true },
      });
      if (!location) {
        throw new NotFoundException(`Location ${query.locationId} not found`);
      }
      const dayStart = zonedTimeToUtc(query.date, '00:00', location.timezone);
      const dayEnd = addMinutes(dayStart, 24 * 60);

      const blocks = await this.prisma.timeBlock.findMany({
        where: {
          locationId: query.locationId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        include: { barber: { select: { firstName: true, lastName: true } } },
        orderBy: { startsAt: 'asc' },
      });
      return blocks.map((block) => this.toRow(block));
    } catch (error) {
      throw this.wrap(error, 'Failed to list time blocks');
    }
  }

  async remove(blockId: string): Promise<{ ok: true }> {
    try {
      const block = await this.prisma.timeBlock.findUnique({ where: { id: blockId }, select: { id: true } });
      if (!block) {
        throw new NotFoundException(`Time block ${blockId} not found`);
      }
      await this.prisma.timeBlock.delete({ where: { id: blockId } });
      return { ok: true };
    } catch (error) {
      throw this.wrap(error, 'Failed to delete time block');
    }
  }

  private toRow(block: {
    id: string;
    locationId: string;
    barberId: string | null;
    barber: { firstName: string; lastName: string } | null;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }): TimeBlockRow {
    return {
      id: block.id,
      locationId: block.locationId,
      barberId: block.barberId,
      barberName: block.barber ? fullName(block.barber.firstName, block.barber.lastName) : null,
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
      reason: block.reason,
    };
  }

  private wrap(error: unknown, fallback: string): HttpException {
    return error instanceof HttpException ? error : new InternalServerErrorException(fallback);
  }
}
