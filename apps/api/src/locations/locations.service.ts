import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Location, OpeningHours, Prisma, Resource, ResourceKind, Role } from '@ta-spiru/database';
import { LocationSummary, StaffOption } from '@ta-spiru/shared';
import { PrismaService } from '../prisma/prisma.service';
import { fullName } from '../common/name.util';
import { UpdateLocationDto } from './dto/update-location.dto';

export interface LocationDetail extends LocationSummary {
  phone: string | null;
  openingHours: Pick<OpeningHours, 'weekday' | 'opensAt' | 'closesAt'>[];
  resources: Pick<Resource, 'id' | 'kind' | 'name'>[];
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<LocationSummary[]> {
    try {
      const locations = await this.prisma.location.findMany({
        where: { isActive: true },
        include: { resources: { where: { isActive: true }, select: { kind: true } } },
        orderBy: { name: 'asc' },
      });
      return locations.map((location) => this.toSummary(location, location.resources));
    } catch {
      throw new InternalServerErrorException('Failed to list locations');
    }
  }

  async findOne(locationId: string): Promise<LocationDetail> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        include: {
          openingHours: { orderBy: { weekday: 'asc' }, select: { weekday: true, opensAt: true, closesAt: true } },
          resources: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, kind: true, name: true },
          },
        },
      });
      if (!location) {
        throw new NotFoundException(`Location ${locationId} not found`);
      }
      return {
        ...this.toSummary(location, location.resources),
        phone: location.phone,
        openingHours: location.openingHours,
        resources: location.resources,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to load location');
    }
  }

  async barbers(locationId: string): Promise<StaffOption[]> {
    try {
      const barbers = await this.prisma.user.findMany({
        where: { locationId, role: Role.BARBER, isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, locationId: true },
        orderBy: { firstName: 'asc' },
      });
      return barbers.map((barber) => ({
        id: barber.id,
        name: fullName(barber.firstName, barber.lastName),
        role: barber.role,
        locationId: barber.locationId,
      }));
    } catch {
      throw new InternalServerErrorException('Failed to list barbers');
    }
  }

  async update(locationId: string, dto: UpdateLocationDto): Promise<LocationSummary> {
    try {
      const location = await this.prisma.location.update({
        where: { id: locationId },
        data: dto,
        include: { resources: { where: { isActive: true }, select: { kind: true } } },
      });
      return this.toSummary(location, location.resources);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Location ${locationId} not found`);
      }
      throw new InternalServerErrorException('Failed to update location');
    }
  }

  private toSummary(
    location: Location,
    resources: readonly Pick<Resource, 'kind'>[],
  ): LocationSummary {
    return {
      id: location.id,
      slug: location.slug,
      name: location.name,
      address: location.address,
      timezone: location.timezone,
      chairCount: resources.filter((resource) => resource.kind === ResourceKind.BARBER_CHAIR).length,
      bayCount: resources.filter((resource) => resource.kind === ResourceKind.WASH_BAY).length,
      isBarberOperated: location.isBarberOperated,
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }
}
