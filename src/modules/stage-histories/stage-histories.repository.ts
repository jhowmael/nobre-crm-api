import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class StageHistoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.StageHistoryUncheckedCreateInput, db: Db = this.prisma) {
    return db.stageHistory.create({ data });
  }

  async opportunityExists(opportunityId: string) {
    const found = await this.prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true } });
    return found != null;
  }

  findByOpportunity(opportunityId: string) {
    return this.prisma.stageHistory.findMany({
      where: { opportunityId },
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    });
  }
}
