import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { fromDateOnly } from '../../common/utils/dates.js';
import { Stage } from '../../generated/prisma/enums.js';
import { CatalogsRepository } from '../catalogs/catalogs.repository.js';
import { StageHistoriesRepository } from '../stage-histories/stage-histories.repository.js';
import {
  isFinalStage,
  isLossReasonPending,
  validateLossReason,
  validateMove,
  validateProposalValidity,
  type RuleViolation,
} from './domain/stage-rules.js';
import {
  DEFAULT_PAGE_SIZE,
  type CreateOpportunityRequestDto,
  type ListOpportunitiesQueryDto,
  type MoveStageRequestDto,
  type UpdateOpportunityRequestDto,
} from './dto/opportunities-request.dto.js';
import type { OpportunityResponseDto } from './dto/opportunities-response.dto.js';
import { toOpportunityResponse } from './opportunities.mapper.js';
import { OpportunitiesRepository, type OpportunityFilters, type OpportunitySorting, type PageWindow } from './opportunities.repository.js';

const STALE_MESSAGE = 'A oportunidade foi alterada por outra pessoa. Atualize e tente novamente.';

const unprocessable = (errors: RuleViolation[]) => new UnprocessableEntityException({ message: errors[0].message, errors });

const cleanText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export interface OpportunityPage {
  items: OpportunityResponseDto[];
  total: number;
  paginated: boolean;
}

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly repository: OpportunitiesRepository,
    private readonly histories: StageHistoriesRepository,
    private readonly catalogs: CatalogsRepository,
    private readonly clock: ClockService,
  ) {}

  async list(query: ListOpportunitiesQueryDto): Promise<OpportunityPage> {
    const today = this.clock.today();
    const filters: OpportunityFilters = { search: query.search, sellerId: query.sellerId, stage: query.stage };
    const sorting: OpportunitySorting = { field: query.sort ?? 'number', direction: query.order ?? 'asc' };
    const paginated = query.page !== undefined || query.pageSize !== undefined;
    const window: PageWindow | undefined = paginated
      ? { skip: ((query.page ?? 1) - 1) * (query.pageSize ?? DEFAULT_PAGE_SIZE), take: query.pageSize ?? DEFAULT_PAGE_SIZE }
      : undefined;

    if (query.onlyAttention) {
      const rows = await this.repository.findMany(filters, sorting);
      const flagged = rows.map((row) => toOpportunityResponse(row, today)).filter((opp) => opp.attention.level !== 'none');
      const items = window ? flagged.slice(window.skip, window.skip + window.take) : flagged;
      return { items, total: flagged.length, paginated };
    }

    const [rows, total] = await Promise.all([
      this.repository.findMany(filters, sorting, window),
      window ? this.repository.count(filters) : Promise.resolve(undefined),
    ]);
    const items = rows.map((row) => toOpportunityResponse(row, today));
    return { items, total: total ?? items.length, paginated };
  }

  async findOne(id: string): Promise<OpportunityResponseDto> {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundException('Oportunidade não encontrada.');
    return toOpportunityResponse(record, this.clock.today());
  }

  async create(dto: CreateOpportunityRequestDto): Promise<OpportunityResponseDto> {
    const today = this.clock.today();
    const created = await this.repository.transaction(async (tx) => {
      const record = await this.repository.create(
        {
          company: dto.company.trim(),
          sellerId: dto.sellerId,
          estimatedValue: dto.estimatedValue,
          eventDate: dto.eventDate ? fromDateOnly(dto.eventDate) : null,
          lastContactAt: fromDateOnly(today),
          items: dto.items?.length ? { create: dto.items.map((item) => ({ name: item.name.trim(), quantity: item.quantity })) } : undefined,
        },
        tx,
      );
      await this.histories.create(
        { opportunityId: record.id, fromStage: null, toStage: Stage.PRIMEIRO_CONTATO, note: 'Oportunidade criada', changedAt: this.clock.now() },
        tx,
      );
      return record;
    });
    return toOpportunityResponse(created, today);
  }

  async update(id: string, dto: UpdateOpportunityRequestDto): Promise<OpportunityResponseDto> {
    const today = this.clock.today();
    const updated = await this.repository.transaction(async (tx) => {
      if (!(await this.repository.lockById(id, tx))) throw new NotFoundException('Oportunidade não encontrada.');
      const current = await this.repository.findById(id, tx);
      if (!current) throw new NotFoundException('Oportunidade não encontrada.');
      if (current.version !== dto.expectedVersion) throw new ConflictException(STALE_MESSAGE);

      const touchesLoss = dto.lossReasonCode !== undefined || dto.lossNote !== undefined;
      const touchesDeal = dto.estimatedValue !== undefined || dto.proposalValidUntil !== undefined || dto.eventDate !== undefined;
      const violations: RuleViolation[] = [];

      if (isFinalStage(current.stage)) {
        if (touchesDeal || !touchesLoss || current.stage !== Stage.PERDIDA) {
          violations.push({ field: 'stage', message: 'Oportunidade em etapa final só permite completar o motivo da perda pendente.' });
        } else if (!isLossReasonPending(current.stage, current.lossReasonCode)) {
          violations.push({ field: 'lossReasonCode', message: 'O motivo da perda já foi registrado e não pode ser alterado.' });
        } else {
          violations.push(...validateLossReason(dto.lossReasonCode, await this.catalogs.findLossReasons(tx)));
        }
      } else if (touchesLoss) {
        violations.push({ field: 'lossReasonCode', message: 'O motivo da perda só pode ser registrado em oportunidades Perdidas.' });
      } else if (!touchesDeal) {
        violations.push({ field: 'body', message: 'Informe ao menos um campo para atualizar.' });
      }

      if (dto.proposalValidUntil !== undefined && current.stage === Stage.PRIMEIRO_CONTATO) {
        violations.push({
          field: 'proposalValidUntil',
          message: 'A validade da proposta só pode ser informada a partir de Apresentação de Orçamento.',
        });
      }
      violations.push(...validateProposalValidity(dto.proposalValidUntil, today));
      if (violations.length > 0) throw unprocessable(violations);

      return this.repository.update(
        id,
        {
          estimatedValue: dto.estimatedValue,
          proposalValidUntil: dto.proposalValidUntil ? fromDateOnly(dto.proposalValidUntil) : undefined,
          eventDate: dto.eventDate ? fromDateOnly(dto.eventDate) : undefined,
          lossReasonCode: dto.lossReasonCode?.trim(),
          lossNote: touchesLoss ? cleanText(dto.lossNote) : undefined,
          version: { increment: 1 },
        },
        tx,
      );
    });
    return toOpportunityResponse(updated, today);
  }

  async moveStage(id: string, dto: MoveStageRequestDto): Promise<OpportunityResponseDto> {
    const today = this.clock.today();
    const moved = await this.repository.transaction(async (tx) => {
      if (!(await this.repository.lockById(id, tx))) throw new NotFoundException('Oportunidade não encontrada.');
      const current = await this.repository.findById(id, tx);
      if (!current) throw new NotFoundException('Oportunidade não encontrada.');
      if (current.version !== dto.expectedVersion) throw new ConflictException(STALE_MESSAGE);

      const lossReasons = dto.to === Stage.PERDIDA ? await this.catalogs.findLossReasons(tx) : [];
      const violations = validateMove(
        {
          stage: current.stage,
          estimatedValue: current.estimatedValue == null ? null : current.estimatedValue.toNumber(),
          itemCount: current.items.length,
        },
        {
          to: dto.to,
          lossReasonCode: dto.lossReasonCode,
          lossNote: dto.lossNote,
          estimatedValue: dto.estimatedValue,
          itemCount: dto.items?.length,
        },
        lossReasons,
      );
      if (violations.length === 0) violations.push(...validateProposalValidity(dto.proposalValidUntil, today));
      if (violations.length > 0) throw unprocessable(violations);

      if (dto.items) await this.repository.replaceItems(id, dto.items, tx);

      const losing = dto.to === Stage.PERDIDA;
      const lossReasonCode = losing ? dto.lossReasonCode!.trim() : undefined;
      const lossNote = losing ? cleanText(dto.lossNote) : undefined;
      const record = await this.repository.update(
        id,
        {
          stage: dto.to,
          version: { increment: 1 },
          estimatedValue: dto.estimatedValue,
          proposalValidUntil: dto.proposalValidUntil ? fromDateOnly(dto.proposalValidUntil) : undefined,
          lossReasonCode,
          lossNote,
        },
        tx,
      );

      const label = lossReasons.find((reason) => reason.code === lossReasonCode)?.label;
      await this.histories.create(
        {
          opportunityId: id,
          fromStage: current.stage,
          toStage: dto.to,
          note: losing ? [label, lossNote].filter(Boolean).join(': ') : null,
          changedAt: this.clock.now(),
        },
        tx,
      );
      return record;
    });
    return toOpportunityResponse(moved, today);
  }
}
