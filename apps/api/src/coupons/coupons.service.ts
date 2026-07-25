import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CouponKind } from '@ta-spiru/database';
import { PrismaService } from '../prisma/prisma.service';

export interface RedeemedCoupon {
  code: string;
  discountCents: number;
  lowPeakOnly: boolean;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks a code against the given amount and, if every rule passes, claims
   * one redemption atomically. This is the only place a coupon is spent —
   * a caller that applies the returned discount and then aborts the sale
   * has burned a redemption, same as a till operator voiding a paper coupon.
   *
   * `customerId` is whoever the discount is actually for — the logged-in
   * customer at self-checkout, or the sale's customer at a staffed till.
   * It is deliberately NOT the staff member operating the till, so a
   * per-customer or birthday-gated code is checked against the right
   * person even when a barber applies it on a customer's behalf.
   */
  async redeem(
    code: string,
    amountCents: number,
    locationId: string | undefined,
    customerId: string | null,
  ): Promise<RedeemedCoupon> {
    try {
      const upperCode = code.toUpperCase();
      const c = await this.prisma.coupon.findUnique({ where: { code: upperCode } });
      const now = new Date();
      if (!c || !c.isActive) throw new BadRequestException('That code is not valid');
      if (c.validFrom && now < c.validFrom) throw new BadRequestException('That code is not active yet');
      if (c.validUntil && now > c.validUntil) throw new BadRequestException('That code has expired');
      if (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions) {
        throw new BadRequestException('That code has been fully redeemed');
      }
      if (c.locationId && locationId && c.locationId !== locationId) {
        throw new BadRequestException('That code is not valid at this branch');
      }
      if (c.customerId && c.customerId !== customerId) {
        throw new BadRequestException('That code is assigned to a different customer');
      }
      if (c.isBirthdayReward) {
        const customer = customerId
          ? await this.prisma.user.findUnique({ where: { id: customerId }, select: { birthday: true } })
          : null;
        if (!customer?.birthday || customer.birthday.getUTCMonth() !== now.getUTCMonth()) {
          throw new BadRequestException('That code only applies during your birthday month');
        }
      }

      if (c.maxRedemptions !== null) {
        const claimed = await this.prisma.coupon.updateMany({
          where: { id: c.id, redemptions: { lt: c.maxRedemptions } },
          data: { redemptions: { increment: 1 } },
        });
        if (claimed.count === 0) throw new BadRequestException('That code has been fully redeemed');
      } else {
        await this.prisma.coupon.update({ where: { id: c.id }, data: { redemptions: { increment: 1 } } });
      }

      const discountCents =
        c.kind === CouponKind.PERCENT ? Math.floor((amountCents * c.value) / 100) : Math.min(c.value, amountCents);
      return { code: c.code, discountCents, lowPeakOnly: c.lowPeakOnly };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to validate the code');
    }
  }
}
