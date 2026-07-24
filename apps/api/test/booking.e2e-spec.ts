import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Booking engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  let fguraId: string;
  let barberServiceId: string;
  let washServiceId: string;
  let adminToken: string;
  let customerToken: string;
  const date = futureDate(9); // within the seeded 14-day roster
  const createdBlockIds: string[] = [];
  const createdComboGroups: string[] = [];

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());

    const fgura = await prisma.location.findUniqueOrThrow({ where: { slug: 'fgura' } });
    fguraId = fgura.id;
    barberServiceId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } })).id;
    washServiceId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } })).id;

    const admin = await http
      .post('/api/v1/auth/login')
      .send({ email: 'norbert@taspiru.com', password: 'Staff!2026' })
      .expect(200);
    adminToken = admin.body.accessToken;

    const customer = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('cust'), password: 'Lifestyle!1', firstName: 'E2E', lastName: 'Customer' })
      .expect(201);
    customerToken = customer.body.accessToken;
  });

  afterAll(async () => {
    if (createdComboGroups.length > 0) {
      await prisma.appointment.deleteMany({ where: { comboGroupId: { in: createdComboGroups } } });
    }
    if (createdBlockIds.length > 0) {
      await prisma.timeBlock.deleteMany({ where: { id: { in: createdBlockIds } } });
    }
    await app.close();
  });

  it('registers a customer and returns a usable session', async () => {
    const me = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(me.body.role).toBe('CUSTOMER');
  });

  it('rejects duplicate email registration with 409', async () => {
    const email = uniqueEmail('dup');
    await http
      .post('/api/v1/auth/register')
      .send({ email, password: 'Lifestyle!1', firstName: 'A', lastName: 'B' })
      .expect(201);
    await http
      .post('/api/v1/auth/register')
      .send({ email, password: 'Lifestyle!1', firstName: 'A', lastName: 'B' })
      .expect(409);
  });

  it('finds combo slots, then excludes a blocked window', async () => {
    const before = await http
      .get('/api/v1/bookings/combo-availability')
      .query({ locationId: fguraId, date, barberServiceId, washServiceId })
      .expect(200);
    expect(before.body.length).toBeGreaterThan(0);

    // Block 12:00–14:00 Malta (10:00–12:00 UTC in summer / 11:00–13:00 winter).
    const block = await http
      .post('/api/v1/time-blocks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationId: fguraId,
        startsAt: `${date}T09:00:00.000Z`,
        endsAt: `${date}T13:00:00.000Z`,
        reason: 'e2e block',
      })
      .expect(201);
    createdBlockIds.push(block.body.id);

    const after = await http
      .get('/api/v1/bookings/combo-availability')
      .query({ locationId: fguraId, date, barberServiceId, washServiceId })
      .expect(200);

    expect(after.body.length).toBeLessThan(before.body.length);
    const insideBlock = after.body.filter(
      (slot: { startsAt: string }) => slot.startsAt >= `${date}T09:00:00.000Z` && slot.startsAt < `${date}T13:00:00.000Z`,
    );
    expect(insideBlock).toHaveLength(0);
  });

  it('books a combo and rejects a second booking of the same barber+slot', async () => {
    const slots = await http
      .get('/api/v1/bookings/combo-availability')
      .query({ locationId: fguraId, date, barberServiceId, washServiceId })
      .expect(200);
    const slot = slots.body[0];
    expect(slot).toBeDefined();

    const booking = await http
      .post('/api/v1/bookings/combo')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        locationId: fguraId,
        startsAt: slot.startsAt,
        barberServiceId,
        washServiceId,
        barberId: slot.barberId,
        washBayId: slot.washBayId,
        vehicleReg: 'E2E 001',
      })
      .expect(201);
    createdComboGroups.push(booking.body.comboGroupId);
    expect(booking.body.barberAppointmentId).toBeDefined();
    expect(booking.body.washAppointmentId).toBeDefined();

    // Same barber, same start — must conflict.
    await http
      .post('/api/v1/bookings/combo')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        locationId: fguraId,
        startsAt: slot.startsAt,
        barberServiceId,
        washServiceId,
        barberId: slot.barberId,
        washBayId: slot.washBayId,
      })
      .expect(409);
  });

  it('lists the customer bookings and cancels the whole combo', async () => {
    const mine = await http
      .get('/api/v1/bookings/mine')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const comboRows = mine.body.filter((row: { comboGroupId: string | null }) =>
      createdComboGroups.includes(row.comboGroupId ?? ''),
    );
    expect(comboRows).toHaveLength(2);

    const cancel = await http
      .post(`/api/v1/bookings/${comboRows[0].id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);
    expect(cancel.body.cancelled).toBe(2);
  });

  it('forbids a customer from creating a time block (RBAC)', async () => {
    await http
      .post('/api/v1/time-blocks')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ locationId: fguraId, startsAt: `${date}T15:00:00.000Z`, endsAt: `${date}T16:00:00.000Z` })
      .expect(403);
  });

  it('rejects unauthenticated availability writes but allows public reads', async () => {
    await http.post('/api/v1/bookings/combo').send({}).expect(401);
    await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: fguraId, date, serviceId: barberServiceId })
      .expect(200);
  });
});
