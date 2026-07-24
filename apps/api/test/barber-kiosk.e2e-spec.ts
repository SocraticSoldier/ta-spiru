import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Barber kiosk schedule — client privacy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let customerId: string;
  const date = futureDate(4);

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
    await app.close();
  });

  it('shows only the client name and services — no contact, notes or price', async () => {
    const naxxar = await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } });
    const louis = await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } });
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });

    const reg = await http
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('kiosk'),
        password: 'Lifestyle!1',
        firstName: 'Priya',
        lastName: 'Camilleri',
        phone: '+35679000111',
      })
      .expect(201);
    customerId = reg.body.user.id;

    await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({
        locationId: naxxar.id,
        serviceId: haircut.id,
        startsAt: `${date}T09:00:00.000Z`,
        barberId: louis.id,
        notes: 'allergic to a certain aftershave',
      })
      .expect(201);

    // Louis signs in to his kiosk.
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'louis@taspiru.com', password: 'Staff!2026' })
      .expect(200);

    const res = await http
      .get('/api/v1/barbers/me/schedule')
      .query({ date })
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    const row = res.body.find((r: { clientName: string }) => r.clientName === 'Priya Camilleri');
    expect(row).toBeDefined();
    expect(row.services).toContain('Haircut');

    // Privacy: the payload must not leak anything beyond name + services + timing.
    const keys = Object.keys(row).sort();
    expect(keys).toEqual(['clientName', 'endsAt', 'services', 'startsAt', 'status']);
    const blob = JSON.stringify(res.body).toLowerCase();
    expect(blob).not.toContain('35679000111'); // phone
    expect(blob).not.toContain('aftershave'); // notes
    expect(blob).not.toContain('pricecents');
  });

  it('rejects a customer trying to read the barber kiosk', async () => {
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('nosy'), password: 'Lifestyle!1', firstName: 'Nosy', lastName: 'User' })
      .expect(201);
    await http
      .get('/api/v1/barbers/me/schedule')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(403);
  });
});
