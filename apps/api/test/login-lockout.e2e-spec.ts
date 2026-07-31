import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, uniqueEmail } from './helpers';

/**
 * The station PIN is four digits. Without a lockout the whole keyspace is
 * walkable in an afternoon, so these tests are the thing standing between a
 * stranger and the till at a barber-operated branch.
 */
describe('Sign-in lockout & audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const email = uniqueEmail('lock');
  const password = 'Lifestyle!1';
  let userId: string;
  let pamaId: string;
  let naxxarId: string;

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    pamaId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'pama' } })).id;
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;

    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Lock', lastName: 'Test' })
      .expect(201);
    userId = reg.body.user.id;
  });

  afterEach(async () => {
    // Each test starts from a clean slate so one lockout does not leak forward.
    await prisma.loginAttempt.deleteMany({
      where: { OR: [{ identifier: email.toLowerCase() }, { identifier: pamaId }] },
    });
  });

  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('records every sign-in attempt, good and bad', async () => {
    await http.post('/api/v1/auth/login').send({ email, password }).expect(200);
    await http.post('/api/v1/auth/login').send({ email, password: 'WrongPassword1' }).expect(401);

    const rows = await prisma.loginAttempt.findMany({
      where: { identifier: email.toLowerCase() },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.succeeded)).toEqual([true, false]);
    expect(rows[0]?.kind).toBe('PASSWORD');
    expect(rows[0]?.userId).toBe(userId);
    // A failure must not reveal which account it was for.
    expect(rows[1]?.userId).toBeNull();
  });

  it('locks a password after ten straight failures, then answers 429', async () => {
    for (let i = 0; i < 10; i += 1) {
      await http.post('/api/v1/auth/login').send({ email, password: `WrongPass-${i}` }).expect(401);
    }
    // The eleventh is refused before the password is even checked.
    const locked = await http.post('/api/v1/auth/login').send({ email, password }).expect(429);
    expect(locked.body.message).toMatch(/too many failed attempts/i);
  });

  it('lets the right password through while attempts are still under the limit', async () => {
    for (let i = 0; i < 9; i += 1) {
      await http.post('/api/v1/auth/login').send({ email, password: `WrongPass-${i}` }).expect(401);
    }
    await http.post('/api/v1/auth/login').send({ email, password }).expect(200);
  });

  it('clears the count once a sign-in succeeds', async () => {
    for (let i = 0; i < 9; i += 1) {
      await http.post('/api/v1/auth/login').send({ email, password: `WrongPass-${i}` }).expect(401);
    }
    await http.post('/api/v1/auth/login').send({ email, password }).expect(200);

    // Nine more would trip the limit if the success had not reset it.
    for (let i = 0; i < 9; i += 1) {
      await http.post('/api/v1/auth/login').send({ email, password: `AgainWrong-${i}` }).expect(401);
    }
    await http.post('/api/v1/auth/login').send({ email, password }).expect(200);
  });

  it('counts an unknown email too, so probing is not free', async () => {
    const stranger = uniqueEmail('ghost');
    await http.post('/api/v1/auth/login').send({ email: stranger, password: 'NotAPassword1' }).expect(401);

    const rows = await prisma.loginAttempt.findMany({
      where: { identifier: stranger.toLowerCase() },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.succeeded).toBe(false);
    await prisma.loginAttempt.deleteMany({ where: { identifier: stranger.toLowerCase() } });
  });

  it('shuts the station screen after five wrong PINs', async () => {
    for (let i = 0; i < 5; i += 1) {
      await http
        .post('/api/v1/auth/station-login')
        .send({ locationId: pamaId, pin: `900${i}` })
        .expect(401);
    }
    // Even a PIN that would have worked is refused while the branch is locked.
    const locked = await http
      .post('/api/v1/auth/station-login')
      .send({ locationId: pamaId, pin: '1234' })
      .expect(429);
    expect(locked.body.message).toMatch(/too many failed attempts/i);
  });

  it('locks the branch that was guessed at, not every branch', async () => {
    for (let i = 0; i < 5; i += 1) {
      await http
        .post('/api/v1/auth/station-login')
        .send({ locationId: pamaId, pin: `800${i}` })
        .expect(401);
    }
    await http.post('/api/v1/auth/station-login').send({ locationId: pamaId, pin: '1234' }).expect(429);

    // Naxxar has a reception desk, so it answers on its own merits — a 400,
    // not the 429 that would mean Pama's lockout had spread to it.
    await http
      .post('/api/v1/auth/station-login')
      .send({ locationId: naxxarId, pin: '1234' })
      .expect(400);
  });

  it('stamps the caller on the audit row', async () => {
    await http
      .post('/api/v1/auth/login')
      .set('User-Agent', 'TaSpiruTest/1.0')
      .send({ email, password })
      .expect(200);

    const row = await prisma.loginAttempt.findFirstOrThrow({
      where: { identifier: email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
    expect(row.userAgent).toBe('TaSpiruTest/1.0');
    expect(row.ip).toBeTruthy();
  });
});
