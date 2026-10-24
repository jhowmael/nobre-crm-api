import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Stage } from '../../generated/prisma/enums.js';

@Injectable()
export class ContactLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lockOpportunity(opportunityId: string, tx: Prisma.TransactionClient): Promise<Stage | null> {
    const rows = await tx.$queryRaw<{ stage: Stage }[]>`SELECT "stage" FROM "opportunities" WHERE "id" = ${opportunityId}::uuid FOR UPDATE`;
    return rows[0]?.stage ?? null;
  }

  findOpportunity(opportunityId: string) {
    return this.prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true, stage: true, lastContactAt: true } });
  }

  findByOpportunity(opportunityId: string) {
    return this.prisma.contactLog.findMany({
      where: { opportunityId },
      orderBy: [{ contactedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async register(opportunityId: string, data: { contactedAt: Date; note?: string; sellerId?: string }, tx: Prisma.TransactionClient) {
    const log = await tx.contactLog.create({ data: { ...data, opportunityId } });
    const latest = await tx.contactLog.aggregate({ where: { opportunityId }, _max: { contactedAt: true } });
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: { lastContactAt: latest._max.contactedAt, version: { increment: 1 } },
    });
    return log;
  }
}
