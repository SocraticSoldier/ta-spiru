import { hashSync } from 'bcryptjs';
import {
  LedgerTag,
  PrismaClient,
  ProductCategory,
  ResourceKind,
  Role,
  Seniority,
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
  { slug: 'naxxar', name: 'Naxxar', address: 'Flagship Barbershop, Naxxar', chairs: 4, bays: 0 },
  { slug: 'pama', name: 'Pama', address: 'Pama Shopping Village, Mosta', chairs: 3, bays: 0 },
  { slug: 'san-gwann', name: 'San Ġwann', address: 'San Ġwann', chairs: 3, bays: 0 },
  // Fgura: barbershop + the car wash / detailing centre next door on Zabbar Road.
  { slug: 'fgura', name: 'Fgura', address: 'Barbershop & Car Wash, Zabbar Road, Fgura', chairs: 2, bays: 2 },
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
  isQuoteOnly?: boolean;
  tiered?: boolean; // barber haircuts: create Junior/Normal/Senior price tiers
}

// Real Ta' Spiru menus. Barber = Haircuts + Beard Grooming + Pampering (all BARBER).
// Car wash = size-priced washes as discrete rows (Small / Medium / Large-SUV),
// flat detailing, and quote-on-inspection services (isQuoteOnly, priceCents 0).
// NB: slugs `skin-fade` and `exterior-wash` are kept — e2e tests reference them.
const HAIR = LedgerTag.BARBER_SERVICES;
const WASH = LedgerTag.CAR_DETAILING;
const B = ServiceKind.BARBER;
const W = ServiceKind.WASH;

