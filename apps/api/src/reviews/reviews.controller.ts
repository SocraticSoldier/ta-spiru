import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { AppointmentStatus, Role } from '@ta-spiru/database';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { fullName } from '../common/name.util';
import { PrismaService } from '../prisma/prisma.service';

/** The six questions the rating screen asks, in order. */
export const REVIEW_QUESTIONS = [
  'How happy are you with the result?',
  'How was the welcome when you arrived?',
  'Did we start on time?',
  'How clean and comfortable was the shop?',
  'Did your barber listen to what you wanted?',
  'How likely are you to come back?',
] as const;

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overall!: number;

  /** One answer (1–5) per question, in the order of REVIEW_QUESTIONS. */
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  answers!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(600)
  comment?: string;

  /** The customer chose to share it to Google (their account is linked). */
  @IsOptional()
  @IsBoolean()
  shareToGoogle?: boolean;
}

class ModerateReviewDto {
  @IsBoolean()
  isPublished!: boolean;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  /** The questionnaire the rating screen renders. */
  @Get('questions')
  questions(): { questions: readonly string[] } {
    return { questions: REVIEW_QUESTIONS };
  }

  /** Published reviews for a barber — the star rating on the booking screen. */
  @Get('barber/:barberId')
  async forBarber(@Param('barberId') barberId: string): Promise<{
    barberId: string;
    average: number | null;
    count: number;
    reviews: { overall: number; comment: string | null; at: string }[];
  }> {
    try {
      const reviews = await this.prisma.review.findMany({
        where: { barberId, isPublished: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const count = reviews.length;
      const average = count
        ? Math.round((reviews.reduce((t, r) => t + r.overall, 0) / count) * 10) / 10
        : null;
      return {
        barberId,
        average,
        count,
        reviews: reviews.map((r) => ({
          overall: r.overall,
          comment: r.comment,
          at: r.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load reviews');
    }
  }

  /** The customer rates a finished appointment. One review per visit. */
  @Post('appointment/:appointmentId')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; sharedGoogle: boolean }> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, customerId: true, barberId: true, status: true },
      });
      if (!appointment) throw new NotFoundException('Booking not found');
      if (appointment.customerId !== user.id) {
        throw new ForbiddenException('You can only rate your own visit');
      }
      if (appointment.status !== AppointmentStatus.COMPLETED) {
        throw new BadRequestException('You can rate a visit once it is finished');
      }
      const existing = await this.prisma.review.findUnique({ where: { appointmentId } });
      if (existing) throw new BadRequestException('You have already rated this visit');

      const review = await this.prisma.review.create({
        data: {
          appointmentId,
          customerId: user.id,
          barberId: appointment.barberId,
          overall: dto.overall,
          answers: dto.answers,
          comment: dto.comment ?? null,
          sharedGoogle: Boolean(dto.shareToGoogle),
        },
      });

      // A poor score reaches the owner straight away.
      if (dto.overall <= 3) {
        const admins = await this.prisma.user.findMany({
          where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
          select: { id: true },
        });
        await this.prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            kind: 'REVIEW',
            title: `${dto.overall}★ review left`,
            body: dto.comment ?? 'No comment',
          })),
        });
      }
      return { id: review.id, sharedGoogle: review.sharedGoogle };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to save the review');
    }
  }

  /** Admin moderation queue — hide or restore a review. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async list(@Query('barberId') barberId?: string): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.prisma.review.findMany({
        where: barberId ? { barberId } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          barber: { select: { firstName: true, lastName: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        overall: r.overall,
        answers: r.answers,
        comment: r.comment,
        isPublished: r.isPublished,
        sharedGoogle: r.sharedGoogle,
        customerName: fullName(r.customer.firstName, r.customer.lastName),
        barberName: r.barber ? fullName(r.barber.firstName, r.barber.lastName) : null,
        at: r.createdAt.toISOString(),
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list reviews');
    }
  }

  @Patch(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto): Promise<{ ok: true }> {
    try {
      const review = await this.prisma.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException('Review not found');
      await this.prisma.review.update({ where: { id }, data: { isPublished: dto.isPublished } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to moderate the review');
    }
  }
}
