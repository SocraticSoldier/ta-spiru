import { Module } from '@nestjs/common';
import { WaitingListController } from './waiting-list.controller';

@Module({
  controllers: [WaitingListController],
})
export class WaitingListModule {}
