import { Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Channel names for the Phase 3 virtual-queue WebSocket fan-out. */
export const QUEUE_CHANNEL = (locationId: string): string => `queue:${locationId}`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  async publish<T extends Record<string, unknown>>(channel: string, event: T): Promise<void> {
    try {
      await this.client.publish(channel, JSON.stringify(event));
    } catch {
      throw new InternalServerErrorException(`Failed to publish event on channel ${channel}`);
    }
  }

  duplicateForSubscription(): Redis {
    return this.client.duplicate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
