import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Team management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let barberToken: string;
  let customerToken: string;
  let naxxarId: string;
  let newMemberId: string;
  let louisId: string;
  const email = uniqueEmail('newbarber');
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    barberToken = (
      await http.post('/api/v1/auth/login').send({ email: 'louis@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    customerToken = (
      await http
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('teamcust'), password: 'Lifestyle!1', firstName: 'T', lastName: 'C' })
        .expect(201)
    ).body.accessToken;
  });

  afterAll(async () => {
    if (newMemberId) {
      await prisma.leaveRequest.deleteMany({ where: { userId: newMemberId } });
      await prisma.notification.deleteMany({ where: { userId: newMemberId } });
      await prisma.user.deleteMany({ where: { id: newMemberId } });
    }
    await prisma.leaveRequest.deleteMany({ where: { userId: louisId } });
    await prisma.user.update({ where: { id: louisId }, data: { acceptsBookings: true, offDays: [] } });
    await app.close();
  });

  it('adds a barber to the team with a station and seniority', async () => {
    await http
      .post('/api/v1/team')
      .set(auth(customerToken))
      .send({ email, firstName: 'Nino', role: 'BARBER' })
      .expect(403);

    const res = await http
      .post('/api/v1/team')
      .set(auth(adminToken))
      .send({ email, firstName: 'Nino', role: 'BARBER', locationId: naxxarId, stationNo: 9, entrance: 'B' })
      .expect(201);
    newMemberId = res.body.id;
    expect(res.body.seniority).toBe('NORMAL'); // barbers default to the normal band
    expect(res.body.stationNo).toBe(9);
    expect(res.body.acceptsBookings).toBe(true);

    const list = await http.get('/api/v1/team').query({ locationId: naxxarId }).set(auth(adminToken)).expect(200);
    expect(list.body.some((m: { id: string }) => m.id === newMemberId)).toBe(true);
  });

  it('edits the profile: off days, min queue gap, allowance and bookability', async () => {
    const res = await http
      .patch(`/api/v1/team/${newMemberId}`)
      .set(auth(adminToken))
      .send({
        offDays: [0, 3],
        minQueueGapMin: 13,
        leaveAllowanceDays: 20,
        employmentDate: '2024-03-01T00:00:00.000Z',
        seniority: 'SENIOR',
      })
      .expect(200);
    expect(res.body.offDays).toEqual([0, 3]);
    expect(res.body.minQueueGapMin).toBe(13);
    expect(res.body.seniority).toBe('SENIOR');
  });

  it('hides a barber from availability when they stop taking bookings', async () => {
    const before = await http.get('/api/v1/barbers').query({ locationId: naxxarId }).expect(200);
    expect(before.body.some((b: { id: string }) => b.id === louisId)).toBe(true);

    await http.patch(`/api/v1/team/${louisId}`).set(auth(adminToken)).send({ acceptsBookings: false }).expect(200);
    const after = await http.get('/api/v1/barbers').query({ locationId: naxxarId }).expect(200);
    expect(after.body.some((b: { id: string }) => b.id === louisId)).toBe(false);

    const fade = await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } });
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date: futureDate(14), serviceId: fade.id })
      .expect(200);
    expect(slots.body.some((s: { barberId: string }) => s.barberId === louisId)).toBe(false);

    await http.patch(`/api/v1/team/${louisId}`).set(auth(adminToken)).send({ acceptsBookings: true }).expect(200);
  });

  it('records leave and reflects the balance on the profile', async () => {
    // A manager filing leave approves it outright.
    const filed = await http
      .post(`/api/v1/team/${newMemberId}/leave`)
      .set(auth(adminToken))
      .send({ kind: 'LEAVE', dates: [futureDate(20), futureDate(21)], notes: 'family trip' })
      .expect(201);
    expect(filed.body).toEqual({ created: 2, status: 'APPROVED' });

    const detail = await http.get(`/api/v1/team/${newMemberId}`).set(auth(adminToken)).expect(200);
    expect(detail.body.leave.allowanceDays).toBe(20);
    expect(detail.body.leave.taken).toBe(2);
    expect(detail.body.leave.remaining).toBe(18);

    // A barber requesting their own days stays pending…
    const own = await http
      .post(`/api/v1/team/${louisId}/leave`)
      .set(auth(barberToken))
      .send({ kind: 'SICK', dates: [futureDate(22)] })
      .expect(201);
    expect(own.body.status).toBe('PENDING');

    // …and cannot be filed against somebody else.
    await http
      .post(`/api/v1/team/${newMemberId}/leave`)
      .set(auth(barberToken))
      .send({ kind: 'LEAVE', dates: [futureDate(23)] })
      .expect(403);

    // The admin decides, and the barber is notified.
    const pending = await prisma.leaveRequest.findFirstOrThrow({ where: { userId: louisId, status: 'PENDING' } });
    await http.patch(`/api/v1/team/leave/${pending.id}`).set(auth(adminToken)).send({ status: 'APPROVED' }).expect(200);
    const notes = await http.get('/api/v1/notifications').set(auth(barberToken)).expect(200);
    expect(notes.body.some((n: { kind: string; title: string }) => n.kind === 'LEAVE' && /approved/i.test(n.title))).toBe(true);
  });

  it('builds the roster for a day, marking leave and off days', async () => {
    const roster = await http
      .get('/api/v1/team/roster/day')
      .query({ date: futureDate(20), locationId: naxxarId })
      .set(auth(adminToken))
      .expect(200);
    const nino = roster.body.find((r: { id: string }) => r.id === newMemberId);
    expect(nino.status).toBe('LEAVE'); // the approved day above
  });

  it('reports a barber’s performance over a window', async () => {
    const perf = await http
      .get(`/api/v1/team/${louisId}/performance`)
      .set(auth(adminToken))
      .expect(200);
    expect(perf.body).toEqual(
      expect.objectContaining({
        bookingsMade: expect.any(Number),
        bookingsMissed: expect.any(Number),
        clientsRetained: expect.any(Number),
        clientsNew: expect.any(Number),
      }),
    );
    await http.get(`/api/v1/team/${louisId}/performance`).set(auth(customerToken)).expect(403);
  });

  it('removes a member without deleting their history', async () => {
    await http.delete(`/api/v1/team/${newMemberId}`).set(auth(adminToken)).expect(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: newMemberId } });
    expect(after.isActive).toBe(false);
    expect(after.terminationDate).not.toBeNull();
    const list = await http.get('/api/v1/team').set(auth(adminToken)).expect(200);
    expect(list.body.some((m: { id: string }) => m.id === newMemberId)).toBe(false);
  });
});
