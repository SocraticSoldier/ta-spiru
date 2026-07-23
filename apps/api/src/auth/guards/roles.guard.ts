import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@ta-spiru/database';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../interfaces/auth.interfaces';

const LOCATION_SCOPED_ROLES: readonly Role[] = [
  Role.MANAGER,
  Role.RECEPTIONIST,
  Role.BARBER,
  Role.WASH_ATTENDANT,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('No authenticated user on request');
    }

    if (user.role === Role.ADMIN) {
      return true;
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Role ${user.role} cannot access this resource`);
    }

    if (LOCATION_SCOPED_ROLES.includes(user.role)) {
      const targetLocationId = this.resolveTargetLocationId(request);
      if (targetLocationId !== null && user.locationId !== null && targetLocationId !== user.locationId) {
        throw new ForbiddenException('Cross-location access denied');
      }
    }

    return true;
  }

  private resolveTargetLocationId(request: AuthenticatedRequest): string | null {
    const fromParams = (request.params as Record<string, string | undefined>)['locationId'];
    const fromQuery = (request.query as Record<string, unknown>)['locationId'];
    const fromBody = (request.body as Record<string, unknown> | undefined)?.['locationId'];
    const candidate = fromParams ?? fromQuery ?? fromBody;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }
}
