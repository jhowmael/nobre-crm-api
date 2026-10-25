import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { FollowupTaskLevel, FollowupTaskStatus } from '../../generated/prisma/enums.js';

export type FollowupTaskRecord = Prisma.FollowupTaskGetPayload<{ include: typeof taskInclude }>;

export interface FollowupTaskRefresh {
  id: string;
  level: FollowupTaskLevel;
  reason: string;
}

const taskInclude = { opportunity: { select: { number: true, company: true } } } satisfies Prisma.FollowupTaskInclude;

@Injectable()
export class FollowupTasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpenKeys() {
    return this.prisma.followupTask.findMany({
      where: { status: 'OPEN' },
      select: { id: true, opportunityId: true, reasonKey: true, level: true, reason: true },
    });
  }

  findDoneOn(dueDate: Date) {
    return this.prisma.followupTask.findMany({
      where: { status: 'DONE', dueDate },
      select: { opportunityId: true, reasonKey: true },
    });
  }

  async createMany(data: Prisma.FollowupTaskCreateManyInput[]) {
    if (data.length === 0) return 0;
    const result = await this.prisma.followupTask.createMany({ data, skipDuplicates: true });
    return result.count;
  }

  async refresh(updates: FollowupTaskRefresh[]) {
    if (updates.length === 0) return 0;
    await this.prisma.$transaction(
      updates.map(({ id, level, reason }) => this.prisma.followupTask.updateMany({ where: { id, status: 'OPEN' }, data: { level, reason } })),
    );
    return updates.length;
  }

  async dismiss(ids: string[], resolvedAt: Date) {
    if (ids.length === 0) return 0;
    const result = await this.prisma.followupTask.updateMany({
      where: { id: { in: ids }, status: 'OPEN' },
      data: { status: 'DISMISSED', resolvedAt },
    });
    return result.count;
  }

  findMany(filters: { sellerId?: string; status: FollowupTaskStatus; dueUntil: Date }): Promise<FollowupTaskRecord[]> {
    return this.prisma.followupTask.findMany({
      where: { sellerId: filters.sellerId, status: filters.status, dueDate: { lte: filters.dueUntil } },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { level: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async markDone(id: string, resolvedAt: Date): Promise<FollowupTaskRecord | null> {
    const result = await this.prisma.followupTask.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'DONE', resolvedAt } });
    if (result.count === 0) return null;
    return this.prisma.followupTask.findUnique({ where: { id }, include: taskInclude });
  }

  findById(id: string) {
    return this.prisma.followupTask.findUnique({ where: { id }, select: { id: true, status: true } });
  }
}
