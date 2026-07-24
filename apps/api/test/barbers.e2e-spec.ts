import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp } from './helpers';

describe('Barbers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists barbers at a location with seniority + station', async () => {
    const naxxar = await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } });
    const res = await http.get('/api/v1/barbers').query({ locationId: naxxar.id }).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    const louis = res.body.find((b: { firstName: string }) => b.firstName === 'Louis');
    expect(louis).toBeDefined();
    expect(louis.seniority).toBe('NORMAL');
    expect(typeof louis.stationNo).toBe('number');
  });

  it("resolves a barber's services, honouring per-member overrides", async () => {
    const louis = await prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } });
    const res = await http.get(`/api/v1/barbers/${louis.id}/services`).expect(200);

    const boysCut = res.body.find((s: { slug: string }) => s.slug === 'boy-haircut');
    expect(boysCut).toBeDefined();
    expect(boysCut.durationMin).toBe(15); // overridden from the 25-min default
    expect(boysCut.maxDaily).toBe(4);

    const skinFade = res.body.find((s: { slug: string }) => s.slug === 'skin-fade');
    expect(skinFade.priceCents).toBe(1400); // NORMAL tier
    expect(skinFade.maxDaily).toBeNull();
  });
});
