import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

describe('Accounts, coupons & the sales vault (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let customerToken: string;
  let customerId: string;
  let adminToken: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('acct'), password: 'Lifestyle!1', firstName: 'Amy', lastName: 'Grech' })
      .expect(201);
    customerToken = reg.body.accessToken;
    customerId = reg.body.user.id;
    adminToken = (
      await http.post('/api/v1/auth/login').send({ email: 'norbert@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
    await prisma.accountMember.deleteMany({ where: { accountId: customerId } });
    await prisma.vehicle.deleteMany({ where: { ownerId: customerId } });
    await prisma.coupon.deleteMany({ where: { code: 'E2ETEN' } });
    await prisma.appSetting.update({ where: { key: 'sales.hidden' }, data: { value: 'false' } });
    await app.close();
  });

  it('manages vehicles on the account', async () => {
    const v = await http
      .post('/api/v1/account/vehicles')
      .set(auth(customerToken))
      .send({ reg: 'qrt 918', make: 'BMW', model: '3 Series', size: 'MEDIUM' })
      .expect(201);
    expect(v.body.reg).toBe('QRT 918');

    await http
      .post('/api/v1/account/vehicles')
      .set(auth(customerToken))
      .send({ reg: 'QRT 918', make: 'BMW', model: '3 Series', size: 'MEDIUM' })
      .expect(400); // duplicate reg on the same account

    const list = await http.get('/api/v1/account/vehicles').set(auth(customerToken)).expect(200);
    expect(list.body).toHaveLength(1);

    await http.delete(`/api/v1/account/vehicles/${v.body.id}`).set(auth(customerToken)).expect(200);
    const after = await http.get('/api/v1/account/vehicles').set(auth(customerToken)).expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('books for a family member; points stay on the parent account', async () => {
    const member = await http
      .post('/api/v1/account/members')
      .set(auth(customerToken))
      .send({ name: 'Leo Grech', birthYear: 2019 })
      .expect(201);

    const naxxar = await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } });
    const louis = await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } });
    const boysCut = await prisma.service.findUniqueOrThrow({ where: { slug: 'boy-haircut' } });
    const booking = await http
      .post('/api/v1/bookings')
      .set(auth(customerToken))
      .send({
        locationId: naxxar.id,
        serviceId: boysCut.id,
        startsAt: `${futureDate(12)}T10:00:00.000Z`,
        barberId: louis.id,
        memberId: member.body.id,
      })
      .expect(201);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: booking.body.id } });
    expect(appt.memberId).toBe(member.body.id);
    expect(appt.customerId).toBe(customerId); // the visit stays on the parent account

    // A member from another account is refused.
    await http
      .post('/api/v1/bookings')
      .set(auth(customerToken))
      .send({
        locationId: naxxar.id,
        serviceId: boysCut.id,
        startsAt: `${futureDate(12)}T11:00:00.000Z`,
        barberId: louis.id,
        memberId: 'not-my-member',
      })
      .expect(400);
  });

  it('validates seeded and admin-created coupons', async () => {
    const bf = await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'blackfriday10', amountCents: 2000 })
      .expect(201);
    expect(bf.body.discountCents).toBe(200); // 10% of €20

    await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'NOPE', amountCents: 2000 })
      .expect(400);

    const created = await http
      .post('/api/v1/coupons')
      .set(auth(adminToken))
      .send({ code: 'E2ETEN', kind: 'AMOUNT', value: 1000 })
      .expect(201);
    const v = await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'E2ETEN', amountCents: 700 })
      .expect(201);
    expect(v.body.discountCents).toBe(700); // capped at the amount due

    await http.patch(`/api/v1/coupons/${created.body.id}`).set(auth(adminToken)).send({ isActive: false }).expect(200);
    await http
      .post('/api/v1/coupons/validate')
      .set(auth(customerToken))
      .send({ code: 'E2ETEN', amountCents: 700 })
      .expect(400);

    // Customers cannot manage codes.
    await http.get('/api/v1/coupons').set(auth(customerToken)).expect(403);
  });

  it('exposes the loyalty point value and lets the admin tune it', async () => {
    const before = await http.get('/api/v1/coupons/loyalty-point-value').set(auth(customerToken)).expect(200);
    expect(before.body.pointValueCents).toBe(5);
    await http
      .put('/api/v1/coupons/loyalty-point-value')
      .set(auth(customerToken))
      .send({ pointValueCents: 10 })
      .expect(403);
    await http
      .put('/api/v1/coupons/loyalty-point-value')
      .set(auth(adminToken))
      .send({ pointValueCents: 10 })
      .expect(200);
    const after = await http.get('/api/v1/coupons/loyalty-point-value').set(auth(customerToken)).expect(200);
    expect(after.body.pointValueCents).toBe(10);
    await http
      .put('/api/v1/coupons/loyalty-point-value')
      .set(auth(adminToken))
      .send({ pointValueCents: 5 })
      .expect(200);
  });

  it('shows staff the item counts but never money', async () => {
    const andrea = (
      await http.post('/api/v1/auth/login').send({ email: 'andrea@taspiru.com', password: 'Staff!2026' }).expect(200)
    ).body.accessToken;
    const counts = await http.get('/api/v1/reports/sales-counts').set(auth(andrea)).expect(200);
    expect(counts.body).toEqual(
      expect.objectContaining({
        barberServices: expect.any(Number),
        washServices: expect.any(Number),
        productsSold: expect.any(Number),
      }),
    );
    expect(JSON.stringify(counts.body)).not.toContain('amountCents');
    await http.get('/api/v1/reports/sales-counts').set(auth(customerToken)).expect(403);
  });

  it('opens the vault with the code, wipes on the reversed code, and restores', async () => {
    // Wrong code
    await http.post('/api/v1/reports/sales-vault').set(auth(adminToken)).send({ code: '0000' }).expect(403);

    // Correct code opens money + timeclock
    const open = await http.post('/api/v1/reports/sales-vault').set(auth(adminToken)).send({ code: '1979' }).expect(200);
    expect(open.body.wiped).toBe(false);
    expect(open.body.revenue).toBeDefined();
    expect(open.body.timeclock).toBeDefined();

    // The legacy money endpoint needs the vault code header
    await http.get('/api/v1/reports/revenue-splits').set(auth(adminToken)).expect(403);
    await http
      .get('/api/v1/reports/revenue-splits')
      .set(auth(adminToken))
      .set('x-vault-code', '1979')
      .expect(200);

    // Reversed code = self-destruct
    const wiped = await http.post('/api/v1/reports/sales-vault').set(auth(adminToken)).send({ code: '9791' }).expect(200);
    expect(wiped.body.wiped).toBe(true);
    const stillWiped = await http
      .post('/api/v1/reports/sales-vault')
      .set(auth(adminToken))
      .send({ code: '1979' })
      .expect(200);
    expect(stillWiped.body.wiped).toBe(true);
    await http
      .get('/api/v1/reports/revenue-splits')
      .set(auth(adminToken))
      .set('x-vault-code', '1979')
      .expect(403); // even the right header cannot see wiped sales

    // Restore with the forward code
    await http.post('/api/v1/reports/sales-vault/restore').set(auth(adminToken)).send({ code: '9791' }).expect(403);
    await http.post('/api/v1/reports/sales-vault/restore').set(auth(adminToken)).send({ code: '1979' }).expect(200);
    const back = await http.post('/api/v1/reports/sales-vault').set(auth(adminToken)).send({ code: '1979' }).expect(200);
    expect(back.body.wiped).toBe(false);

    // Non-admins never reach the vault.
    await http.post('/api/v1/reports/sales-vault').set(auth(customerToken)).send({ code: '1979' }).expect(403);
  });
});
