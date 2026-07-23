import { Module } from '@nestjs/common';
import { TimeclockController } from './timeclock.controller';
import { TimeclockService } from './timeclock.service';

@Module({
  controllers: [TimeclockController],
  providers: [TimeclockService],
  exports: [TimeclockService],
})
export class TimeclockModule {}
