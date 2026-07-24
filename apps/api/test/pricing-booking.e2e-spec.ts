import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Seniority pricing & daily caps (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let customerId: string;
  let naxxarId: string;
  let seniorBarberId: string | null = null;
  const date = futureDate(11); // a weekday clear of the other suites (which use +9)

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('price'), password: 'Lifestyle!1', firstName: 'Price', lastName: 'Test' })
      .expect(201);
    token = reg.body.accessToken;
    customerId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
    if (seniorBarberId) {
      await prisma.user.update({ where: { id: seniorBarberId }, data: { seniority: 'NORMAL' } });
    }
    await app.close();
  });

  it('charges the senior tier and snapshots it on the appointment', async () => {
    const fade = await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } });

    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: fade.id })
      .expect(200);
    const slot = slots.body[0];
    expect(slot).toBeDefined();

    // Promote whichever barber this slot offers to SENIOR, then book with them.
    seniorBarberId = slot.barberId;
    await prisma.user.update({ where: { id: slot.barberId }, data: { seniority: 'SENIOR' } });

    const booking = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: naxxarId, serviceId: fade.id, startsAt: slot.startsAt, barberId: slot.barberId })
      .expect(201);

    const mine = await http.get('/api/v1/bookings/mine').set('Authorization', `Bearer ${token}`).expect(200);
    const row = mine.body.find((b: { id: string }) => b.id === booking.body.id);
    expect(row.priceCents).toBe(1600); // senior Skin Fade (base 1400 + €2)
  });

  it('applies the per-member duration override and enforces the daily cap', async () => {
    const louis = await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } });
    const boysCut = await prisma.service.findUniqueOrThrow({ where: { slug: 'boy-haircut' } });
    const at = (h: number, m: number) =>
      `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

    // Louis' boys' cut is overridden to 15 min, max 4/day.
    const first = await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: naxxarId, serviceId: boysCut.id, startsAt: at(8, 0), barberId: louis.id })
      .expect(201);
    const span = new Date(first.body.endsAt).getTime() - new Date(first.body.startsAt).getTime();
    expect(span).toBe(15 * 60 * 1000); // 15-minute override, not the 25-min default

    // Three more fill the daily cap of 4.
    for (const [h, m] of [[8, 15], [8, 30], [8, 45]] as const) {
      await http
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId: naxxarId, serviceId: boysCut.id, startsAt: at(h, m), barberId: louis.id })
        .expect(201);
    }

    // The fifth is refused by the cap.
    await http
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: naxxarId, serviceId: boysCut.id, startsAt: at(9, 0), barberId: louis.id })
      .expect(409);
  });
});
