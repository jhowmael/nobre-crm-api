import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Stage } from '../../generated/prisma/enums.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OpportunityItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lockOpportunity(opportunityId: string, tx: Prisma.TransactionClient): Promise<Stage | null> {
    const rows = await tx.$queryRaw<{ stage: Stage }[]>`SELECT "stage" FROM "opportunities" WHERE "id" = ${opportunityId}::uuid FOR UPDATE`;
    return rows[0]?.stage ?? null;
  }

  findOpportunityStage(opportunityId: string, db: Db = this.prisma) {
    return db.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true, stage: true } });
  }

  findByOpportunity(opportunityId: string, db: Db = this.prisma) {
    return db.opportunityItem.findMany({ where: { opportunityId }, orderBy: { id: 'asc' } });
  }

  findOne(opportunityId: string, id: string, db: Db = this.prisma) {
    return db.opportunityItem.findFirst({ where: { id, opportunityId } });
  }

  countByOpportunity(opportunityId: string, db: Db = this.prisma) {
    return db.opportunityItem.count({ where: { opportunityId } });
  }

  async create(opportunityId: string, data: { name: string; quantity: number }, tx: Prisma.TransactionClient) {
    const item = await tx.opportunityItem.create({ data: { ...data, opportunityId } });
    await tx.opportunity.update({ where: { id: opportunityId }, data: { version: { increment: 1 } } });
    return item;
  }

  async remove(opportunityId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.opportunityItem.delete({ where: { id } });
    await tx.opportunity.update({ where: { id: opportunityId }, data: { version: { increment: 1 } } });
  }
}
