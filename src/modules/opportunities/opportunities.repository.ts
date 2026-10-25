import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Stage } from '../../generated/prisma/enums.js';
import type { OpportunitySortField, SortDirection } from './dto/opportunities-request.dto.js';

export type Db = PrismaService | Prisma.TransactionClient;
export type OpportunityRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityInclude }>;

export interface OpportunityFilters {
  search?: string;
  sellerId?: string;
  stage?: Stage;
}

export interface OpportunitySorting {
  field: OpportunitySortField;
  direction: SortDirection;
}

export interface PageWindow {
  skip: number;
  take: number;
}

export const opportunityInclude = {
  seller: { select: { id: true, name: true } },
  lossReason: { select: { code: true, label: true } },
  items: { orderBy: { id: 'asc' } },
} satisfies Prisma.OpportunityInclude;

const CODE_PATTERN = /^opp-?(\d+)$/i;

const DEFAULT_SORTING: OpportunitySorting = { field: 'number', direction: 'asc' };

function buildOrderBy({ field, direction }: OpportunitySorting): Prisma.OpportunityOrderByWithRelationInput[] {
  const tieBreaker: Prisma.OpportunityOrderByWithRelationInput = { number: direction === 'desc' && field === 'number' ? 'desc' : 'asc' };
  switch (field) {
    case 'company':
      return [{ company: direction }, tieBreaker];
    case 'eventDate':
      return [{ eventDate: { sort: direction, nulls: 'last' } }, tieBreaker];
    case 'estimatedValue':
      return [{ estimatedValue: { sort: direction, nulls: 'last' } }, tieBreaker];
    default:
      return [tieBreaker];
  }
}

@Injectable()
export class OpportunitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findMany(
    filters: OpportunityFilters,
    sorting: OpportunitySorting = DEFAULT_SORTING,
    window?: PageWindow,
    db: Db = this.prisma,
  ): Promise<OpportunityRecord[]> {
    return db.opportunity.findMany({
      where: this.buildWhere(filters),
      include: opportunityInclude,
      orderBy: buildOrderBy(sorting),
      skip: window?.skip,
      take: window?.take,
    });
  }

  count(filters: OpportunityFilters, db: Db = this.prisma): Promise<number> {
    return db.opportunity.count({ where: this.buildWhere(filters) });
  }

  findById(id: string, db: Db = this.prisma): Promise<OpportunityRecord | null> {
    return db.opportunity.findUnique({ where: { id }, include: opportunityInclude });
  }

  findOpen(db: Db = this.prisma): Promise<OpportunityRecord[]> {
    return db.opportunity.findMany({
      where: { stage: { notIn: ['FECHAMENTO', 'PERDIDA'] } },
      include: opportunityInclude,
      orderBy: { number: 'asc' },
    });
  }

  async lockById(id: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "opportunities" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length > 0;
  }

  create(data: Prisma.OpportunityUncheckedCreateInput, tx: Db = this.prisma): Promise<OpportunityRecord> {
    return tx.opportunity.create({ data, include: opportunityInclude });
  }

  update(id: string, data: Prisma.OpportunityUncheckedUpdateInput, tx: Db = this.prisma): Promise<OpportunityRecord> {
    return tx.opportunity.update({ where: { id }, data, include: opportunityInclude });
  }

  async replaceItems(opportunityId: string, items: { name: string; quantity: number }[], tx: Db = this.prisma) {
    await tx.opportunityItem.deleteMany({ where: { opportunityId } });
    await tx.opportunityItem.createMany({ data: items.map((item) => ({ name: item.name.trim(), quantity: item.quantity, opportunityId })) });
  }

  private buildWhere({ search, sellerId, stage }: OpportunityFilters): Prisma.OpportunityWhereInput {
    const where: Prisma.OpportunityWhereInput = {};
    if (sellerId) where.sellerId = sellerId;
    if (stage) where.stage = stage;

    const term = search?.trim();
    if (term) {
      const code = CODE_PATTERN.exec(term);
      const number = code ? Number(code[1]) : NaN;
      where.OR = [
        { company: { contains: term, mode: 'insensitive' } },
        { seller: { name: { contains: term, mode: 'insensitive' } } },
        { items: { some: { name: { contains: term, mode: 'insensitive' } } } },
        ...(Number.isSafeInteger(number) && number <= 2_147_483_647 ? [{ number }] : []),
      ];
    }
    return where;
  }
}
