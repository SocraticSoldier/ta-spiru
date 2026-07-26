import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootTestApp, futureDate, uniqueEmail } from './helpers';

/**
 * The customer booking flow walks Haircuts -> Beards -> Add-ons and books the
 * lot as one sitting, so availability has to reserve the whole run and the
 * segments have to land back-to-back under a single visit group.
 */
describe('Multi-service visits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let customerId: string;
  let naxxarId: string;
  const date = futureDate(10); // a weekday no other suite books on

  let haircutId: string;
  let beardId: string;
  let addonId: string;
  /** The stretch taken by the visit booked below — reused by the clash test. */
  let bookedVisit: { startsAt: string; barberId: string };

  beforeAll(async () => {
    const ctx = await bootTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = request(app.getHttpServer());
    naxxarId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } })).id;
    haircutId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'haircut' } })).id;
    beardId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'beard-grooming' } })).id;
    addonId = (await prisma.service.findUniqueOrThrow({ where: { slug: 'nose-waxing' } })).id;

    const reg = await http
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('visit'), password: 'Lifestyle!1', firstName: 'Visit', lastName: 'Test' })
      .expect(201);
    token = reg.body.accessToken;
    customerId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { customerId } });
    await app.close();
  });

  it('files every service under a booking card', async () => {
    const services = await http.get('/api/v1/services').expect(200);
    const bySlug = (slug: string) =>
      services.body.find((s: { slug: string }) => s.slug === slug);

    expect(bySlug('haircut').category).toBe('HAIRCUT');
    expect(bySlug('beard-grooming').category).toBe('BEARD');
    expect(bySlug('nose-waxing').category).toBe('ADDON');
    expect(bySlug('exterior-wash').category).toBe('WASH');
  });

  it('puts combos at the top of their card', async () => {
    const services = await http.get('/api/v1/services').query({ category: 'HAIRCUT' }).expect(200);
    const rows: { isComboEligible: boolean }[] = services.body;
    expect(rows.length).toBeGreaterThan(1);

    // Everything combo-eligible must come before anything that isn't.
    const firstNonCombo = rows.findIndex((row) => !row.isComboEligible);
    if (firstNonCombo !== -1) {
      expect(rows.slice(firstNonCombo).every((row) => !row.isComboEligible)).toBe(true);
    }
  });

  it('widens the slot to fit the whole visit, not just the haircut', async () => {
    const [cut, beard, addon] = await Promise.all([
      prisma.service.findUniqueOrThrow({ where: { id: haircutId } }),
      prisma.service.findUniqueOrThrow({ where: { id: beardId } }),
      prisma.service.findUniqueOrThrow({ where: { id: addonId } }),
    ]);

    const cutOnly = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId })
      .expect(200);
    const wholeVisit = await http
      .get('/api/v1/bookings/availability')
      .query({
        locationId: naxxarId,
        date,
        serviceId: haircutId,
        extraServiceIds: `${beardId},${addonId}`,
      })
      .expect(200);

    const spanOf = (slot: { startsAt: string; endsAt: string }): number =>
      (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;

    expect(spanOf(cutOnly.body[0])).toBe(cut.durationMin);
    expect(spanOf(wholeVisit.body[0])).toBe(cut.durationMin + beard.durationMin + addon.durationMin);
  });

  it('only offers the chosen barber when one is picked', async () => {
    const anyBarber = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId })
      .expect(200);
    const wanted: string = anyBarber.body[0].barberId;

    const pinned = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId, barberId: wanted })
      .expect(200);

    expect(pinned.body.length).toBeGreaterThan(0);
    expect(pinned.body.every((slot: { barberId: string }) => slot.barberId === wanted)).toBe(true);
  });

  it('books haircut, beard and add-on back-to-back as one visit', async () => {
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({
        locationId: naxxarId,
        date,
        serviceId: haircutId,
        extraServiceIds: `${beardId},${addonId}`,
      })
      .expect(200);
    const slot = slots.body[0];
    expect(slot).toBeDefined();
    bookedVisit = { startsAt: slot.startsAt, barberId: slot.barberId };

    const visit = await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId, beardId, addonId],
        startsAt: slot.startsAt,
        barberId: slot.barberId,
      })
      .expect(201);

    expect(visit.body.appointmentIds).toHaveLength(3);

    const booked = await prisma.appointment.findMany({
      where: { id: { in: visit.body.appointmentIds } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, endsAt: true, comboGroupId: true, serviceId: true, barberId: true },
    });

    // One visit group, one barber, and no gap or overlap between segments.
    const groups = new Set(booked.map((row) => row.comboGroupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBe(visit.body.visitGroupId);
    expect(new Set(booked.map((row) => row.barberId)).size).toBe(1);
    expect(booked.map((row) => row.serviceId)).toEqual([haircutId, beardId, addonId]);
    const boundaries = booked.slice(1).map((row, i) => [row.startsAt.getTime(), booked[i]?.endsAt.getTime()]);
    for (const [segmentStart, previousEnd] of boundaries) {
      expect(segmentStart).toBe(previousEnd);
    }
    expect(booked.at(-1)?.endsAt.toISOString()).toBe(visit.body.endsAt);
  });

  it('refuses the whole visit rather than booking half of it', async () => {
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId, extraServiceIds: beardId })
      .expect(200);
    const slot = slots.body[0];
    const before = await prisma.appointment.count({ where: { customerId } });

    await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        // Second id is not a real service: the first must not be booked either.
        serviceIds: [haircutId, 'does-not-exist'],
        startsAt: slot.startsAt,
        barberId: slot.barberId,
      })
      .expect(400);

    expect(await prisma.appointment.count({ where: { customerId } })).toBe(before);
  });

  it('turns away a visit that runs into an existing booking', async () => {
    // Same barber, same start as the visit booked above — that stretch is taken.
    await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId, beardId],
        startsAt: bookedVisit.startsAt,
        barberId: bookedVisit.barberId,
      })
      .expect(409);
  });

  it('stops offering the stretch it just booked', async () => {
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({
        locationId: naxxarId,
        date,
        serviceId: haircutId,
        extraServiceIds: `${beardId},${addonId}`,
        barberId: bookedVisit.barberId,
      })
      .expect(200);

    expect(
      slots.body.some((slot: { startsAt: string }) => slot.startsAt === bookedVisit.startsAt),
    ).toBe(false);
  });

  it('will not book a wash service as part of a barber visit', async () => {
    const wash = await prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } });
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId })
      .expect(200);

    await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId, wash.id],
        startsAt: slots.body[0].startsAt,
        barberId: slots.body[0].barberId,
      })
      .expect(400);
  });

  it('washes the car alongside the visit at Fgura, not after it', async () => {
    const fguraId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'fgura' } })).id;
    const wash = await prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } });
    const bay = await prisma.resource.findFirstOrThrow({
      where: { locationId: fguraId, kind: 'WASH_BAY', isActive: true },
    });

    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: fguraId, date, serviceId: haircutId, extraServiceIds: beardId })
      .expect(200);
    const slot = slots.body[0];
    expect(slot).toBeDefined();

    const visit = await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: fguraId,
        serviceIds: [haircutId, beardId],
        startsAt: slot.startsAt,
        barberId: slot.barberId,
        washServiceId: wash.id,
        washBayId: bay.id,
        vehicleReg: 'ABC 123',
      })
      .expect(201);

    expect(visit.body.washAppointmentId).not.toBeNull();
    expect(visit.body.appointmentIds).toHaveLength(3); // 2 barber segments + the wash

    const washRow = await prisma.appointment.findUniqueOrThrow({
      where: { id: visit.body.washAppointmentId },
      select: { startsAt: true, resourceId: true, comboGroupId: true, vehicleReg: true },
    });
    // The car goes on the bay as the customer sits down, not once they are done.
    expect(washRow.startsAt.toISOString()).toBe(visit.body.startsAt);
    expect(washRow.resourceId).toBe(bay.id);
    expect(washRow.comboGroupId).toBe(visit.body.visitGroupId);
    expect(washRow.vehicleReg).toBe('ABC 123');
  });

  it('rejects a car wash given without a bay', async () => {
    const wash = await prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } });
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId })
      .expect(200);

    await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId],
        startsAt: slots.body[0].startsAt,
        barberId: slots.body[0].barberId,
        washServiceId: wash.id,
      })
      .expect(400);
  });

  it('will not put a car on a bay at a branch that has none', async () => {
    const wash = await prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } });
    const fguraId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'fgura' } })).id;
    const fguraBay = await prisma.resource.findFirstOrThrow({
      where: { locationId: fguraId, kind: 'WASH_BAY' },
    });
    const slots = await http
      .get('/api/v1/bookings/availability')
      .query({ locationId: naxxarId, date, serviceId: haircutId })
      .expect(200);

    // Naxxar has no bays, so Fgura's bay must not be bookable through it.
    await http
      .post('/api/v1/bookings/visit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId],
        startsAt: slots.body[0].startsAt,
        barberId: slots.body[0].barberId,
        washServiceId: wash.id,
        washBayId: fguraBay.id,
      })
      .expect(400);
  });

  it('requires a signed-in customer', async () => {
    await http
      .post('/api/v1/bookings/visit')
      .send({
        locationId: naxxarId,
        serviceIds: [haircutId],
        startsAt: `${date}T09:00:00.000Z`,
        barberId: 'anyone',
      })
      .expect(401);
  });
});
