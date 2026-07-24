import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { VaultController } from './vault.controller';

@Module({
  controllers: [ReportsController, VaultController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
