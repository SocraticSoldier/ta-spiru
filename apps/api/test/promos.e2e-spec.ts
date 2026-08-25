import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, uniqueEmail } from './helpers';

describe('Side rails / promo tiles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let customerToken: string;
  const created: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  // Not async — supertest's chainable request has to survive, so `.expect()`
  // can still be hung off the end of it.
  const makeTile = (body: Record<string, unknown>, token = adminToken) =>
    http.post('/api/v1/promos').set(auth(token)).send(body);

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
        .send({ email: uniqueEmail('promo'), password: 'Lifestyle!1', firstName: 'C', lastName: 'U' })
        .expect(201)
    ).body.accessToken;
  });

  afterAll(async () => {
    if (created.length > 0) {
      await prisma.promoTile.deleteMany({ where: { id: { in: created } } });
    }
    await app.close();
  });

  it('lets a Vimeo reel stand on its own with no poster image', async () => {
    const res = await makeTile({
      rail: 'RIGHT_SOCIAL',
      title: 'Skin fade',
      videoUrl: 'https://vimeo.com/987654321',
      linkUrl: 'https://vimeo.com/987654321',
      network: 'VIMEO',
      sortOrder: 1,
    }).expect(201);
    created.push(res.body.id);

    expect(res.body.imageUrl).toBeNull();
    expect(res.body.network).toBe('VIMEO');
    expect(res.body.videoUrl).toBe('https://vimeo.com/987654321');
  });

  it('refuses a tile that would have nothing to show', async () => {
    // No poster, and a link nobody can embed — this tile would render blank.
    await makeTile({
      rail: 'RIGHT_SOCIAL',
      videoUrl: 'https://www.tiktok.com/@taspiru/video/7300000000000000000',
      linkUrl: 'https://www.tiktok.com/@taspiru/video/7300000000000000000',
      network: 'TIKTOK',
    }).expect(400);

    await makeTile({ rail: 'LEFT_AD', linkUrl: 'https://taspiru.com/offers' }).expect(400);
  });

  it('still accepts an Instagram or TikTok tile behind a poster', async () => {
    const res = await makeTile({
      rail: 'RIGHT_SOCIAL',
      imageUrl: '/promos/reel-ig.jpg',
      videoUrl: 'https://www.instagram.com/reel/Cabc123/',
      linkUrl: 'https://www.instagram.com/reel/Cabc123/',
      network: 'INSTAGRAM',
      sortOrder: 2,
    }).expect(201);
    created.push(res.body.id);
    expect(res.body.imageUrl).toBe('/promos/reel-ig.jpg');
  });

  it('drops the network badge on the left rail, where it means nothing', async () => {
    const res = await makeTile({
      rail: 'LEFT_AD',
      imageUrl: '/promos/house-offer.jpg',
      linkUrl: 'https://taspiru.com/offers',
      network: 'VIMEO',
      sortOrder: 3,
    }).expect(201);
    created.push(res.body.id);
    expect(res.body.network).toBeNull();
  });

  it('keeps the rails out of everyone but a manager', async () => {
    await makeTile({ rail: 'LEFT_AD', imageUrl: '/x.jpg', linkUrl: 'https://taspiru.com' }, customerToken).expect(403);
    await http.get('/api/v1/promos/all').set(auth(customerToken)).expect(403);
    await http.get('/api/v1/promos/all').expect(401);
    await http.get('/api/v1/promos/all').set(auth(adminToken)).expect(200);
  });

  it('shows the public rail without a login, but only what is live', async () => {
    const paused = await makeTile({
      rail: 'LEFT_AD',
      imageUrl: '/promos/paused.jpg',
      linkUrl: 'https://taspiru.com/paused',
      isActive: false,
    }).expect(201);
    created.push(paused.body.id);

    const finished = await makeTile({
      rail: 'LEFT_AD',
      imageUrl: '/promos/summer.jpg',
      linkUrl: 'https://taspiru.com/summer',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-01-31T00:00:00.000Z',
    }).expect(201);
    created.push(finished.body.id);

    const live = await http.get('/api/v1/promos').expect(200);
    const ids = (live.body as { id: string }[]).map((t) => t.id);
    expect(ids).not.toContain(paused.body.id);
    expect(ids).not.toContain(finished.body.id);
    expect(ids).toContain(created[0]);

    // The admin view has to see the drafts too, or they cannot be turned on.
    const all = await http.get('/api/v1/promos/all').set(auth(adminToken)).expect(200);
    expect((all.body as { id: string }[]).map((t) => t.id)).toEqual(expect.arrayContaining([paused.body.id]));
  });

  it('filters by rail', async () => {
    const res = await http.get('/api/v1/promos').query({ rail: 'RIGHT_SOCIAL' }).expect(200);
    expect((res.body as { rail: string }[]).every((t) => t.rail === 'RIGHT_SOCIAL')).toBe(true);
  });

  it('counts a click and only ever hands back the tile’s own link', async () => {
    const id = created[0];
    const before = await prisma.promoTile.findUniqueOrThrow({ where: { id } });

    const res = await http.post(`/api/v1/promos/${id}/click`).expect(200);
    expect(res.body.linkUrl).toBe(before.linkUrl);
    expect(Object.keys(res.body)).toEqual(['linkUrl']);

    await http.post(`/api/v1/promos/${id}/impression`).expect(204);

    const after = await prisma.promoTile.findUniqueOrThrow({ where: { id } });
    expect(after.clicks).toBe(before.clicks + 1);
    expect(after.impressions).toBe(before.impressions + 1);
  });

  it('does not blow up on a tile that is gone', async () => {
    await http.post('/api/v1/promos/does-not-exist/click').expect(404);
    // A view counter is never worth an error in the visitor's face.
    await http.post('/api/v1/promos/does-not-exist/impression').expect(204);
  });

  it('pauses and deletes a tile', async () => {
    const res = await makeTile({
      rail: 'LEFT_AD',
      imageUrl: '/promos/temp.jpg',
      linkUrl: 'https://taspiru.com/temp',
    }).expect(201);
    const id = res.body.id as string;

    const paused = await http
      .patch(`/api/v1/promos/${id}`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);
    expect(paused.body.isActive).toBe(false);

    await http.delete(`/api/v1/promos/${id}`).set(auth(customerToken)).expect(403);
    await http.delete(`/api/v1/promos/${id}`).set(auth(adminToken)).expect(200);
    await http.delete(`/api/v1/promos/${id}`).set(auth(adminToken)).expect(404);
  });
});
