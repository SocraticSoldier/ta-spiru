import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { computeSiteSecurity } from '../src/payments/site-security';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Trust Payments webhook (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let webhookPassword: string;
  let siteReference: string;

  let customerToken: string;
  let customerId: string;
  let appointmentId: string;
  let paymentReference: string;
  const date = futureDate(11); // within the seeded 14-day roster
  const transactionReference = `tp-e2e-${Date.now()}`; // unique per run (@unique column)

  const webhookBody = (overrides: Record<string, string>): Record<string, string> => {
    const base = {
      transactionreference: transactionReference,
      orderreference: paymentReference,
      sitereference: siteReference,
      errorcode: '0',
      settlestatus: '100',
      ...overrides,
    };
    return {
      ...base,
      responsesitesecurity: computeSiteSecurity(base, webhookPassword),
    };
  };

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    const config = app.get(ConfigService);
    webhookPassword = config.getOrThrow('TRUST_PAYMENTS_WEBHOOK_PASSWORD');
    siteReference = config.getOrThrow('TRUST_PAYMENTS_SITE_REFERENCE');

    const naxxar = await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } });
    const fade = await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } });

    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('pay'), password: 'Lifestyle!1', firstName: 'Pay', lastName: 'Test' })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;

    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxar.id, date, serviceId: fade.id })
      .expect(200);
    const slot = slots.body[0];

    const appointment = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ locationId: naxxar.id, serviceId: fade.id, startsAt: slot.startsAt, barberId: slot.barberId })
      .expect(201);
    appointmentId = appointment.body.id;

    const intent = await http
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        amountCents: fade.priceCents,
        channel: 'ONLINE',
        splitLedgerTags: [{ tag: 'BARBER_SERVICES', amountCents: fade.priceCents }],
        appointmentIds: [appointmentId],
      })
      .expect(201);
    paymentReference = intent.body.paymentReference;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.transaction.deleteMany({ where: { paymentReference } });
    await app.close();
  });

  it('rejects a webhook with an invalid site-security digest (403)', async () => {
    await http
      .post('/api/v1/payments/webhook')
      .send({ ...webhookBody({}), responsesitesecurity: 'deadbeef' })
      .expect(403);
  });

  it('settles the transaction, confirms the appointment and awards loyalty', async () => {
    await http.post('/api/v1/payments/webhook').send(webhookBody({})).expect(200);

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.status).toBe('CONFIRMED');

    const txn = await prisma.transaction.findUniqueOrThrow({ where: { paymentReference } });
    expect(txn.status).toBe('SETTLED');
    expect(txn.settledAt).not.toBeNull();

    const loyalty = await http
      .get('/api/v1/loyalty/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const fade = await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } });
    expect(loyalty.body.balancePoints).toBe(Math.floor(fade.priceCents / 100));
  });

  it('is idempotent — a replayed webhook does not double-award points', async () => {
    const before = await http
      .get('/api/v1/loyalty/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    await http.post('/api/v1/payments/webhook').send(webhookBody({})).expect(200);

    const after = await http
      .get('/api/v1/loyalty/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(after.body.balancePoints).toBe(before.body.balancePoints);

    const entries = await prisma.loyaltyLedgerEntry.count({
      where: { account: { userId: customerId }, kind: 'EARN' },
    });
    expect(entries).toBe(1);
  });
});
