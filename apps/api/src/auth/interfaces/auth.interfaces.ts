import { Role } from '@ta-spiru/database';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  locationId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  locationId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser & { firstName: string; lastName: string };
}
