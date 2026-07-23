import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaymentsController } from './payments.controller';
import { TrustPaymentsService } from './trust-payments.service';

@Module({
  imports: [LoyaltyModule],
  controllers: [PaymentsController],
  providers: [TrustPaymentsService],
  exports: [TrustPaymentsService],
})
export class PaymentsModule {}
