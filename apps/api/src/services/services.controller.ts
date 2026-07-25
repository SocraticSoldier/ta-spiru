import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma, Role, ServiceKind } from '@ta-spiru/database';
import { ServiceSummary } from '@ta-spiru/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServiceDto,
  ReorderServicesDto,
  SetTiersDto,
  UpdateServiceDto,
} from './dto/services-admin.dtos';

const TIER_ORDER = { JUNIOR: 0, NORMAL: 1, SENIOR: 2 } as const;

@Controller('services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalog for the storefront and mobile app. */
  @Get()
  async list(@Query('kind') kind?: string): Promise<ServiceSummary[]> {
    try {
      const kindFilter =
        kind === ServiceKind.BARBER || kind === ServiceKind.WASH ? (kind as ServiceKind) : undefined;
      const services = await this.prisma.service.findMany({
        where: { isActive: true, ...(kindFilter ? { kind: kindFilter } : {}) },
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { priceCents: 'asc' }],
        include: { tiers: true },
      });
      return services.map((service) => this.toSummary(service));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list services');
    }
  }

  /** Create a service (admin/manager). */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateServiceDto): Promise<ServiceSummary> {
    try {
      const existing = await this.prisma.service.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new BadRequestException(`A service with slug "${dto.slug}" already exists`);

      const locationIds = await this.resolveLocationIds(dto.locationIds, dto.kind);
      const service = await this.prisma.service.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          kind: dto.kind,
          durationMin: dto.durationMin,
          priceCents: dto.priceCents,
          ledgerTag: dto.ledgerTag,
          description: dto.description ?? null,
          photoUrl: dto.photoUrl ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isComboEligible: dto.isComboEligible ?? false,
          isQuoteOnly: dto.isQuoteOnly ?? false,
          locations: { create: locationIds.map((locationId) => ({ locationId })) },
        },
        include: { tiers: true },
      });
      return this.toSummary(service);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create service');
    }
  }

  /** Update a service (admin/manager). Pass locationIds to replace availability. */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdateServiceDto): Promise<ServiceSummary> {
    try {
      const found = await this.prisma.service.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Service not found');

      const { locationIds, ...fields } = dto;
      const service = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.service.update({
          where: { id },
          data: fields,
          include: { tiers: true },
        });
        if (locationIds) {
          const ids = await this.resolveLocationIds(locationIds, updated.kind);
          await tx.locationService.deleteMany({ where: { serviceId: id } });
          await tx.locationService.createMany({
            data: ids.map((locationId) => ({ locationId, serviceId: id })),
          });
        }
        return updated;
      });
      return this.toSummary(service);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update service');
    }
  }

  /** Set the order services appear in, top to bottom. */
  @Put('order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async reorder(@Body() dto: ReorderServicesDto): Promise<{ ordered: number }> {
    try {
      const found = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds } },
        select: { id: true },
      });
      if (found.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services do not exist');
      }
      await this.prisma.$transaction(
        dto.serviceIds.map((id, index) =>
          this.prisma.service.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );
      return { ordered: dto.serviceIds.length };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to reorder the services');
    }
  }

  /** Retire a service (soft delete). */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    try {
      const found = await this.prisma.service.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Service not found');
      await this.prisma.service.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove service');
    }
  }

  /** Set the Junior/Normal/Senior price tiers for a barber service. */
  @Put(':id/tiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  async setTiers(@Param('id') id: string, @Body() dto: SetTiersDto): Promise<ServiceSummary> {
    try {
      const found = await this.prisma.service.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Service not found');
      if (found.kind !== ServiceKind.BARBER) {
        throw new BadRequestException('Only barber services have seniority tiers');
      }
      const seen = new Set(dto.tiers.map((t) => t.seniority));
      if (seen.size !== dto.tiers.length) {
        throw new BadRequestException('Duplicate seniority in tiers');
      }
      const service = await this.prisma.$transaction(async (tx) => {
        await tx.serviceTier.deleteMany({ where: { serviceId: id } });
        for (const t of dto.tiers) {
          await tx.serviceTier.create({
            data: {
              serviceId: id,
              seniority: t.seniority,
              priceCents: t.priceCents,
              durationMin: t.durationMin,
              serviceNo: t.serviceNo ?? null,
            },
          });
        }
        return tx.service.findUniqueOrThrow({ where: { id }, include: { tiers: true } });
      });
      return this.toSummary(service);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to set tiers');
    }
  }

  private async resolveLocationIds(requested: string[] | undefined, kind: ServiceKind): Promise<string[]> {
    if (requested && requested.length > 0) {
      const found = await this.prisma.location.findMany({
        where: { id: { in: requested } },
        select: { id: true },
      });
      if (found.length !== requested.length) {
        throw new BadRequestException('One or more locationIds do not exist');
      }
      return found.map((l) => l.id);
    }
    // Default: barber services at every branch; wash services must be specified.
    if (kind === ServiceKind.BARBER) {
      return (await this.prisma.location.findMany({ select: { id: true } })).map((l) => l.id);
    }
    return [];
  }

  private toSummary(
    service: Prisma.ServiceGetPayload<{ include: { tiers: true } }>,
  ): ServiceSummary {
    return {
      id: service.id,
      slug: service.slug,
      name: service.name,
      kind: service.kind,
      durationMin: service.durationMin,
      priceCents: service.priceCents,
      isComboEligible: service.isComboEligible,
      isQuoteOnly: service.isQuoteOnly,
      tiers: service.tiers
        .slice()
        .sort((a, b) => TIER_ORDER[a.seniority] - TIER_ORDER[b.seniority])
        .map((t) => ({ seniority: t.seniority, priceCents: t.priceCents, durationMin: t.durationMin })),
    };
  }
}
