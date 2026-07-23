import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { TransactionRow } from '@ta-spiru/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { TrustPaymentsWebhookDto } from './dto/trust-payments-webhook.dto';
import { PaymentIntent } from './interfaces/trust-payments.interfaces';
import { TrustPaymentsService } from './trust-payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly trustPaymentsService: TrustPaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentIntent> {
    return this.trustPaymentsService.createPaymentIntent({
      amountCents: dto.amountCents,
      currency: dto.currency,
      channel: dto.channel,
      splitLedgerTags: dto.splitLedgerTags,
      customerId: user.id,
      appointmentIds: dto.appointmentIds,
      orderIds: dto.orderIds,
    });
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listTransactions(
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ): Promise<TransactionRow[]> {
    return this.trustPaymentsService.listTransactions(Math.min(Math.max(limit, 1), 100));
  }

  /** Public endpoint for Trust Payments URL notifications; authenticated by the site-security digest. */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: TrustPaymentsWebhookDto): Promise<string> {
    await this.trustPaymentsService.handlePaymentSuccess(payload);
    return 'OK';
  }
}
