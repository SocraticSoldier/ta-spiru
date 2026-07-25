import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Reviews, customer profiles & returns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let customerToken: string;
  let customerId: string;
  let adminToken: string;
  let receptionToken: string;
  let louisId: string;
  let naxxarId: string;
  let appointmentId: string;
  let reviewId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;

    const reg = await http
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('review'),
        password: 'Lifestyle!1',
        firstName: 'Rita',
        lastName: 'Camilleri',
        phone: '+35679333444',
      })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    receptionToken = (
      await http.post('/api/v1/auth/login').send({ email: 'andrea@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;

    // A finished visit to rate.
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });
    const booking = await http
      .post('/api/v1/bookings')
      .set(auth(customerToken))
      .send({
        locationId: naxxarId,
        serviceId: haircut.id,
        startsAt: `${futureDate(16)}T10:00:00.000Z`,
        barberId: louisId,
      })
      .expect(201);
    appointmentId = booking.body.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { customerId } });
    await prisma.appointment.deleteMany({ where: { customerId } });
    await prisma.notification.deleteMany({ where: { kind: 'REVIEW' } });
    await prisma.user.deleteMany({ where: { id: customerId } });
    await app.close();
  });

  it('serves the six-question rating form', async () => {
    const res = await http.get('/api/v1/reviews/questions').expect(200);
    expect(res.body.questions).toHaveLength(6);
  });

  it('only accepts a rating once the visit is finished', async () => {
    await http
      .post(`/api/v1/reviews/appointment/${appointmentId}`)
      .set(auth(customerToken))
      .send({ overall: 5, answers: [5, 5, 5, 5, 5, 5] })
      .expect(400); // still upcoming

    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'COMPLETED' } });

    const res = await http
      .post(`/api/v1/reviews/appointment/${appointmentId}`)
      .set(auth(customerToken))
      .send({ overall: 5, answers: [5, 5, 4, 5, 5, 5], comment: 'Best fade in Malta', shareToGoogle: true })
      .expect(201);
    reviewId = res.body.id;
    expect(res.body.sharedGoogle).toBe(true);

    // One review per visit.
    await http
      .post(`/api/v1/reviews/appointment/${appointmentId}`)
      .set(auth(customerToken))
      .send({ overall: 4, answers: [4, 4, 4, 4, 4, 4] })
      .expect(400);
  });

  it('shows the barber rating on the booking screen and lets the admin hide it', async () => {
    const before = await http.get(`/api/v1/reviews/barber/${louisId}`).expect(200);
    expect(before.body.count).toBeGreaterThan(0);
    expect(before.body.average).toBeGreaterThan(0);

    await http
      .patch(`/api/v1/reviews/${reviewId}/moderate`)
      .set(auth(customerToken))
      .send({ isPublished: false })
      .expect(403);
    await http
      .patch(`/api/v1/reviews/${reviewId}/moderate`)
      .set(auth(adminToken))
      .send({ isPublished: false })
      .expect(200);

    const after = await http.get(`/api/v1/reviews/barber/${louisId}`).expect(200);
    expect(after.body.count).toBe(before.body.count - 1);
  });

  it('alerts the owner when a poor rating comes in', async () => {
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });
    const second = await http
      .post('/api/v1/bookings')
      .set(auth(customerToken))
      .send({
        locationId: naxxarId,
        serviceId: haircut.id,
        startsAt: `${futureDate(17)}T10:00:00.000Z`,
        barberId: louisId,
      })
      .expect(201);
    await prisma.appointment.update({ where: { id: second.body.id }, data: { status: 'COMPLETED' } });
    await http
      .post(`/api/v1/reviews/appointment/${second.body.id}`)
      .set(auth(customerToken))
      .send({ overall: 2, answers: [2, 2, 2, 3, 2, 1], comment: 'Waited 40 minutes' })
      .expect(201);

    const notes = await http.get('/api/v1/notifications').set(auth(adminToken)).expect(200);
    expect(notes.body.some((n: { kind: string; title: string }) => n.kind === 'REVIEW' && n.title.startsWith('2★'))).toBe(true);
  });

  it('stores reminder preferences, with SMS always on for barber unavailability', async () => {
    await http
      .patch('/api/v1/customers/me')
      .set(auth(customerToken))
      .send({
        birthday: '1990-04-12T00:00:00.000Z',
        occupation: 'Retail assistant',
        workplace: "St George's Mall",
        staffNumber: 'SG-1183',
        contactChannels: ['SMS', 'PUSH'],
      })
      .expect(200);

    const me = await http.get('/api/v1/customers/me').set(auth(customerToken)).expect(200);
    expect(me.body.contactChannels).toEqual(['SMS', 'PUSH']);
    expect(me.body.birthday).toBe('1990-04-12');
    expect(me.body.alwaysSmsOnBarberUnavailable).toBe(true);
  });

  it('searches customers by any detail and separates the three groups', async () => {
    const byPhone = await http
      .get('/api/v1/customers')
      .query({ q: '79333444' })
      .set(auth(adminToken))
      .expect(200);
    expect(byPhone.body.some((c: { id: string }) => c.id === customerId)).toBe(true);

    const byWorkplace = await http
      .get('/api/v1/customers')
      .query({ q: 'George' })
      .set(auth(adminToken))
      .expect(200);
    const row = byWorkplace.body.find((c: { id: string }) => c.id === customerId);
    expect(row.group).toBe('COMPANY_STAFF'); // has a workplace, not Ta' Spiru staff
    expect(JSON.stringify(byWorkplace.body)).not.toContain('amountCents'); // never money

    // Flag them as internal staff and they move group.
    await http
      .patch(`/api/v1/customers/${customerId}/staff-flag`)
      .set(auth(adminToken))
      .send({ isTaSpiruStaff: true })
      .expect(200);
    const staffGroup = await http
      .get('/api/v1/customers')
      .query({ group: 'staff' })
      .set(auth(adminToken))
      .expect(200);
    expect(staffGroup.body.some((c: { id: string }) => c.id === customerId)).toBe(true);

    await http.get('/api/v1/customers').set(auth(customerToken)).expect(403);

    // Reception needs this to find a customer for an on-behalf booking.
    const asReception = await http.get('/api/v1/customers').query({ q: 'George' }).set(auth(receptionToken)).expect(200);
    expect(asReception.body.some((c: { id: string }) => c.id === customerId)).toBe(true);
  });

  it('flags the staff card on a loyalty scan so the internal discount can unlock', async () => {
    const pass = await http.get('/api/v1/loyalty/pass').set(auth(customerToken)).expect(200);
    const scan = await http
      .post('/api/v1/loyalty/scan')
      .set(auth(receptionToken))
      .send({ qrPayload: pass.body.qrPayload })
      .expect(201);
    expect(scan.body.isTaSpiruStaff).toBe(true); // flagged in the previous test
    expect(scan.body.customerName).toBe('Rita Camilleri');
  });

  it('takes a product return back into stock', async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { sku: 'TS-WAX-MATT' } });
    const before = await prisma.stockLevel.findUniqueOrThrow({
      where: { productId_locationId: { productId: product.id, locationId: naxxarId } },
    });
    const res = await http
      .post('/api/v1/inventory/return')
      .set(auth(receptionToken))
      .send({ productId: product.id, locationId: naxxarId, quantity: 2, reason: 'unopened' })
      .expect(201);
    expect(res.body.quantity).toBe(before.quantity + 2);

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { productId: product.id, kind: 'RETURN' },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement.quantityDelta).toBe(2);

    await http
      .post('/api/v1/inventory/return')
      .set(auth(customerToken))
      .send({ productId: product.id, locationId: naxxarId, quantity: 1 })
      .expect(403);
  });
});
