import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Service photos, barber POS, reschedule, leaderboard & birthday coupon (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let louisToken: string;
  let louisId: string;
  let samueleId: string;
  let naxxarId: string;
  let fadeId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;
    samueleId = (await prisma.user.findUniqueOrThrow({ where: { email: 'samuele@taspiru.com' } })).id;
    fadeId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } })).id;

    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    louisToken = (
      await http.post('/api/v1/auth/login').send({ email: 'louis@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.tip.deleteMany({ where: { barberId: louisId } });
    await prisma.appointment.deleteMany({ where: { barberId: louisId, notes: 'e2e-reschedule' } });
    await app.close();
  });

  it('exposes description and photoUrl on the customer-facing service catalog', async () => {
    await http
      .patch(`/api/v1/services/${fadeId}`)
      .set(auth(adminToken))
      .send({ description: 'A sharp fade.', photoUrl: 'https://files.taspiru.com/skin-fade.jpg' })
      .expect(200);
    const list = await http.get('/api/v1/services').query({ kind: 'BARBER' }).expect(200);
    const fade = list.body.find((s: { id: string }) => s.id === fadeId);
    expect(fade.description).toBe('A sharp fade.');
    expect(fade.photoUrl).toBe('https://files.taspiru.com/skin-fade.jpg');

    const perBarber = await http.get(`/api/v1/barbers/${louisId}/services`).expect(200);
    const barberFade = perBarber.body.find((s: { serviceId: string }) => s.serviceId === fadeId);
    expect(barberFade.description).toBe('A sharp fade.');
  });

  it('lets a barber take a real POS sale, with prices exposed on the till catalog', async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { sku: 'TS-BEARD-OIL' } });

    // The barber's till on /my-day builds its catalog from this endpoint.
    const levels = await http.get('/api/v1/inventory/levels').query({ locationId: naxxarId }).set(auth(louisToken)).expect(200);
    const row = levels.body.find((r: { productId: string }) => r.productId === product.id);
    expect(row.priceCents).toBe(product.priceCents);

    const res = await http
      .post('/api/v1/orders/pos')
      .set(auth(louisToken))
      .send({ locationId: naxxarId, items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    expect(res.body.totalCents).toBe(product.priceCents);
    expect(res.body.paymentIntent.jwt).toEqual(expect.any(String));
  });

  it('reschedules a booking, re-checking conflicts and barber ownership', async () => {
    const slotA = `${futureDate(20)}T09:00:00.000Z`;
    const slotB = `${futureDate(20)}T13:00:00.000Z`;
    const bookingA = await http
      .post('/api/v1/bookings')
      .set(auth(adminToken))
      .send({ locationId: naxxarId, serviceId: fadeId, startsAt: slotA, barberId: louisId, customerId: undefined, notes: 'e2e-reschedule' })
      .expect(201);
    const bookingB = await http
      .post('/api/v1/bookings')
      .set(auth(adminToken))
      .send({ locationId: naxxarId, serviceId: fadeId, startsAt: slotB, barberId: louisId, notes: 'e2e-reschedule' })
      .expect(201);

    // The barber can reschedule their own appointment.
    await http
      .patch(`/api/v1/bookings/${bookingA.body.id}/reschedule`)
      .set(auth(louisToken))
      .send({ startsAt: `${futureDate(20)}T10:00:00.000Z` })
      .expect(200);

    // A barber cannot reschedule someone else's appointment.
    const samueleToken = (
      await http.post('/api/v1/auth/login').send({ email: 'samuele@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    await http
      .patch(`/api/v1/bookings/${bookingA.body.id}/reschedule`)
      .set(auth(samueleToken))
      .send({ startsAt: `${futureDate(20)}T11:00:00.000Z` })
      .expect(404);

    // Rescheduling onto an existing conflict is refused.
    await http
      .patch(`/api/v1/bookings/${bookingA.body.id}/reschedule`)
      .set(auth(adminToken))
      .send({ startsAt: slotB })
      .expect(409);

    // A clean slot succeeds and the new time sticks.
    const moved = await http
      .patch(`/api/v1/bookings/${bookingA.body.id}/reschedule`)
      .set(auth(adminToken))
      .send({ startsAt: `${futureDate(20)}T15:00:00.000Z` })
      .expect(200);
    expect(moved.body.startsAt).toBe(`${futureDate(20)}T15:00:00.000Z`);

    await prisma.appointment.updateMany({
      where: { id: { in: [bookingA.body.id, bookingB.body.id] } },
      data: { status: 'CANCELLED' },
    });
  });

  it('builds a monthly leaderboard from real bookings', async () => {
    const board = await http.get('/api/v1/team/performance/leaderboard').set(auth(adminToken)).expect(200);
    expect(board.body).toEqual(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    );
    if (board.body.mostBookings) {
      expect(board.body.mostBookings).toEqual(
        expect.objectContaining({ barberId: expect.any(String), barberName: expect.any(String), value: expect.any(Number) }),
      );
    }
    await http.get('/api/v1/team/performance/leaderboard').set(auth(louisToken)).expect(403);
  });

  it('gates the BIRTHDAY5 coupon on the requesting customer’s birthday month', async () => {
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('bday'), password: 'Lifestyle!1', firstName: 'Bea', lastName: 'Grech' })
      .expect(201);
    const customerToken = reg.body.accessToken;

    // No birthday on file yet — refused.
    await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'BIRTHDAY5', amountCents: 2000 })
      .expect(400);

    // Birthday set to this month — allowed.
    const thisMonth = new Date().toISOString().slice(5, 7);
    await http
      .patch('/api/v1/customers/me')
      .set(auth(customerToken))
      .send({ birthday: `1995-${thisMonth}-10` })
      .expect(200);
    const ok = await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'BIRTHDAY5', amountCents: 2000 })
      .expect(201);
    expect(ok.body.discountCents).toBe(500);

    // A normal coupon is unaffected by birthday gating.
    const bf = await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'BLACKFRIDAY10', amountCents: 2000 })
      .expect(201);
    expect(bf.body.discountCents).toBe(200);
  });

  it('lets a barber see the kiosk clock-in roster for their own branch', async () => {
    // Previously only MANAGER/RECEPTIONIST could — barbers signed into a
    // shared kiosk device couldn't see who to punch in, including themselves.
    const roster = await http.get('/api/v1/timeclock/staff').query({ locationId: naxxarId }).set(auth(louisToken)).expect(200);
    expect(roster.body.some((s: { name: string }) => s.name.includes('Louis'))).toBe(true);

    const customerToken = (
      await http
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('roster'), password: 'Lifestyle!1', firstName: 'No', lastName: 'Access' })
        .expect(201)
    ).body.accessToken;
    await http.get('/api/v1/timeclock/staff').query({ locationId: naxxarId }).set(auth(customerToken)).expect(403);
  });

  it('lets a barber record and see their own tips only', async () => {
    const slot = `${futureDate(21)}T09:00:00.000Z`;
    const booking = await http
      .post('/api/v1/bookings')
      .set(auth(adminToken))
      .send({ locationId: naxxarId, serviceId: fadeId, startsAt: slot, barberId: louisId, notes: 'e2e-reschedule' })
      .expect(201);

    // A general tip, not tied to any visit.
    const general = await http
      .post('/api/v1/team/me/tips')
      .set(auth(louisToken))
      .send({ amountCents: 500 })
      .expect(201);
    expect(general.body).toEqual(
      expect.objectContaining({ id: expect.any(String), amountCents: 500, appointmentId: null }),
    );

    // A tip tied to one of the barber's own visits.
    const tied = await http
      .post('/api/v1/team/me/tips')
      .set(auth(louisToken))
      .send({ amountCents: 1000, appointmentId: booking.body.id })
      .expect(201);
    expect(tied.body.appointmentId).toBe(booking.body.id);

    // Cannot tie a tip to another barber's appointment.
    const samueleToken = (
      await http.post('/api/v1/auth/login').send({ email: 'samuele@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    await http
      .post('/api/v1/team/me/tips')
      .set(auth(samueleToken))
      .send({ amountCents: 300, appointmentId: booking.body.id })
      .expect(404);

    const mine = await http.get('/api/v1/team/me/tips').set(auth(louisToken)).expect(200);
    expect(mine.body.totalCents).toBeGreaterThanOrEqual(1500);
    expect(mine.body.entries.some((e: { id: string }) => e.id === general.body.id)).toBe(true);
    expect(mine.body.entries.some((e: { id: string }) => e.id === tied.body.id)).toBe(true);

    // Only barbers can record tips — even admin isn't a barber.
    const customerToken = (
      await http
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('tips'), password: 'Lifestyle!1', firstName: 'No', lastName: 'Tips' })
        .expect(201)
    ).body.accessToken;
    await http.post('/api/v1/team/me/tips').set(auth(customerToken)).send({ amountCents: 100 }).expect(403);

    await prisma.appointment.updateMany({ where: { id: booking.body.id }, data: { status: 'CANCELLED' } });
  });

  it('drops cancelled visits from the barber schedule so the day view stays clean', async () => {
    const day = futureDate(22);
    const kept = await http
      .post('/api/v1/bookings')
      .set(auth(adminToken))
      .send({ locationId: naxxarId, serviceId: fadeId, startsAt: `${day}T09:00:00.000Z`, barberId: louisId, notes: 'e2e-reschedule' })
      .expect(201);
    const cancelled = await http
      .post('/api/v1/bookings')
      .set(auth(adminToken))
      .send({ locationId: naxxarId, serviceId: fadeId, startsAt: `${day}T11:00:00.000Z`, barberId: louisId, notes: 'e2e-reschedule' })
      .expect(201);
    await prisma.appointment.update({ where: { id: cancelled.body.id }, data: { status: 'CANCELLED' } });

    const schedule = await http.get('/api/v1/barbers/me/schedule').query({ date: day }).set(auth(louisToken)).expect(200);
    const ids = schedule.body.map((row: { id: string }) => row.id);
    expect(ids).toContain(kept.body.id);
    expect(ids).not.toContain(cancelled.body.id);

    await prisma.appointment.updateMany({ where: { id: { in: [kept.body.id, cancelled.body.id] } }, data: { status: 'CANCELLED' } });
  });
});
