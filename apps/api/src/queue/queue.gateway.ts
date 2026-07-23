import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { QueueUpdatedEvent } from '@ta-spiru/shared';
import type Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

const ROOM = (locationId: string): string => `location:${locationId}`;

interface SubscribePayload {
  locationId?: string;
}

/**
 * Fans queue updates out to apps and in-store TV displays. Events are relayed
 * through Redis pub/sub so every API instance broadcasts the same state.
 */
@WebSocketGateway({ namespace: '/queue', cors: { origin: true } })
export class QueueGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(QueueGateway.name);
  private subscriber: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redisService.duplicateForSubscription();
    try {
      await this.subscriber.psubscribe('queue:*');
      this.subscriber.on('pmessage', (_pattern: string, _channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as QueueUpdatedEvent;
          this.server.to(ROOM(event.snapshot.locationId)).emit('queue.updated', event.snapshot);
        } catch {
          this.logger.warn('Discarded malformed queue event');
        }
      });
    } catch (error) {
      this.logger.error(`Redis subscription unavailable: ${String(error)}`);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ): Promise<{ ok: boolean }> {
    if (!payload.locationId) {
      return { ok: false };
    }
    await client.join(ROOM(payload.locationId));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ): Promise<{ ok: boolean }> {
    if (!payload.locationId) {
      return { ok: false };
    }
    await client.leave(ROOM(payload.locationId));
    return { ok: true };
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
  }
}
