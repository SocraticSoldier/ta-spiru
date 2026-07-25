import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from './account/account.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BarbersModule } from './barbers/barbers.module';
import { BookingsModule } from './bookings/bookings.module';
import { validateEnv } from './config/env.validation';
import { CouponsModule } from './coupons/coupons.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { LocationsModule } from './locations/locations.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ServicesModule } from './services/services.module';
import { TeamModule } from './team/team.module';
import { TimeBlocksModule } from './time-blocks/time-blocks.module';
import { TimeclockModule } from './timeclock/timeclock.module';
import { WaitingListModule } from './waiting-list/waiting-list.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    LocationsModule,
    BarbersModule,
    BookingsModule,
    PaymentsModule,
    ReportsModule,
    InventoryModule,
    TimeclockModule,
    OrdersModule,
    QueueModule,
    LoyaltyModule,
    ServicesModule,
    TimeBlocksModule,
    WaitingListModule,
    AuditModule,
    AccountModule,
    CouponsModule,
    TeamModule,
    NotificationsModule,
    ReviewsModule,
    CustomersModule,
  ],
})
export class AppModule {}
