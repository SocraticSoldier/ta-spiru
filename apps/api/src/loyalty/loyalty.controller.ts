import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { LoyaltyPass, LoyaltyScanResult, LoyaltySummary } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { RedeemPointsDto, ScanPassDto } from './dto/loyalty.dtos';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<LoyaltySummary> {
    return this.loyaltyService.me(user.id);
  }

  @Post('redeem')
  redeem(@Body() dto: RedeemPointsDto, @CurrentUser() user: AuthenticatedUser): Promise<LoyaltySummary> {
    return this.loyaltyService.redeem(user.id, dto);
  }

  @Get('pass')
  pass(@CurrentUser() user: AuthenticatedUser): Promise<LoyaltyPass> {
    return this.loyaltyService.pass(user.id);
  }

  @Post('scan')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  scan(@Body() dto: ScanPassDto): Promise<LoyaltyScanResult> {
    return this.loyaltyService.scan(dto.qrPayload);
  }
}
