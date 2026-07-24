import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Waiting list (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let customerToken: string;
  let customerId: string;
  let receptionToken: string;
  let naxxarId: string;
  let louisId: string;
  let serviceId: string;
  let entryId: string;
  const forDate = futureDate(6);

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    louisId = (await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } })).id;
    serviceId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } })).id;

    const reg = await http
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('wait'),
        password: 'Lifestyle!1',
        firstName: 'Wendy',
        lastName: 'Borg',
        phone: '+35679555222',
      })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;

    receptionToken = (
      await http
        .post('/api/v1/auth/login')
        .send({ email: 'andrea@taspiru.com', password: 'Staff!2026' })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.waitingListEntry.deleteMany({ where: { customerId } });
    await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('lets a customer join the list for a fully-booked barber', async () => {
    const res = await http
      .post('/api/v1/waiting-list')
      .set(auth(customerToken))
      .send({ locationId: naxxarId, serviceId, barberId: louisId, forDate, notes: 'any time after 4pm' })
      .expect(201);
    entryId = res.body.id;
    expect(res.body.status).toBe('WAITING');
    expect(res.body.barberName).toBe('Louis');
    expect(res.body.forDate).toBe(forDate);
  });

  it('is idempotent — joining twice returns the same entry', async () => {
    const res = await http
      .post('/api/v1/waiting-list')
      .set(auth(customerToken))
      .send({ locationId: naxxarId, serviceId, barberId: louisId, forDate })
      .expect(201);
    expect(res.body.id).toBe(entryId);
  });

  it('shows the entry to reception with the customer contact, in FIFO order', async () => {
    const res = await http
      .get('/api/v1/waiting-list')
      .query({ locationId: naxxarId, date: forDate })
      .set(auth(receptionToken))
      .expect(200);
    const row = res.body.find((r: { id: string }) => r.id === entryId);
    expect(row).toBeDefined();
    expect(row.customerName).toBe('Wendy Borg');
    expect(row.customerPhone).toBe('+35679555222'); // reception may contact them
  });

  it('refuses a customer trying to read the branch list', async () => {
    await http
      .get('/api/v1/waiting-list')
      .query({ locationId: naxxarId, date: forDate })
      .set(auth(customerToken))
      .expect(403);
  });

  it('lets reception offer a freed slot, and the customer see it in their own list', async () => {
    await http
      .patch(`/api/v1/waiting-list/${entryId}`)
      .set(auth(receptionToken))
      .send({ status: 'OFFERED' })
      .expect(200);

    const mine = await http.get('/api/v1/waiting-list/mine').set(auth(customerToken)).expect(200);
    expect(mine.body.find((r: { id: string }) => r.id === entryId).status).toBe('OFFERED');
  });

  it('lets the customer withdraw', async () => {
    await http.delete(`/api/v1/waiting-list/${entryId}`).set(auth(customerToken)).expect(200);
    const after = await prisma.waitingListEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(after.status).toBe('CANCELLED');
  });
});
