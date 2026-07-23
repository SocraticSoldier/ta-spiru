import { hashSync } from 'bcryptjs';
import {
  LedgerTag,
  PrismaClient,
  ProductCategory,
  ResourceKind,
  Role,
  ServiceKind,
} from '@prisma/client';

const prisma = new PrismaClient();

interface BranchSeed {
  slug: string;
  name: string;
  address: string;
  chairs: number;
  bays: number;
}

const BRANCHES: readonly BranchSeed[] = [
  { slug: 'naxxar', name: 'Naxxar', address: 'Flagship Barbershop & Detailing Hub, Naxxar', chairs: 4, bays: 2 },
  { slug: 'pama', name: 'Pama', address: 'Pama Shopping Village, Mosta', chairs: 3, bays: 1 },
  { slug: 'san-gwann', name: 'San Ġwann', address: 'San Ġwann', chairs: 3, bays: 0 },
  { slug: 'fgura', name: 'Fgura', address: 'Fgura', chairs: 2, bays: 0 },
  { slug: 'san-giljan', name: "San Ġiljan – St George's Mall", address: "St George's Mall, San Ġiljan", chairs: 3, bays: 0 },
];

interface ServiceSeed {
  slug: string;
  name: string;
  kind: ServiceKind;
  durationMin: number;
  priceCents: number;
  ledgerTag: LedgerTag;
  isComboEligible: boolean;
}

const SERVICES: readonly ServiceSeed[] = [
  { slug: 'skin-fade', name: 'Skin Fade', kind: ServiceKind.BARBER, durationMin: 45, priceCents: 2500, ledgerTag: LedgerTag.BARBER_SERVICES, isComboEligible: true },
  { slug: 'haircut-beard-sculpt', name: 'Haircut & Beard Sculpt (Hot Towel)', kind: ServiceKind.BARBER, durationMin: 60, priceCents: 3500, ledgerTag: LedgerTag.BARBER_SERVICES, isComboEligible: true },
  { slug: 'deep-cleansing-facial', name: 'Deep-Cleansing Facial Treatment', kind: ServiceKind.BARBER, durationMin: 40, priceCents: 3000, ledgerTag: LedgerTag.BARBER_SERVICES, isComboEligible: false },
  { slug: 'exterior-wash', name: 'Exterior Wash', kind: ServiceKind.WASH, durationMin: 30, priceCents: 1500, ledgerTag: LedgerTag.CAR_DETAILING, isComboEligible: true },
  { slug: 'interior-exterior-wash', name: 'Interior & Exterior Wash', kind: ServiceKind.WASH, durationMin: 60, priceCents: 3000, ledgerTag: LedgerTag.CAR_DETAILING, isComboEligible: true },
  { slug: 'premium-valet', name: 'Premium Valeting', kind: ServiceKind.WASH, durationMin: 120, priceCents: 9500, ledgerTag: LedgerTag.CAR_DETAILING, isComboEligible: false },
];

interface ProductSeed {
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: ProductCategory;
  priceCents: number;
  ledgerTag: LedgerTag;
}

