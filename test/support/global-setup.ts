import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedDatabase } from '../../prisma/seed-data.js';

export default async function setup() {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Defina TEST_DATABASE_URL (ou DATABASE_URL) apontando para um PostgreSQL de teste. Os testes de integração apagam e recriam os dados desse banco.',
    );
  }
  if (process.env['NODE_ENV'] === 'production') throw new Error('Os testes de integração não podem rodar com NODE_ENV=production.');

  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
