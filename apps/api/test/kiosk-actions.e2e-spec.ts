import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Barber kiosk actions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let customerToken: string;
  let customerId: string;
  let louisToken: string;
  let louisId: string;
  let adminToken: string;
  let naxxarId: string;
  let haircutId: string;
  let beardId: string;
  let firstApptId: string;
  const date = futureDate(13);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;
    haircutId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } })).id;
    beardId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'beard-grooming' } })).id;

    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('kioskact'), password: 'Lifestyle!1', firstName: 'Ken', lastName: 'Attard' })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;

    louisToken = (
      await http.post('/api/v1/auth/login').send({ email: 'louis@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;

    // Two back-to-back bookings with Louis: 09:00 haircut (30min), 09:30 haircut.
    const mk = async (at: string) =>
      (
        await http
          .post('/api/v1/bookings')
          .set(auth(customerToken))
          .send({ locationId: naxxarId, serviceId: haircutId, startsAt: `${date}T${at}:00.000Z`, barberId: louisId })
          .expect(201)
      ).body.id;
    firstApptId = await mk('09:00');
    await mk('09:30');
  });

  afterAll(async () => {
    await prisma.serviceChangeLog.deleteMany({ where: { changedById: louisId } });
    await prisma.appointment.deleteMany({ where: { customerId } });
    await app.close();
  });

  it('lets the barber set the client status (late, being served)', async () => {
    await http
      .patch(`/api/v1/bookings/${firstApptId}/status`)
      .set(auth(louisToken))
      .send({ status: 'LATE' })
      .expect(200);
    await http
      .patch(`/api/v1/bookings/${firstApptId}/status`)
      .set(auth(louisToken))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    const a = await prisma.appointment.findUniqueOrThrow({ where: { id: firstApptId } });
    expect(a.status).toBe('IN_PROGRESS');
  });

  it('refuses a customer setting statuses', async () => {
    await http
      .patch(`/api/v1/bookings/${firstApptId}/status`)
      .set(auth(customerToken))
      .send({ status: 'NO_SHOW' })
      .expect(403);
  });

  it('requires the responsibility confirmation when an added service overlaps the next booking', async () => {
    // 09:00–09:30 haircut + 20min beard runs into the 09:30 booking.
    const refused = await http
      .post(`/api/v1/bookings/${firstApptId}/add-service`)
      .set(auth(louisToken))
      .send({ serviceId: beardId })
      .expect(409);
    expect(JSON.stringify(refused.body)).toContain('OVERLAP_CONFIRM_REQUIRED');

    const accepted = await http
      .post(`/api/v1/bookings/${firstApptId}/add-service`)
      .set(auth(louisToken))
      .send({ serviceId: beardId, acceptOverlap: true })
      .expect(201);
    expect(accepted.body.overlapAccepted).toBe(true);

    // The visit now spans haircut + beard as linked segments.
    const segments = await prisma.appointment.findMany({
      where: { comboGroupId: accepted.body.visitGroupId },
    });
    expect(segments).toHaveLength(2);
  });

  it('notifies the admin audit, which can acknowledge the change', async () => {
    const changes = await http
      .get('/api/v1/audit/service-changes')
      .query({ unacknowledged: 'true' })
      .set(auth(adminToken))
      .expect(200);
    const row = changes.body.find(
      (r: { clientName: string; serviceName: string }) => r.clientName === 'Ken Attard' && r.serviceName === 'Beard Grooming',
    );
    expect(row).toBeDefined();
    expect(row.overlapAccepted).toBe(true);
    expect(row.barberName).toBe('Louis');

    await http.patch(`/api/v1/audit/service-changes/${row.id}/ack`).set(auth(adminToken)).expect(200);
    const after = await prisma.serviceChangeLog.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.acknowledged).toBe(true);
  });

  it('shows the visit in the bookings audit with source and change flag', async () => {
    const res = await http
      .get('/api/v1/audit/bookings')
      .query({ date, locationId: naxxarId })
      .set(auth(adminToken))
      .expect(200);
    const visit = res.body.find((r: { clientName: string; serviceChanged: boolean }) => r.clientName === 'Ken Attard' && r.serviceChanged);
    expect(visit).toBeDefined();
    expect(visit.source).toBe('ONLINE');
    expect(visit.serviceNames).toEqual(expect.arrayContaining(['Haircut', 'Beard Grooming']));
    // and the audit is admin-only
    await http.get('/api/v1/audit/bookings').set(auth(customerToken)).expect(403);
  });
});