const PRODUCTS: readonly ProductSeed[] = [
  { sku: 'TS-WAX-MATT', barcode: '5290001000011', name: 'Matt Pomade', brand: "Ta' Spiru Cosmetics", category: ProductCategory.STYLING_WAX, priceCents: 1450, ledgerTag: LedgerTag.RETAIL_BARBER },
  { sku: 'TS-WAX-CEMENT', barcode: '5290001000028', name: 'Cement Wax', brand: "Ta' Spiru Cosmetics", category: ProductCategory.STYLING_WAX, priceCents: 1450, ledgerTag: LedgerTag.RETAIL_BARBER },
  { sku: 'TS-SHMP-250', barcode: '5290001000035', name: 'Daily Shampoo 250ml', brand: "Ta' Spiru Cosmetics", category: ProductCategory.HAIR_CARE, priceCents: 1200, ledgerTag: LedgerTag.RETAIL_BARBER },
  { sku: 'TS-BEARD-OIL', barcode: '5290001000042', name: 'Beard Oil', brand: "Ta' Spiru Cosmetics", category: ProductCategory.SHAVE_BEARD, priceCents: 1600, ledgerTag: LedgerTag.RETAIL_BARBER },
  { sku: 'WS-SNOWFOAM-1L', barcode: '5290002000010', name: 'Snow Foam 1L', brand: 'Work Stuff', category: ProductCategory.DETAILING_CHEMICAL, priceCents: 1900, ledgerTag: LedgerTag.RETAIL_CAR_CARE },
  { sku: 'GS-IRON-GEL', barcode: '5290002000027', name: 'Iron Remover GEL', brand: 'Good Stuff', category: ProductCategory.DETAILING_CHEMICAL, priceCents: 2200, ledgerTag: LedgerTag.RETAIL_CAR_CARE },
  { sku: 'WS-DRY-TOWEL', barcode: '5290002000034', name: 'Drying Towel XL', brand: 'Work Stuff', category: ProductCategory.DETAILING_HARDWARE, priceCents: 2500, ledgerTag: LedgerTag.RETAIL_CAR_CARE },
];

interface StaffSeed {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  branchSlug: string;
}

const STAFF: readonly StaffSeed[] = [
  { email: 'barber.naxxar1@taspiru.com', firstName: 'Luca', lastName: 'Borg', role: Role.BARBER, branchSlug: 'naxxar' },
  { email: 'barber.naxxar2@taspiru.com', firstName: 'Matteo', lastName: 'Vella', role: Role.BARBER, branchSlug: 'naxxar' },
  { email: 'barber.pama@taspiru.com', firstName: 'Karl', lastName: 'Farrugia', role: Role.BARBER, branchSlug: 'pama' },
  { email: 'barber.sangwann@taspiru.com', firstName: 'Dylan', lastName: 'Micallef', role: Role.BARBER, branchSlug: 'san-gwann' },
  { email: 'barber.fgura@taspiru.com', firstName: 'Sean', lastName: 'Camilleri', role: Role.BARBER, branchSlug: 'fgura' },
  { email: 'barber.sangiljan@taspiru.com', firstName: 'Andrea', lastName: 'Grech', role: Role.BARBER, branchSlug: 'san-giljan' },
  { email: 'wash.naxxar@taspiru.com', firstName: 'Owen', lastName: 'Zammit', role: Role.WASH_ATTENDANT, branchSlug: 'naxxar' },
  { email: 'wash.pama@taspiru.com', firstName: 'Jake', lastName: 'Abela', role: Role.WASH_ATTENDANT, branchSlug: 'pama' },
  { email: 'reception.naxxar@taspiru.com', firstName: 'Elena', lastName: 'Sant', role: Role.RECEPTIONIST, branchSlug: 'naxxar' },
  { email: 'manager.naxxar@taspiru.com', firstName: 'Chris', lastName: 'Attard', role: Role.MANAGER, branchSlug: 'naxxar' },
];

const SHIFT_DAYS_AHEAD = 14;
const MALTA_TZ = 'Europe/Malta';

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return asUtc - date.getTime();
};

const zonedTimeToUtc = (isoDate: string, time: string, timeZone: string): Date => {
  const naiveUtc = new Date(`${isoDate}T${time}:00.000Z`);
  return new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(naiveUtc, timeZone));
};

const WEEKDAYS_OPEN = [1, 2, 3, 4, 5, 6]; // Monday–Saturday

