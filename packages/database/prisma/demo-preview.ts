/** Preview-only demo data: today's appointments, live queue, settled ledger. Not for production. */
import {
  AppointmentStatus,
  LedgerTag,
  LoyaltyEntryKind,
  LoyaltyTier,
  OrderChannel,
  OrderStatus,
  PaymentChannel,
  PrismaClient,
  QueueStatus,
  Role,
  ServiceKind,
  TransactionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const at = (hour: number, minute = 0): Date => {
  const now = new Date();
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const addMin = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60_000);

const main = async (): Promise<void> => {
  const naxxar = await prisma.location.findUniqueOrThrow({ where: { slug: 'naxxar' } });
  const [luca, matteo, owen, elena, customer] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'fabian@taspiru.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'louis@taspiru.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'jerry@taspiru.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'andrea@taspiru.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'customer@taspiru.com' } }),
  ]);
  const [skinFade, haircutBeard, exteriorWash, premiumValet] = await Promise.all([
    prisma.service.findUniqueOrThrow({ where: { slug: 'skin-fade' } }),
    prisma.service.findUniqueOrThrow({ where: { slug: 'haircut-beard-sculpt' } }),
    prisma.service.findUniqueOrThrow({ where: { slug: 'exterior-wash' } }),
    prisma.service.findUniqueOrThrow({ where: { slug: 'premium-valet' } }),
  ]);
  const bays = await prisma.resource.findMany({
    where: { locationId: naxxar.id, kind: 'WASH_BAY' },
    orderBy: { name: 'asc' },
  });
  const bay1 = bays[0];
  const bay2 = bays[1];
  if (!bay1 || !bay2) {
    throw new Error('Expected two wash bays at Naxxar');
  }

  // Clear any previous demo state for idempotency
  await prisma.queueEntry.deleteMany({ where: { locationId: naxxar.id } });
  await prisma.timeEntry.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.transactionSplit.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.order.deleteMany({});

  // Staff on shift right now
  await prisma.timeEntry.createMany({
    data: [
      { userId: luca.id, locationId: naxxar.id, clockInAt: at(8, 55) },
      { userId: matteo.id, locationId: naxxar.id, clockInAt: at(9, 2) },
      { userId: owen.id, locationId: naxxar.id, clockInAt: at(9, 0) },
      { userId: elena.id, locationId: naxxar.id, clockInAt: at(8, 45) },
    ],
  });

  // Extra named customers for realistic listings
  const names: [string, string][] = [
    ['James', 'Cassar'],
    ['Daniel', 'Spiteri'],
    ['Nick', 'Galea'],
  ];
  const extraCustomers = [];
  for (const [firstName, lastName] of names) {
    extraCustomers.push(
      await prisma.user.upsert({
        where: { email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.mt` },
        update: {},
        create: {
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.mt`,
          firstName,
          lastName,
          role: Role.CUSTOMER,
        },
      }),
    );
  }
  const [james, daniel, nick] = extraCustomers as [
    (typeof extraCustomers)[0],
    (typeof extraCustomers)[0],
    (typeof extraCustomers)[0],
  ];

  // Today's appointments — including a Combo Wash & Cut pair
  const comboStart = at(15, 0);
  const comboGroupId = 'demo-combo-group';
  await prisma.appointment.createMany({
    data: [
      {
        locationId: naxxar.id,
        customerId: customer.id,
        serviceId: skinFade.id,
        barberId: luca.id,
        startsAt: comboStart,
        endsAt: addMin(comboStart, skinFade.durationMin),
        lockedUntil: addMin(comboStart, skinFade.durationMin),
        status: AppointmentStatus.CONFIRMED,
        comboGroupId,
      },
      {
        locationId: naxxar.id,
        customerId: customer.id,
        serviceId: exteriorWash.id,
        resourceId: bay1.id,
        startsAt: comboStart,
        endsAt: addMin(comboStart, exteriorWash.durationMin),
        lockedUntil: addMin(comboStart, skinFade.durationMin + 30),
        status: AppointmentStatus.CONFIRMED,
        comboGroupId,
        vehicleReg: 'ABC 123',
      },
      {
        locationId: naxxar.id,
        customerId: james.id,
        serviceId: haircutBeard.id,
        barberId: matteo.id,
        startsAt: at(16, 0),
        endsAt: at(17, 0),
        lockedUntil: at(17, 0),
        status: AppointmentStatus.CONFIRMED,
      },
      {
        locationId: naxxar.id,
        customerId: daniel.id,
        serviceId: premiumValet.id,
        resourceId: bay2.id,
        startsAt: at(14, 0),
        endsAt: at(16, 0),
        lockedUntil: at(16, 0),
        status: AppointmentStatus.IN_PROGRESS,
        vehicleReg: 'GVX 402',
      },
      {
        locationId: naxxar.id,
        customerId: nick.id,
        serviceId: skinFade.id,
        barberId: luca.id,
        startsAt: at(10, 15),
        endsAt: at(11, 0),
        lockedUntil: at(11, 0),
        status: AppointmentStatus.COMPLETED,
      },
    ],
  });

  // Live queue at Naxxar
  await prisma.queueEntry.createMany({
    data: [
      { locationId: naxxar.id, displayName: 'Chris B.', serviceId: skinFade.id, serviceKind: ServiceKind.BARBER, status: QueueStatus.CALLED, joinedAt: at(13, 40), calledAt: at(14, 5) },
      { locationId: naxxar.id, displayName: 'Sam F.', serviceId: haircutBeard.id, serviceKind: ServiceKind.BARBER, status: QueueStatus.WAITING, joinedAt: at(13, 55) },
      { locationId: naxxar.id, displayName: 'Andre M.', serviceId: skinFade.id, serviceKind: ServiceKind.BARBER, status: QueueStatus.WAITING, joinedAt: at(14, 10) },
      { locationId: naxxar.id, displayName: 'Julia P.', serviceId: exteriorWash.id, serviceKind: ServiceKind.WASH, status: QueueStatus.IN_SERVICE, joinedAt: at(13, 30), startedAt: at(13, 50), vehicleReg: 'QRT 918' },
      { locationId: naxxar.id, displayName: 'Matt V.', serviceId: exteriorWash.id, serviceKind: ServiceKind.WASH, status: QueueStatus.WAITING, joinedAt: at(14, 15), vehicleReg: 'KLM 664' },
    ],
  });

  // Settled Trust Payments ledger with revenue splits
  const mkTransaction = async (
    amountCents: number,
    splits: { tag: LedgerTag; amountCents: number }[],
    status: TransactionStatus,
    channel: PaymentChannel,
    customerId: string | null,
    reference: string,
    hoursAgo: number,
  ): Promise<void> => {
    await prisma.transaction.create({
      data: {
        amountCents,
        channel,
        status,
        siteReference: 'test_taspiru12345',
        customerId,
        transactionReference: status === TransactionStatus.PENDING ? null : reference,
        settledAt: status === TransactionStatus.SETTLED ? addMin(new Date(), -hoursAgo * 60) : null,
        createdAt: addMin(new Date(), -hoursAgo * 60 - 5),
        splits: {
          create: splits.map((split) => ({ ledgerTag: split.tag, amountCents: split.amountCents, locationId: naxxar.id })),
        },
      },
    });
  };

  await mkTransaction(4000, [{ tag: LedgerTag.BARBER_SERVICES, amountCents: 2500 }, { tag: LedgerTag.CAR_DETAILING, amountCents: 1500 }], TransactionStatus.SETTLED, PaymentChannel.ONLINE, customer.id, '57-9-1001', 2);
  await mkTransaction(9500, [{ tag: LedgerTag.CAR_DETAILING, amountCents: 9500 }], TransactionStatus.SETTLED, PaymentChannel.POS_TERMINAL, daniel.id, '57-9-1002', 4);
  await mkTransaction(2900, [{ tag: LedgerTag.RETAIL_BARBER, amountCents: 2900 }], TransactionStatus.SETTLED, PaymentChannel.POS_TERMINAL, james.id, '57-9-1003', 6);
  await mkTransaction(4100, [{ tag: LedgerTag.RETAIL_CAR_CARE, amountCents: 4100 }], TransactionStatus.SETTLED, PaymentChannel.ONLINE, nick.id, '57-9-1004', 26);
  await mkTransaction(3500, [{ tag: LedgerTag.BARBER_SERVICES, amountCents: 3500 }], TransactionStatus.PENDING, PaymentChannel.ONLINE, james.id, '57-9-1005', 0);
  await mkTransaction(1500, [{ tag: LedgerTag.CAR_DETAILING, amountCents: 1500 }], TransactionStatus.DECLINED, PaymentChannel.ONLINE, nick.id, '57-9-1006', 1);

  // Loyalty balance for the test customer
  const account = await prisma.loyaltyAccount.upsert({
    where: { userId: customer.id },
    update: { balancePoints: 610, lifetimePoints: 610, tier: LoyaltyTier.SILVER },
    create: { userId: customer.id, balancePoints: 610, lifetimePoints: 610, tier: LoyaltyTier.SILVER },
  });
  await prisma.loyaltyLedgerEntry.deleteMany({ where: { accountId: account.id } });
  await prisma.loyaltyLedgerEntry.create({
    data: { accountId: account.id, kind: LoyaltyEntryKind.EARN, deltaPoints: 40, reference: 'demo' },
  });

  // A paid POS retail order + a low-stock situation for the inventory page
  const pomade = await prisma.product.findUniqueOrThrow({ where: { sku: 'TS-WAX-MATT' } });
  await prisma.order.create({
    data: {
      locationId: naxxar.id,
      customerId: james.id,
      channel: OrderChannel.POS,
      status: OrderStatus.PAID,
      totalCents: 2900,
      items: {
        create: [
          { productId: pomade.id, quantity: 2, unitPriceCents: 1450, ledgerTag: LedgerTag.RETAIL_BARBER },
        ],
      },
    },
  });
  await prisma.stockLevel.update({
    where: { productId_locationId: { productId: pomade.id, locationId: naxxar.id } },
    data: { quantity: 4 },
  });

  console.log('Demo preview data ready');
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
