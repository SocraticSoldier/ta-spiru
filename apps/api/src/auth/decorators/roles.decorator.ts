import { SetMetadata } from '@nestjs/common';
import { Role } from '@ta-spiru/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: readonly Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
