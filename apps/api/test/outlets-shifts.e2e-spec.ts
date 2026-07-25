import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Barber-operated outlets, virtual queue & split shifts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let customerToken: string;
  let customerId: string;
  let pamaId: string;
  let naxxarId: string;
  let samId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    pamaId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'pama' } })).id;
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    samId = (await prisma.user.findUniqueOrThrow({ where: { email: 'sam@taspiru.com' } })).id;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('queue'), password: 'Lifestyle!1', firstName: 'Quentin', lastName: 'Borg' })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.queueEntry.deleteMany({ where: { customerId } });
    await prisma.user.deleteMany({ where: { id: customerId } });
    await app.close();
  });

  it('unlocks the shared screen at a barber-operated outlet with a station PIN', async () => {
    const res = await http
      .post('/api/v1/auth/station-login')
      .send({ locationId: pamaId, pin: '1234' })
      .expect(200);
    expect(res.body.user.role).toBe('BARBER');
    expect(res.body.user.locationId).toBe(pamaId);
    expect(res.body.accessToken).toBeTruthy();

    // The session really works as that barber.
    const me = await http.get('/api/v1/auth/me').set(auth(res.body.accessToken)).expect(200);
    expect(me.body.locationId).toBe(pamaId);
  });

  it('refuses a station login at a reception-run branch or with a bad PIN', async () => {
    await http.post('/api/v1/auth/station-login').send({ locationId: naxxarId, pin: '1234' }).expect(400);
    await http.post('/api/v1/auth/station-login').send({ locationId: pamaId, pin: '9999' }).expect(401);
  });

  it('lets a customer join the virtual queue at Pama, FIFO', async () => {
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });
    const join = await http
      .post('/api/v1/queue/join')
      .set(auth(customerToken))
      .send({ locationId: pamaId, serviceId: haircut.id })
      .expect(201);
    expect(join.body.entry.position).toBeGreaterThanOrEqual(1);

    // Account-based: the same customer cannot take two places in the line.
    await http
      .post('/api/v1/queue/join')
      .set(auth(customerToken))
      .send({ locationId: pamaId, serviceId: haircut.id })
      .expect(409);

    const board = await http.get('/api/v1/queue/board/pama').expect(200);
    const joinedAts = board.body.entries.map((e: { joinedAt: string }) => e.joinedAt);
    expect([...joinedAts].sort()).toEqual(joinedAts); // first come, first served
  });

  it('refuses a customer joining a queue at a branch that does not run one', async () => {
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });
    await http
      .post('/api/v1/queue/join')
      .set(auth(customerToken))
      .send({ locationId: naxxarId, serviceId: haircut.id })
      .expect(400);
  });

  it('sets a split shift and makes both windows bookable', async () => {
    const date = futureDate(18);
    const res = await http
      .post(`/api/v1/team/${samId}/shifts`)
      .set(auth(adminToken))
      .send({
        date,
        locationId: pamaId,
        windows: [
          { startsAt: '08:30', endsAt: '13:15' },
          { startsAt: '13:45', endsAt: '19:00' },
        ],
      })
      .expect(201);
    expect(res.body.windows).toHaveLength(2);

    const shifts = await prisma.shift.findMany({
      where: { userId: samId, startsAt: { gte: new Date(`${date}T00:00:00.000Z`) } },
      orderBy: { startsAt: 'asc' },
    });
    expect(shifts).toHaveLength(2);

    // The gap between the windows is not bookable, the windows themselves are.
    const haircut = await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } });
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: pamaId, date, serviceId: haircut.id })
      .expect(200);
    const samSlots = slots.body.filter((s: { barberId: string }) => s.barberId === samId);
    expect(samSlots.length).toBeGreaterThan(0);
    // 13:15–13:45 local is the break; nothing may start inside it.
    const inBreak = samSlots.filter((s: { startsAt: string }) => {
      const hhmm = new Date(s.startsAt).toISOString().slice(11, 16);
      return hhmm > '11:15' && hhmm < '11:45'; // 13:15–13:45 Malta summer = 11:15–11:45 UTC
    });
    expect(inBreak).toHaveLength(0);
  });

  it('rejects overlapping shift windows', async () => {
    await http
      .post(`/api/v1/team/${samId}/shifts`)
      .set(auth(adminToken))
      .send({
        date: futureDate(19),
        locationId: pamaId,
        windows: [
          { startsAt: '09:00', endsAt: '14:00' },
          { startsAt: '13:00', endsAt: '18:00' },
        ],
      })
      .expect(400);
  });
});
