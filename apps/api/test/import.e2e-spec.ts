import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, uniqueEmail } from './helpers';

describe('Customer import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let customerToken: string;
  const importedEmail = uniqueEmail('legacy');
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    customerToken = (
      await http
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('impcust'), password: 'Lifestyle!1', firstName: 'I', lastName: 'C' })
        .expect(201)
    ).body.accessToken;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { OR: [{ email: importedEmail }, { email: { contains: '@import.taspiru.com' } }] },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const accounts = await prisma.loyaltyAccount.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    await prisma.loyaltyLedgerEntry.deleteMany({ where: { accountId: { in: accounts.map((a) => a.id) } } });
    await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('is admin only', async () => {
    await http
      .post('/api/v1/import/customers')
      .set(auth(customerToken))
      .send({ customers: [] })
      .expect(403);
  });

  it('previews a dry run without writing', async () => {
    const res = await http
      .post('/api/v1/import/customers')
      .set(auth(adminToken))
      .send({
        dryRun: true,
        customers: [{ email: importedEmail, firstName: 'Legacy', lastName: 'Customer', previousSpendCents: 12000 }],
      })
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ dryRun: true, received: 1, created: 1, pointsAwarded: 120 }),
    );
    expect(await prisma.user.findUnique({ where: { email: importedEmail } })).toBeNull();
  });

  it('imports customers and converts past spend into points', async () => {
    const res = await http
      .post('/api/v1/import/customers')
      .set(auth(adminToken))
      .send({
        customers: [
          {
            email: importedEmail,
            firstName: 'Legacy',
            lastName: 'Customer',
            previousBookings: 8,
            previousSpendCents: 12000,
            workplace: 'Pama',
          },
          { phone: '+35679000999', firstName: 'PhoneOnly', previousSpendCents: 4500 },
          { firstName: 'NoContact' }, // cannot be identified
        ],
      })
      .expect(200);

    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors[0].reason).toMatch(/email or phone/i);
    expect(res.body.pointsAwarded).toBe(120 + 45);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: importedEmail } });
    expect(user.workplace).toBe('Pama');
    expect(user.passwordHash).toBeNull(); // they claim the account in the app

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(account.balancePoints).toBe(120);
    expect(account.lifetimePoints).toBe(120);
  });

  it('is idempotent — re-running does not double the points', async () => {
    const res = await http
      .post('/api/v1/import/customers')
      .set(auth(adminToken))
      .send({
        customers: [{ email: importedEmail, firstName: 'Legacy', lastName: 'Customer', previousSpendCents: 12000 }],
      })
      .expect(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.pointsAwarded).toBe(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: importedEmail } });
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(account.balancePoints).toBe(120);
  });

  it('refuses to overwrite a staff account and reports the status', async () => {
    const res = await http
      .post('/api/v1/import/customers')
      .set(auth(adminToken))
      .send({ customers: [{ email: 'louis@taspiru.com', firstName: 'Louis' }] })
      .expect(200);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors[0].reason).toMatch(/staff account/i);

    const status = await http.get('/api/v1/import/status').set(auth(adminToken)).expect(200);
    expect(status.body.customers).toBeGreaterThan(0);
    expect(status.body.returningCustomerMessage).toMatch(/download our app/i);
  });
});
