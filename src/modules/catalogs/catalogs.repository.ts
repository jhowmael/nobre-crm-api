import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CatalogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLossReasons(db: Db = this.prisma) {
    return db.lossReason.findMany({
      select: { code: true, label: true, active: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }
}
