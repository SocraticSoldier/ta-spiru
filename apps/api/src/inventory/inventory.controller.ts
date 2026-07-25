import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Product, Role } from '@ta-spiru/database';
import { StockLevelRow } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import {
  BackBarUseDto,
  LevelsQueryDto,
  StockAdjustDto,
  ProductReturnDto,
  StockIntakeDto,
  StockTransferDto,
} from './dto/inventory.dtos';
import { InventoryService } from './inventory.service';

const STAFF_ROLES = [Role.MANAGER, Role.RECEPTIONIST, Role.BARBER, Role.WASH_ATTENDANT] as const;

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('intake')
  @Roles(Role.MANAGER)
  intake(@Body() dto: StockIntakeDto, @CurrentUser() user: AuthenticatedUser): Promise<StockLevelRow> {
    return this.inventoryService.intake(dto, user);
  }

  @Post('transfer')
  @Roles(Role.MANAGER)
  transfer(@Body() dto: StockTransferDto, @CurrentUser() user: AuthenticatedUser): Promise<StockLevelRow[]> {
    return this.inventoryService.transfer(dto, user);
  }

  @Post('adjust')
  @Roles(Role.MANAGER)
  adjust(@Body() dto: StockAdjustDto, @CurrentUser() user: AuthenticatedUser): Promise<StockLevelRow> {
    return this.inventoryService.adjust(dto, user);
  }

  @Post('back-bar-use')
  @Roles(...STAFF_ROLES)
  backBarUse(@Body() dto: BackBarUseDto, @CurrentUser() user: AuthenticatedUser): Promise<StockLevelRow> {
    return this.inventoryService.backBarUse(dto, user);
  }

  @Post('return')
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  productReturn(
    @Body() dto: ProductReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StockLevelRow> {
    return this.inventoryService.productReturn(dto, user);
  }

  @Get('levels')
  @Roles(...STAFF_ROLES)
  levels(@Query() query: LevelsQueryDto): Promise<StockLevelRow[]> {
    return this.inventoryService.levels(query);
  }

  @Get('barcode/:barcode')
  @Roles(...STAFF_ROLES)
  byBarcode(@Param('barcode') barcode: string): Promise<{ product: Product; levels: StockLevelRow[] }> {
    return this.inventoryService.byBarcode(barcode);
  }
}
