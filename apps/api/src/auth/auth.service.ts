import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  HttpException as NestHttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { LoginKind, Prisma, Role, User } from '@ta-spiru/database';
import { PrismaService } from '../prisma/prisma.service';
import { LoginGuardService, type AttemptContext } from './login-guard.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StationLoginDto } from './dto/station-login.dto';
import { JwtPayload, LoginResponse } from './interfaces/auth.interfaces';

/** A station session is short so an unattended screen locks itself out. */
const STATION_SESSION_TTL = '45m';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loginGuard: LoginGuardService,
  ) {}

  /** 429 with how long to wait — the same answer whether the account exists. */
  private lockedOut(retryAfterSec: number): NestHttpException {
    const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
    return new NestHttpException(
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async login(dto: LoginDto, context: AttemptContext = {}): Promise<LoginResponse> {
    try {
      const lock = await this.loginGuard.check(LoginKind.PASSWORD, dto.email);
      if (lock.locked) {
        throw this.lockedOut(lock.retryAfterSec);
      }

      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      const passwordValid =
        user?.passwordHash && user.isActive ? await compare(dto.password, user.passwordHash) : false;

      if (!passwordValid || !user) {
        await this.loginGuard.record(LoginKind.PASSWORD, dto.email, false, context);
        throw new UnauthorizedException('Invalid credentials');
      }

      await this.loginGuard.record(LoginKind.PASSWORD, dto.email, true, context, user.id);
      return this.issueSession(user);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Login failed');
    }
  }

  /** Customer self-registration; staff accounts are provisioned by admins. */
  async register(dto: RegisterDto): Promise<LoginResponse> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          role: Role.CUSTOMER,
        },
      });
      return this.issueSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Registration failed');
    }
  }

  /**
   * Station sign-in for the barber-operated outlets: the shared screen sends the
   * branch and the barber's PIN, and gets a short-lived session for that barber.
   * The screen signs itself out again once payment is taken, ready for the next.
   */
  async stationLogin(dto: StationLoginDto, context: AttemptContext = {}): Promise<LoginResponse> {
    try {
      // Counted per branch: the PIN identifies the barber, so the screen itself
      // is the thing being guessed at.
      const lock = await this.loginGuard.check(LoginKind.STATION_PIN, dto.locationId);
      if (lock.locked) {
        throw this.lockedOut(lock.retryAfterSec);
      }

      const location = await this.prisma.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, isBarberOperated: true, isActive: true },
      });
      if (!location || !location.isActive) {
        throw new NotFoundException('Branch not found');
      }
      if (!location.isBarberOperated) {
        throw new BadRequestException('This branch has a reception desk; sign in with email and password');
      }
      const candidates = await this.prisma.user.findMany({
        where: {
          locationId: dto.locationId,
          role: { in: [Role.BARBER, Role.WASH_ATTENDANT] },
          isActive: true,
          pinHash: { not: null },
        },
      });
      // PINs are per-branch, so the match identifies the barber at that screen.
      for (const candidate of candidates) {
        if (candidate.pinHash && (await compare(dto.pin, candidate.pinHash))) {
          await this.loginGuard.record(
            LoginKind.STATION_PIN,
            dto.locationId,
            true,
            context,
            candidate.id,
          );
          return this.issueSession(candidate, STATION_SESSION_TTL);
        }
      }
      await this.loginGuard.record(LoginKind.STATION_PIN, dto.locationId, false, context);
      throw new UnauthorizedException('PIN not recognised at this branch');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Station sign-in failed');
    }
  }

  private async issueSession(user: User, expiresIn?: string): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    };
    const accessToken = await this.jwtService.signAsync(
      payload,
      expiresIn ? { expiresIn } : undefined,
    );
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        locationId: user.locationId,
      },
    };
  }

  async me(userId: string): Promise<LoginResponse['user']> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Account not found or deactivated');
      }
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        locationId: user.locationId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to load account');
    }
  }
}
