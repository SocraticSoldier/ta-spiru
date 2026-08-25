import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromoRail, Role, SocialNetwork } from '@ta-spiru/database';
import { isVimeo } from '@ta-spiru/shared';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class UpsertPromoDto {
  @IsEnum(PromoRail)
  rail!: PromoRail;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  /** Optional for a Vimeo tile, which brings its own frame. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  videoUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  linkUrl!: string;

  @IsOptional()
  @IsEnum(SocialNetwork)
  network?: SocialNetwork;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}

export interface PromoTileRow {
  id: string;
  rail: PromoRail;
  title: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string;
  network: SocialNetwork | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
}

@Controller('promos')
export class PromosController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The tiles for one rail, or both. Public — this is the site's own
   * advertising, and the storefront renders it for signed-out visitors.
   *
   * Only what is live right now comes back: inactive tiles and campaigns
   * outside their run dates are filtered here rather than in the browser.
   */
  @Get()
  async list(@Query('rail') rail?: string): Promise<PromoTileRow[]> {
    try {
      const now = new Date();
      const railFilter =
        rail === PromoRail.LEFT_AD || rail === PromoRail.RIGHT_SOCIAL ? (rail as PromoRail) : undefined;
      const tiles = await this.prisma.promoTile.findMany({
        where: {
          isActive: true,
          ...(railFilter ? { rail: railFilter } : {}),
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: [{ rail: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      return tiles.map((t) => this.toRow(t));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load the promo tiles');
    }
  }

  /** Everything, live or not — the admin page needs the drafts too. */
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async listAll(): Promise<PromoTileRow[]> {
    try {
      const tiles = await this.prisma.promoTile.findMany({
        orderBy: [{ rail: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      return tiles.map((t) => this.toRow(t));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to load the promo tiles');
    }
  }

  /**
   * Counts a click and hands back where to go.
   *
   * The browser could link straight out, but then nobody would ever know which
   * ad or reel was worth the space. Deliberately never redirects to anything
   * but the tile's own stored URL.
   */
  @Post(':id/click')
  @HttpCode(HttpStatus.OK)
  async click(@Param('id') id: string): Promise<{ linkUrl: string }> {
    try {
      const tile = await this.prisma.promoTile.update({
        where: { id },
        data: { clicks: { increment: 1 } },
        select: { linkUrl: true },
      });
      return { linkUrl: tile.linkUrl };
    } catch {
      throw new NotFoundException('Promo tile not found');
    }
  }

  /** Fire-and-forget view counter; failure here must never break the page. */
  @Post(':id/impression')
  @HttpCode(HttpStatus.NO_CONTENT)
  async impression(@Param('id') id: string): Promise<void> {
    await this.prisma.promoTile
      .update({ where: { id }, data: { impressions: { increment: 1 } } })
      .catch(() => undefined);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async create(@Body() dto: UpsertPromoDto): Promise<PromoTileRow> {
    try {
      const tile = await this.prisma.promoTile.create({ data: this.toData(dto) });
      return this.toRow(tile);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create the promo tile');
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertPromoDto>): Promise<PromoTileRow> {
    try {
      const tile = await this.prisma.promoTile.update({
        where: { id },
        data: {
          ...(dto.rail !== undefined ? { rail: dto.rail } : {}),
          ...(dto.title !== undefined ? { title: dto.title || null } : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
          ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl || null } : {}),
          ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl } : {}),
          ...(dto.network !== undefined ? { network: dto.network ?? null } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
          ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        },
      });
      return this.toRow(tile);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new NotFoundException('Promo tile not found');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.promoTile.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('Promo tile not found');
    }
  }

  private toData(dto: UpsertPromoDto) {
    // A tile has to be able to show something: either a poster, or a Vimeo
    // link that renders its own frame.
    if (!dto.imageUrl && !isVimeo(dto.videoUrl)) {
      throw new BadRequestException('A tile needs a poster image, or a Vimeo link to play');
    }
    return {
      rail: dto.rail,
      title: dto.title ?? null,
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      linkUrl: dto.linkUrl,
      // The badge only means anything on the social rail.
      network: dto.rail === PromoRail.RIGHT_SOCIAL ? (dto.network ?? null) : null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    };
  }

  private toRow(t: {
    id: string;
    rail: PromoRail;
    title: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    linkUrl: string;
    network: SocialNetwork | null;
    sortOrder: number;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    impressions: number;
    clicks: number;
  }): PromoTileRow {
    return {
      id: t.id,
      rail: t.rail,
      title: t.title,
      imageUrl: t.imageUrl,
      videoUrl: t.videoUrl,
      linkUrl: t.linkUrl,
      network: t.network,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      startsAt: t.startsAt?.toISOString() ?? null,
      endsAt: t.endsAt?.toISOString() ?? null,
      impressions: t.impressions,
      clicks: t.clicks,
    };
  }
}
