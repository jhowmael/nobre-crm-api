import { Injectable } from '@nestjs/common';
import { PrismaService, type Db } from '../../database/prisma.service.js';

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