const SERVICES: readonly ServiceSeed[] = [
  // ── Barber · Haircuts ──
  { tiered: true, slug: 'boy-haircut', name: "Boy's Haircut (0-5 yrs)", kind: B, durationMin: 25, priceCents: 1100, ledgerTag: HAIR, isComboEligible: false },
  { tiered: true, slug: 'boy-scissors-haircut', name: "Boy's Scissors Haircut (0-5 yrs)", kind: B, durationMin: 30, priceCents: 1300, ledgerTag: HAIR, isComboEligible: false },
  { tiered: true, slug: 'haircut', name: 'Haircut', kind: B, durationMin: 30, priceCents: 1200, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'skin-fade', name: 'Skin Fade Haircut', kind: B, durationMin: 40, priceCents: 1400, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'clipper-head-shave', name: 'Clipper Head Shave', kind: B, durationMin: 20, priceCents: 1000, ledgerTag: HAIR, isComboEligible: false },
  { tiered: true, slug: 'clean-head-shave', name: 'Clean Head Shave', kind: B, durationMin: 30, priceCents: 1200, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'hot-towel-clean-head-shave', name: 'Hot Towel Clean Head Shave', kind: B, durationMin: 35, priceCents: 1200, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'premium-clean-head-shave', name: 'Premium Clean Head Shave', kind: B, durationMin: 35, priceCents: 1200, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'scissors-classic-haircut', name: 'Scissors Classic Haircut', kind: B, durationMin: 45, priceCents: 1600, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'long-scissors-haircut', name: 'Long Scissors Haircut', kind: B, durationMin: 45, priceCents: 1600, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'senior-haircut', name: '+65 Haircut', kind: B, durationMin: 40, priceCents: 1600, ledgerTag: HAIR, isComboEligible: true },
  { tiered: true, slug: 'hairstyling', name: 'Hairstyling', kind: B, durationMin: 15, priceCents: 600, ledgerTag: HAIR, isComboEligible: false },
  // ── Barber · Beard Grooming ──
  { slug: 'beard-grooming', name: 'Beard Grooming', kind: B, durationMin: 20, priceCents: 800, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'beard-clean-shave', name: 'Beard Clean Shave', kind: B, durationMin: 20, priceCents: 800, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'hot-towel-beard-grooming', name: 'Hot Towel Beard Grooming', kind: B, durationMin: 25, priceCents: 1000, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'hot-towel-beard-clean-shave', name: 'Hot Towel Beard Clean Shave', kind: B, durationMin: 25, priceCents: 1000, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'premium-beard-clean-shave', name: 'Premium Beard Clean Shave', kind: B, durationMin: 25, priceCents: 1000, ledgerTag: HAIR, isComboEligible: false },
  // ── Barber · Pampering ──
  { slug: 'shampoo-wash', name: 'Shampoo Wash', kind: B, durationMin: 10, priceCents: 300, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'hair-scalp-treatment', name: 'Hair Scalp Treatment', kind: B, durationMin: 20, priceCents: 1000, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'nose-waxing', name: 'Nose Waxing', kind: B, durationMin: 10, priceCents: 400, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'ear-waxing', name: 'Ear Waxing', kind: B, durationMin: 10, priceCents: 400, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'eyebrows-shaping', name: 'Eyebrows Shaping', kind: B, durationMin: 10, priceCents: 500, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'complete-waxing-service', name: 'Complete Waxing Service', kind: B, durationMin: 25, priceCents: 1100, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'black-mask', name: 'Black Mask', kind: B, durationMin: 15, priceCents: 600, ledgerTag: HAIR, isComboEligible: false },
  { slug: 'complete-pampering-service', name: 'Complete Pampering Service', kind: B, durationMin: 60, priceCents: 4000, ledgerTag: HAIR, isComboEligible: false },
  // ── Car wash · size-priced washes (Small / Medium / Large-SUV) ──
  { slug: 'interior-wash', name: 'Interior Wash (Small)', kind: W, durationMin: 40, priceCents: 1800, ledgerTag: WASH, isComboEligible: true },
  { slug: 'interior-wash-medium', name: 'Interior Wash (Medium)', kind: W, durationMin: 40, priceCents: 2000, ledgerTag: WASH, isComboEligible: true },
  { slug: 'interior-wash-large', name: 'Interior Wash (Large / SUV)', kind: W, durationMin: 40, priceCents: 2200, ledgerTag: WASH, isComboEligible: true },
  { slug: 'exterior-wash', name: 'Exterior Wash (Small)', kind: W, durationMin: 30, priceCents: 1400, ledgerTag: WASH, isComboEligible: true },
  { slug: 'exterior-wash-medium', name: 'Exterior Wash (Medium)', kind: W, durationMin: 30, priceCents: 1600, ledgerTag: WASH, isComboEligible: true },
  { slug: 'exterior-wash-large', name: 'Exterior Wash (Large / SUV)', kind: W, durationMin: 30, priceCents: 2000, ledgerTag: WASH, isComboEligible: true },
  { slug: 'interior-exterior-wash', name: 'Interior & Exterior Wash (Small)', kind: W, durationMin: 75, priceCents: 3000, ledgerTag: WASH, isComboEligible: true },
  { slug: 'interior-exterior-wash-medium', name: 'Interior & Exterior Wash (Medium)', kind: W, durationMin: 75, priceCents: 3500, ledgerTag: WASH, isComboEligible: true },
  { slug: 'interior-exterior-wash-large', name: 'Interior & Exterior Wash (Large / SUV)', kind: W, durationMin: 75, priceCents: 4000, ledgerTag: WASH, isComboEligible: true },
  // ── Car wash · flat-price detailing ──
  { slug: 'headlight-restoration', name: 'Headlight Restoration', kind: W, durationMin: 45, priceCents: 3000, ledgerTag: WASH, isComboEligible: false },
  { slug: 'engine-bay-cleaning', name: 'Engine Bay Cleaning', kind: W, durationMin: 45, priceCents: 2000, ledgerTag: WASH, isComboEligible: false },
  { slug: 'sio2-detailer-interior', name: 'SiO2 Detailer — Interior', kind: W, durationMin: 30, priceCents: 1500, ledgerTag: WASH, isComboEligible: false },
  { slug: 'sio2-detailer-exterior', name: 'SiO2 Detailer — Exterior', kind: W, durationMin: 30, priceCents: 1500, ledgerTag: WASH, isComboEligible: false },
  { slug: 'leather-detailer', name: 'Leather Detailer', kind: W, durationMin: 30, priceCents: 1500, ledgerTag: WASH, isComboEligible: false },
  { slug: 'leather-treatment', name: 'Leather Treatment', kind: W, durationMin: 60, priceCents: 6000, ledgerTag: WASH, isComboEligible: false },
  { slug: 'rims-wheelarches-detailing', name: 'Rims & Wheelarches Detailing', kind: W, durationMin: 90, priceCents: 12500, ledgerTag: WASH, isComboEligible: false },
  { slug: 'rims-restoration', name: 'Rims Restoration (per rim)', kind: W, durationMin: 60, priceCents: 4500, ledgerTag: WASH, isComboEligible: false },
  // ── Car wash · quoted on inspection ──
  { slug: 'pet-hair-removal', name: 'Pet Hair Removal', kind: W, durationMin: 30, priceCents: 0, ledgerTag: WASH, isComboEligible: false, isQuoteOnly: true },
  { slug: 'paint-correction', name: 'Paint Correction', kind: W, durationMin: 180, priceCents: 0, ledgerTag: WASH, isComboEligible: false, isQuoteOnly: true },
  { slug: 'ceramic-coating', name: 'Ceramic Coating', kind: W, durationMin: 240, priceCents: 0, ledgerTag: WASH, isComboEligible: false, isQuoteOnly: true },
  { slug: 'premium-valet', name: 'Premium Valeting', kind: W, durationMin: 120, priceCents: 0, ledgerTag: WASH, isComboEligible: false, isQuoteOnly: true },
];

