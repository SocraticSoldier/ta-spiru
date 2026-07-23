import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { TrustPaymentsService } from './trust-payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [TrustPaymentsService],
  exports: [TrustPaymentsService],
})
export class PaymentsModule {}
