import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { SEED_OPPORTUNITIES, seedDatabase } from './seed-data.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

seedDatabase(prisma)
  .then(async () => {
    console.log(`Seed concluído: ${SEED_OPPORTUNITIES.length} oportunidades do case carregadas.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
