import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StationLoginDto } from './dto/station-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser, LoginResponse } from './interfaces/auth.interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  /** Barber-operated outlets: the shared screen unlocks with a station PIN. */
  @Post('station-login')
  @HttpCode(HttpStatus.OK)
  stationLogin(@Body() dto: StationLoginDto): Promise<LoginResponse> {
    return this.authService.stationLogin(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<LoginResponse['user']> {
    return this.authService.me(user.id);
  }
}
