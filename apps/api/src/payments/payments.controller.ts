import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  /** Public endpoint for Trust Payments URL notifications; authenticated by the site-security digest. */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: TrustPaymentsWebhookDto): Promise<string> {
    await this.trustPaymentsService.handlePaymentSuccess(payload);
    return 'OK';
  }
}
