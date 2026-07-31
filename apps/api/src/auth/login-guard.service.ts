import { Injectable } from '@nestjs/common';
import { LoginKind } from '@ta-spiru/database';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How many failures in a row before the door shuts, and for how long.
 *
 * The station PIN is the tighter of the two on purpose: it is four digits, so
 * without a lockout the whole keyspace is walkable in an afternoon. A password
 * gets a little more room because staff mistype them and a wrong password is
 * far less likely to be a guess that lands.
 */
const POLICY: Readonly<Record<LoginKind, { maxFailures: number; windowMin: number; lockMin: number }>> = {
  [LoginKind.STATION_PIN]: { maxFailures: 5, windowMin: 15, lockMin: 15 },
  [LoginKind.PASSWORD]: { maxFailures: 10, windowMin: 15, lockMin: 15 },
};

export interface LockState {
  locked: boolean;
  /** Seconds until the identifier may try again. */
  retryAfterSec: number;
}

export interface AttemptContext {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LoginGuardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Identifiers are matched exactly, so normalise before counting or writing. */
  private normalise(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  /**
   * Is this identifier currently locked out?
   *
   * Counts failures since the last success, so a correct sign-in clears the
   * slate and someone who fumbles their password twice a week never trips it.
   */
  async check(kind: LoginKind, identifier: string): Promise<LockState> {
    const policy = POLICY[kind];
    const id = this.normalise(identifier);
    const since = new Date(Date.now() - policy.windowMin * 60_000);

    const recent = await this.prisma.loginAttempt.findMany({
      where: { kind, identifier: id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { succeeded: true, createdAt: true },
      take: policy.maxFailures * 2,
    });

    const failuresSinceSuccess: Date[] = [];
    for (const attempt of recent) {
      if (attempt.succeeded) break;
      failuresSinceSuccess.push(attempt.createdAt);
    }
    if (failuresSinceSuccess.length < policy.maxFailures) {
      return { locked: false, retryAfterSec: 0 };
    }

    // The lock runs from the failure that tripped it, not from now, so it
    // cannot be extended for ever by hammering a locked account.
    const tripped = failuresSinceSuccess[policy.maxFailures - 1];
    if (!tripped) {
      return { locked: false, retryAfterSec: 0 };
    }
    const unlocksAt = tripped.getTime() + policy.lockMin * 60_000;
    const remainingMs = unlocksAt - Date.now();
    return remainingMs > 0
      ? { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000) }
      : { locked: false, retryAfterSec: 0 };
  }

  /**
   * Record an attempt. Failures are recorded for identifiers that do not exist
   * too — otherwise probing for valid emails would be free and uncounted.
   */
  async record(
    kind: LoginKind,
    identifier: string,
    succeeded: boolean,
    context: AttemptContext = {},
    userId?: string,
  ): Promise<void> {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          kind,
          identifier: this.normalise(identifier),
          succeeded,
          userId: succeeded ? (userId ?? null) : null,
          ip: context.ip ?? null,
          userAgent: context.userAgent?.slice(0, 400) ?? null,
        },
      });
    } catch {
      // Never let audit writing break a sign-in.
    }
  }
}
