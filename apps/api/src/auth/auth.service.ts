import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Prisma, Role, User } from '@ta-spiru/database';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (!user?.passwordHash || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordValid = await compare(dto.password, user.passwordHash);
      if (!passwordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

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
  async stationLogin(dto: StationLoginDto): Promise<LoginResponse> {
    try {
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
          return this.issueSession(candidate, STATION_SESSION_TTL);
        }
      }
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
