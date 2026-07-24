import { Module } from '@nestjs/common';
import { BarbersController } from './barbers.controller';

@Module({
  controllers: [BarbersController],
})
export class BarbersModule {}