// The car wash / detailing centre is a single site on Zabbar Road, Fgura, next
// door to the Fgura barbershop — so wash services and Combo Wash & Cut are
// Fgura-only. Barber services are offered at every branch.
const WASH_SERVICE_LOCATION_SLUGS = new Set(['fgura']);

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

// Real org structure. Branch-less entries (branchSlug: null) are global.
interface OrgSeed extends Omit<StaffSeed, 'branchSlug'> {
  branchSlug: string | null;
}

// Barbershop roster (first-name basis), per taspiru.com/barbers/team.
const BARBERS_BY_BRANCH: Record<string, readonly string[]> = {
  naxxar: ['Fabian', 'Louis', 'Jose', 'Reuben', 'Alejandro'],
  pama: ['Sam', 'Sebastian', 'Dylan', 'Stuart'],
  'san-gwann': ['Juan', 'Cayden', 'Ramirez', 'Deric'],
  fgura: ['Johnathan', 'Samuele', 'Diti', 'Santiago', 'Kieran', 'Jean'],
  'san-giljan': ['Adam', 'Marwan'],
};

const BARBER_STAFF: readonly OrgSeed[] = Object.entries(BARBERS_BY_BRANCH).flatMap(
  ([branchSlug, names]) =>
    names.map((firstName) => ({
      email: `${firstName.toLowerCase()}@taspiru.com`,
      firstName,
      lastName: '',
      role: Role.BARBER,
      branchSlug,
    })),
);

// Seniority + station (chair) number per barber. Seniority defaults to NORMAL —
// Norbert sets each barber's real band in the team dashboard; station is the
// chair order within the branch.
const BARBER_META = new Map<string, { seniority: Seniority; stationNo: number }>();
Object.values(BARBERS_BY_BRANCH).forEach((names) => {
  names.forEach((firstName, i) => {
    BARBER_META.set(`${firstName.toLowerCase()}@taspiru.com`, {
      seniority: Seniority.NORMAL,
      stationNo: i + 1,
    });
  });
});

const CORE_STAFF: readonly OrgSeed[] = [
  // Admin profiles
  { email: 'norbert@taspiru.com', firstName: 'Norbert', lastName: 'Ta Spiru', role: Role.ADMIN, branchSlug: null }, // Owner — barber & car wash
  { email: 'joane@taspiru.com', firstName: 'Joane', lastName: 'Admin', role: Role.ADMIN, branchSlug: null }, // Barber division admin
  { email: 'chris@taspiru.com', firstName: 'Chris', lastName: 'Carwash', role: Role.MANAGER, branchSlug: null }, // Car wash manager (cross-branch)

  // Receptionists — the two reception outlets (Naxxar & Fgura)
  { email: 'andrea@taspiru.com', firstName: 'Andrea', lastName: 'Reception', role: Role.RECEPTIONIST, branchSlug: 'naxxar' },
  { email: 'clarice@taspiru.com', firstName: 'Clarice', lastName: 'Reception', role: Role.RECEPTIONIST, branchSlug: 'fgura' },
  { email: 'romina@taspiru.com', firstName: 'Romina', lastName: 'Reception', role: Role.RECEPTIONIST, branchSlug: 'naxxar' },

  // Car wash crew — the wash is the single Fgura (Zabbar Road) site
  { email: 'martin@taspiru.com', firstName: 'Martin', lastName: 'Supervisor', role: Role.WASH_ATTENDANT, branchSlug: 'fgura' }, // Supervisor
  { email: 'jerry@taspiru.com', firstName: 'Jerry', lastName: 'Attendant', role: Role.WASH_ATTENDANT, branchSlug: 'fgura' },
  { email: 'kelvin@taspiru.com', firstName: 'Kelvin', lastName: 'Attendant', role: Role.WASH_ATTENDANT, branchSlug: 'fgura' },
];