const main = async (): Promise<void> => {
  for (const branch of BRANCHES) {
    const location = await prisma.location.upsert({
      where: { slug: branch.slug },
      update: { name: branch.name, address: branch.address },
      create: { slug: branch.slug, name: branch.name, address: branch.address },
    });

    for (const weekday of WEEKDAYS_OPEN) {
      await prisma.openingHours.upsert({
        where: { locationId_weekday: { locationId: location.id, weekday } },
        update: {},
        create: { locationId: location.id, weekday, opensAt: '09:00', closesAt: '19:00' },
      });
    }

    for (let i = 1; i <= branch.chairs; i += 1) {
      await prisma.resource.upsert({
        where: { locationId_name: { locationId: location.id, name: `Chair ${i}` } },
        update: {},
        create: { locationId: location.id, kind: ResourceKind.BARBER_CHAIR, name: `Chair ${i}` },
      });
    }
    for (let i = 1; i <= branch.bays; i += 1) {
      await prisma.resource.upsert({
        where: { locationId_name: { locationId: location.id, name: `Bay ${i}` } },
        update: {},
        create: { locationId: location.id, kind: ResourceKind.WASH_BAY, name: `Bay ${i}` },
      });
    }
  }

  const locations = await prisma.location.findMany({ select: { id: true } });
  for (const spec of SERVICES) {
    const service = await prisma.service.upsert({
      where: { slug: spec.slug },
      update: { priceCents: spec.priceCents, durationMin: spec.durationMin },
      create: { ...spec },
    });
    for (const { id: locationId } of locations) {
      await prisma.locationService.upsert({
        where: { locationId_serviceId: { locationId, serviceId: service.id } },
        update: {},
        create: { locationId, serviceId: service.id },
      });
    }
  }

  for (const spec of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: spec.sku },
      update: { priceCents: spec.priceCents, barcode: spec.barcode },
      create: { ...spec },
    });
    for (const { id: locationId } of locations) {
      await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: product.id, locationId } },
        update: {},
        create: { productId: product.id, locationId, quantity: 24, reorderThreshold: 6 },
      });
    }
  }

  await prisma.user.upsert({
    where: { email: 'admin@taspiru.com' },
    update: {},
    create: {
      email: 'admin@taspiru.com',
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      passwordHash: hashSync('ChangeMe!2026', 12),
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@taspiru.com' },
    update: {},
    create: {
      email: 'customer@taspiru.com',
      firstName: 'Test',
      lastName: 'Customer',
      role: Role.CUSTOMER,
      passwordHash: hashSync('Customer!2026', 12),
    },
  });

  const staffPasswordHash = hashSync('Staff!2026', 12);
  const staffPinHash = hashSync('1234', 10);
  const locationBySlug = new Map(
    (await prisma.location.findMany({ select: { id: true, slug: true } })).map((location) => [
      location.slug,
      location.id,
    ]),
  );

  for (const spec of STAFF) {
    const locationId = locationBySlug.get(spec.branchSlug);
    if (!locationId) {
      continue;
    }
    const staff = await prisma.user.upsert({
      where: { email: spec.email },
      update: { locationId, role: spec.role },
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
        locationId,
        passwordHash: staffPasswordHash,
        pinHash: staffPinHash,
      },
    });

    if (spec.role !== Role.BARBER && spec.role !== Role.WASH_ATTENDANT) {
      continue;
    }
    // Re-seed the rolling roster: 09:00–19:00 local, Monday–Saturday.
    const today = new Date();
    await prisma.shift.deleteMany({ where: { userId: staff.id, startsAt: { gte: today } } });
    const shifts: { userId: string; locationId: string; startsAt: Date; endsAt: Date }[] = [];
    for (let offset = 0; offset < SHIFT_DAYS_AHEAD; offset += 1) {
      const day = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
      if (day.getUTCDay() === 0) {
        continue;
      }
      const isoDate = day.toISOString().slice(0, 10);
      shifts.push({
        userId: staff.id,
        locationId,
        startsAt: zonedTimeToUtc(isoDate, '09:00', MALTA_TZ),
        endsAt: zonedTimeToUtc(isoDate, '19:00', MALTA_TZ),
      });
    }
    await prisma.shift.createMany({ data: shifts });
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
