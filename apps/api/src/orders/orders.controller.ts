import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { EcomCheckoutResponse, OrderRow, PosCheckoutResponse } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CreateEcomOrderDto, CreatePosOrderDto } from './dto/orders.dtos';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('pos')
  @Roles(Role.MANAGER, Role.RECEPTIONIST)
  createPosOrder(
    @Body() dto: CreatePosOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PosCheckoutResponse> {
    return this.ordersService.createPosOrder(dto, user);
  }

  /** Online storefront checkout for authenticated customers. */
  @Post()
  createEcommerceOrder(
    @Body() dto: CreateEcomOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcomCheckoutResponse> {
    return this.ordersService.createEcommerceOrder(dto, user.id);
  }

  @Get('mine')
  myOrders(@CurrentUser() user: AuthenticatedUser): Promise<OrderRow[]> {
    return this.ordersService.myOrders(user.id);
  }
}