const STAFF: readonly OrgSeed[] = [...CORE_STAFF, ...BARBER_STAFF];

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

  const locations = await prisma.location.findMany({ select: { id: true, slug: true } });
  for (const spec of SERVICES) {
    const data = {
      name: spec.name,
      kind: spec.kind,
      durationMin: spec.durationMin,
      priceCents: spec.priceCents,
      ledgerTag: spec.ledgerTag,
      isComboEligible: spec.isComboEligible,
      isQuoteOnly: spec.isQuoteOnly ?? false,
      isActive: true,
    };
    const service = await prisma.service.upsert({
      where: { slug: spec.slug },
      update: data,
      create: { slug: spec.slug, ...data },
    });
    // Barber services are offered everywhere; wash/detailing only at wash-capable branches.
    const targets =
      spec.kind === ServiceKind.WASH
        ? locations.filter((l) => WASH_SERVICE_LOCATION_SLUGS.has(l.slug))
        : locations;
    for (const { id: locationId } of targets) {
      await prisma.locationService.upsert({
        where: { locationId_serviceId: { locationId, serviceId: service.id } },
        update: { isActive: true },
        create: { locationId, serviceId: service.id },
      });
    }
    // Seniority price tiers for barber haircuts: junior a touch cheaper, senior +€2.
    if (spec.tiered) {
      const tiers = [
        { seniority: Seniority.JUNIOR, priceCents: Math.max(spec.priceCents - 100, 0), durationMin: spec.durationMin },
        { seniority: Seniority.NORMAL, priceCents: spec.priceCents, durationMin: spec.durationMin },
        { seniority: Seniority.SENIOR, priceCents: spec.priceCents + 200, durationMin: spec.durationMin },
      ];
      for (const t of tiers) {
        await prisma.serviceTier.upsert({
          where: { serviceId_seniority: { serviceId: service.id, seniority: t.seniority } },
          update: { priceCents: t.priceCents, durationMin: t.durationMin },
          create: { serviceId: service.id, ...t },
        });
      }
    }
  }
  // Retire any service no longer in the menu (idempotent re-seeds).
  await prisma.service.updateMany({
    where: { slug: { notIn: SERVICES.map((s) => s.slug) } },
    data: { isActive: false },
  });
  // Prune wash-service availability from non-wash-capable locations (idempotent).
  const washLocationIds = locations
    .filter((l) => WASH_SERVICE_LOCATION_SLUGS.has(l.slug))
    .map((l) => l.id);
  const washServiceIds = (
    await prisma.service.findMany({ where: { kind: ServiceKind.WASH }, select: { id: true } })
  ).map((s) => s.id);
  await prisma.locationService.deleteMany({
    where: { serviceId: { in: washServiceIds }, locationId: { notIn: washLocationIds } },
  });

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
    const locationId = spec.branchSlug ? (locationBySlug.get(spec.branchSlug) ?? null) : null;
    if (spec.branchSlug && !locationId) {
      continue;
    }
    const meta = spec.role === Role.BARBER ? BARBER_META.get(spec.email) : undefined;
    const barberFields = meta ? { seniority: meta.seniority, stationNo: meta.stationNo } : {};
    const staff = await prisma.user.upsert({
      where: { email: spec.email },
      update: { locationId, role: spec.role, ...barberFields },
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
        locationId,
        passwordHash: staffPasswordHash,
        pinHash: staffPinHash,
        ...barberFields,
      },
    });

    if ((spec.role !== Role.BARBER && spec.role !== Role.WASH_ATTENDANT) || !locationId) {
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

  // Example per-member service override (from the notes): barber Louis does the
  // boys' haircut in 15 min and can take at most 4 of them per day.
  const louis = await prisma.user.findUnique({ where: { email: 'louis@taspiru.com' }, select: { id: true } });
  const boysCut = await prisma.service.findUnique({ where: { slug: 'boy-haircut' }, select: { id: true } });
  if (louis && boysCut) {
    await prisma.teamMemberService.upsert({
      where: { userId_serviceId: { userId: louis.id, serviceId: boysCut.id } },
      update: { isEnabled: true, durationMin: 15, maxDaily: 4 },
      create: { userId: louis.id, serviceId: boysCut.id, isEnabled: true, durationMin: 15, maxDaily: 4 },
    });
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
