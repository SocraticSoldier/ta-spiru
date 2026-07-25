import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate } from './helpers';

describe('Staff documents, personal app & service order (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let barberToken: string;
  let louisId: string;
  let naxxarId: string;
  let docId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    barberToken = (
      await http.post('/api/v1/auth/login').send({ email: 'louis@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.staffDocument.deleteMany({ where: { userId: louisId } });
    await app.close();
  });

  it('files a staff document into a folder', async () => {
    const res = await http
      .post(`/api/v1/team/${louisId}/documents`)
      .set(auth(adminToken))
      .send({ name: 'Employment contract.pdf', url: 'https://files.taspiru.com/louis/contract.pdf', folder: 'Contracts' })
      .expect(201);
    docId = res.body.id;
    expect(res.body.folder).toBe('Contracts');

    const list = await http.get(`/api/v1/team/${louisId}/documents`).set(auth(adminToken)).expect(200);
    expect(list.body.some((d: { id: string }) => d.id === docId)).toBe(true);

    // A barber cannot browse the team's document store.
    await http.get(`/api/v1/team/${louisId}/documents`).set(auth(barberToken)).expect(403);
  });

  it('gives the barber their own overview: roster, leave and documents', async () => {
    // Put a shift on the board so the roster has something to show.
    await http
      .post(`/api/v1/team/${louisId}/shifts`)
      .set(auth(adminToken))
      .send({
        date: futureDate(24),
        locationId: naxxarId,
        windows: [{ startsAt: '09:00', endsAt: '13:00' }, { startsAt: '14:00', endsAt: '19:00' }],
      })
      .expect(201);

    const me = await http.get('/api/v1/team/me/overview').set(auth(barberToken)).expect(200);
    expect(me.body.name).toBe('Louis');
    expect(me.body.roster.length).toBeGreaterThanOrEqual(2);
    expect(me.body.leave).toEqual(
      expect.objectContaining({ allowanceDays: expect.any(Number), remaining: expect.any(Number) }),
    );
    expect(me.body.documents.some((d: { id: string }) => d.id === docId)).toBe(true);
    // Their own view carries no money and no colleague data.
    expect(JSON.stringify(me.body)).not.toContain('priceCents');
  });

  it('removes a document', async () => {
    await http.delete(`/api/v1/team/documents/${docId}`).set(auth(adminToken)).expect(200);
    const list = await http.get(`/api/v1/team/${louisId}/documents`).set(auth(adminToken)).expect(200);
    expect(list.body.some((d: { id: string }) => d.id === docId)).toBe(false);
  });

  it('reorders the service list', async () => {
    const before = await http.get('/api/v1/services').query({ kind: 'BARBER' }).expect(200);
    const ids = before.body.slice(0, 3).map((s: { id: string }) => s.id);
    const reversed = [...ids].reverse();

    await http.put('/api/v1/services/order').set(auth(barberToken)).send({ serviceIds: reversed }).expect(403);
    const res = await http
      .put('/api/v1/services/order')
      .set(auth(adminToken))
      .send({ serviceIds: reversed })
      .expect(200);
    expect(res.body.ordered).toBe(3);

    // Other services still sit at sortOrder 0, so assert the trio's relative
    // order rather than assuming they occupy the first three rows.
    const after = await http.get('/api/v1/services').query({ kind: 'BARBER' }).expect(200);
    const positions = reversed.map((id: string) =>
      after.body.findIndex((s: { id: string }) => s.id === id),
    );
    expect(positions.every((p: number) => p >= 0)).toBe(true);
    expect([...positions].sort((a: number, b: number) => a - b)).toEqual(positions);

    await http
      .put('/api/v1/services/order')
      .set(auth(adminToken))
      .send({ serviceIds: ['does-not-exist'] })
      .expect(400);
  });
});
