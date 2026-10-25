import { addDays, fromDateOnly } from '../src/common/utils/dates.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { Stage } from '../src/generated/prisma/enums.js';
import { NOT_INFORMED_LOSS_REASON } from '../src/modules/opportunities/domain/stage-rules.js';

export interface SeedOpportunity {
  number: number;
  company: string;
  seller: string;
  item: { name: string; quantity: number };
  estimatedValue: number;
  lastContactAt: string;
  proposalValidUntil: string | null;
  eventDate: string;
  stage: Stage;
}

export const MIGRATION_LOSS_REASON_LABEL = 'Não informado (migração)';
export const MIGRATION_CONTACT_NOTE = 'Último contato registrado na migração.';

export const SEED_SELLERS = [
  { name: 'Ana', email: 'ana@nobrebrindes.example' },
  { name: 'Bruno', email: 'bruno@nobrebrindes.example' },
  { name: 'Carla', email: 'carla@nobrebrindes.example' },
];

export const SEED_OPPORTUNITIES: SeedOpportunity[] = [
  { number: 2001, company: 'Tech Alpha Ltda', seller: 'Ana', item: { name: 'Caneca personalizada', quantity: 300 }, estimatedValue: 4500, lastContactAt: '2026-10-14', proposalValidUntil: null, eventDate: '2026-11-30', stage: 'PRIMEIRO_CONTATO' },
  { number: 2002, company: 'Construtora Horizonte', seller: 'Bruno', item: { name: 'Kit escritório', quantity: 120 }, estimatedValue: 9800, lastContactAt: '2026-10-06', proposalValidUntil: '2026-10-13', eventDate: '2026-10-25', stage: 'APRESENTACAO_ORCAMENTO' },
  { number: 2003, company: 'Clínica Vida', seller: 'Ana', item: { name: 'Squeeze personalizado', quantity: 500 }, estimatedValue: 7200, lastContactAt: '2026-10-13', proposalValidUntil: '2026-10-20', eventDate: '2026-10-18', stage: 'FOLLOW_UP' },
  { number: 2004, company: 'Agência Pulso', seller: 'Carla', item: { name: 'Camiseta estampada', quantity: 80 }, estimatedValue: 3900, lastContactAt: '2026-10-02', proposalValidUntil: '2026-10-10', eventDate: '2026-11-05', stage: 'FOLLOW_UP' },
  { number: 2005, company: 'Banco Norte', seller: 'Bruno', item: { name: 'Agenda executiva', quantity: 1000 }, estimatedValue: 38000, lastContactAt: '2026-10-15', proposalValidUntil: '2026-10-22', eventDate: '2026-12-12', stage: 'FORECAST' },
  { number: 2006, company: 'Escola Saber', seller: 'Carla', item: { name: 'Mochila infantil', quantity: 250 }, estimatedValue: 11500, lastContactAt: '2026-10-09', proposalValidUntil: '2026-10-16', eventDate: '2026-10-17', stage: 'FECHAMENTO' },
  { number: 2007, company: 'Padaria do Bairro', seller: 'Ana', item: { name: 'Caneta promocional', quantity: 50 }, estimatedValue: 350, lastContactAt: '2026-10-01', proposalValidUntil: '2026-10-08', eventDate: '2026-10-20', stage: 'PERDIDA' },
];

const PATHS: Record<Stage, Stage[]> = {
  PRIMEIRO_CONTATO: ['PRIMEIRO_CONTATO'],
  APRESENTACAO_ORCAMENTO: ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO'],
  FOLLOW_UP: ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP'],
  FORECAST: ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST'],
  FECHAMENTO: ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FECHAMENTO'],
  PERDIDA: ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'PERDIDA'],
};

export async function seedDatabase(prisma: PrismaClient) {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('O seed de dados fictícios não pode rodar em produção.');
  }

  const catalog = await prisma.lossReason.findUnique({ where: { code: NOT_INFORMED_LOSS_REASON } });
  if (!catalog) throw new Error('Catálogo de motivos de perda ausente: aplique as migrations antes do seed.');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'TRUNCATE TABLE "followup_tasks", "contact_logs", "stage_histories", "opportunity_items", "opportunities", "sellers"',
    );

    const sellers = new Map<string, string>();
    for (const seller of SEED_SELLERS) {
      const created = await tx.seller.create({ data: seller });
      sellers.set(seller.name, created.id);
    }

    for (const row of SEED_OPPORTUNITIES) {
      const path = PATHS[row.stage];
      const sellerId = sellers.get(row.seller)!;
      const lost = row.stage === 'PERDIDA';
      const changedAt = (step: number) => new Date(`${addDays('2026-09-28', step * 2)}T10:00:00.000Z`);

      await tx.opportunity.create({
        data: {
          number: row.number,
          company: row.company,
          sellerId,
          stage: row.stage,
          estimatedValue: row.estimatedValue,
          lastContactAt: fromDateOnly(row.lastContactAt),
          proposalValidUntil: row.proposalValidUntil ? fromDateOnly(row.proposalValidUntil) : null,
          eventDate: fromDateOnly(row.eventDate),
          lossReasonCode: lost ? NOT_INFORMED_LOSS_REASON : null,
          items: { create: [row.item] },
          contactLogs: { create: [{ sellerId, contactedAt: fromDateOnly(row.lastContactAt), note: MIGRATION_CONTACT_NOTE }] },
          stageHistory: {
            create: path.map((to, step) => ({
              fromStage: step === 0 ? null : path[step - 1],
              toStage: to,
              changedAt: changedAt(step),
              note: step === 0 ? 'Oportunidade criada' : to === 'PERDIDA' ? MIGRATION_LOSS_REASON_LABEL : null,
            })),
          },
        },
      });
    }

    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('opportunities', 'number'), (SELECT MAX("number") FROM "opportunities"))`;
  }, { timeout: 60_000 });
}
