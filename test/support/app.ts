import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { seedDatabase } from '../../prisma/seed-data.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  env?: Record<string, string>;
  override?: (builder: TestingModuleBuilder, tokens: { PrismaService: typeof PrismaService }) => TestingModuleBuilder;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  Object.assign(process.env, options.env ?? {});

  const [{ AppModule }, { configureApp, setupSwagger }, prismaModule] = await Promise.all([
    import('../../src/app.module.js'),
    import('../../src/app.setup.js'),
    import('../../src/database/prisma.service.js'),
  ]);

  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.override) builder = options.override(builder, { PrismaService: prismaModule.PrismaService });

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  setupSwagger(app);
  await app.init();

  return {
    app,
    prisma: app.get(prismaModule.PrismaService),
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

export const resetDatabase = (prisma: PrismaService) => seedDatabase(prisma);

export async function opportunityByNumber(prisma: PrismaService, number: number) {
  return prisma.opportunity.findUniqueOrThrow({ where: { number }, include: { items: true } });
}

export async function sellerByName(prisma: PrismaService, name: string) {
  return prisma.seller.findUniqueOrThrow({ where: { name } });
}

export const codes = (body: { code: string }[]) => body.map((item) => item.code);
