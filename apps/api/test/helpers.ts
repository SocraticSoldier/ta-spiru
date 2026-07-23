import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export const bootTestApp = async (): Promise<TestContext> => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );
  await app.init();
  return { app, prisma: app.get(PrismaService) };
};

/** A future date (YYYY-MM-DD) far enough out to avoid colliding with demo/seed data. */
export const futureDate = (daysAhead: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

export const uniqueEmail = (label: string): string =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
