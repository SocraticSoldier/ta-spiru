import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, uniqueEmail } from './helpers';

describe('Admin services CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let customerToken: string;
  let naxxarId: string;
  let louisId: string;
  let serviceId: string;
  const slug = `test-service-${Date.now()}`;

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
    customerToken = (
      await http
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('svc'), password: 'Lifestyle!1', firstName: 'C', lastName: 'U' })
        .expect(201)
    ).body.accessToken;
  });

  afterAll(async () => {
    if (serviceId) {
      await prisma.teamMemberService.deleteMany({ where: { serviceId } });
      await prisma.serviceTier.deleteMany({ where: { serviceId } });
      await prisma.locationService.deleteMany({ where: { serviceId } });
      await prisma.service.deleteMany({ where: { id: serviceId } });
    }
    await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('creates a service (admin only)', async () => {
    await http
      .post('/api/v1/services')
      .set(auth(customerToken))
      .send({ slug, name: 'Test Fade', kind: 'BARBER', durationMin: 30, priceCents: 1500, ledgerTag: 'BARBER_SERVICES' })
      .expect(403);

    const res = await http
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({
        slug,
        name: 'Test Fade',
        kind: 'BARBER',
        durationMin: 30,
        priceCents: 1500,
        ledgerTag: 'BARBER_SERVICES',
        locationIds: [naxxarId],
      })
      .expect(201);
    serviceId = res.body.id;
    expect(res.body.slug).toBe(slug);

    const list = await http.get('/api/v1/services').query({ kind: 'BARBER' }).expect(200);
    expect(list.body.some((s: { id: string }) => s.id === serviceId)).toBe(true);
  });

  it('sets seniority tiers', async () => {
    const res = await http
      .put(`/api/v1/services/${serviceId}/tiers`)
      .set(auth(adminToken))
      .send({
        tiers: [
          { seniority: 'JUNIOR', priceCents: 1400, durationMin: 30 },
          { seniority: 'NORMAL', priceCents: 1500, durationMin: 30 },
          { seniority: 'SENIOR', priceCents: 1700, durationMin: 30 },
        ],
      })
      .expect(200);
    expect(res.body.tiers).toHaveLength(3);
    expect(res.body.tiers.map((t: { priceCents: number }) => t.priceCents)).toEqual([1400, 1500, 1700]);
  });

  it('applies and clears a per-barber override, reflected in the barber service list', async () => {
    await http
      .put(`/api/v1/barbers/${louisId}/services/${serviceId}`)
      .set(auth(adminToken))
      .send({ isEnabled: true, priceCents: 999, maxDaily: 2 })
      .expect(200);

    let svcs = await http.get(`/api/v1/barbers/${louisId}/services`).expect(200);
    let row = svcs.body.find((s: { serviceId: string }) => s.serviceId === serviceId);
    expect(row).toBeDefined();
    expect(row.priceCents).toBe(999);
    expect(row.maxDaily).toBe(2);

    // Disable it for Louis -> it disappears from his list.
    await http
      .put(`/api/v1/barbers/${louisId}/services/${serviceId}`)
      .set(auth(adminToken))
      .send({ isEnabled: false })
      .expect(200);
    svcs = await http.get(`/api/v1/barbers/${louisId}/services`).expect(200);
    expect(svcs.body.some((s: { serviceId: string }) => s.serviceId === serviceId)).toBe(false);
  });

  it('updates then retires the service', async () => {
    await http
      .patch(`/api/v1/services/${serviceId}`)
      .set(auth(adminToken))
      .send({ name: 'Test Fade Deluxe', priceCents: 1800 })
      .expect(200);

    await http.delete(`/api/v1/services/${serviceId}`).set(auth(adminToken)).expect(200);
    const list = await http.get('/api/v1/services').expect(200);
    expect(list.body.some((s: { id: string }) => s.id === serviceId)).toBe(false);
  });
});
