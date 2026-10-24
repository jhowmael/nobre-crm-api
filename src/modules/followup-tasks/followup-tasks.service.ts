import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { fromDateOnly, toDateOnly } from '../../common/utils/dates.js';
import type { FollowupTaskLevel } from '../../generated/prisma/enums.js';
import { evaluateAttention, type AttentionCode } from '../opportunities/domain/attention.js';
import { OpportunitiesRepository } from '../opportunities/opportunities.repository.js';
import type { ListFollowupTasksQueryDto } from './dto/followup-tasks-request.dto.js';
import type { FollowupTaskResponseDto, GenerateFollowupTasksResponseDto } from './dto/followup-tasks-response.dto.js';
import { FollowupTasksRepository, type FollowupTaskRecord, type FollowupTaskRefresh } from './followup-tasks.repository.js';

const toResponse = (task: FollowupTaskRecord): FollowupTaskResponseDto => ({
  id: task.id,
  opportunityId: task.opportunityId,
  opportunityCode: `OPP-${task.opportunity.number}`,
  company: task.opportunity.company,
  sellerId: task.sellerId,
  reasonKey: task.reasonKey as AttentionCode,
  reason: task.reason,
  level: task.level,
  dueDate: toDateOnly(task.dueDate)!,
  status: task.status,
});

interface DesiredTask {
  opportunityId: string;
  sellerId: string;
  reasonKey: string;
  reason: string;
  level: FollowupTaskLevel;
}

@Injectable()
export class FollowupTasksService {
  private readonly logger = new Logger(FollowupTasksService.name);

  constructor(
    private readonly repository: FollowupTasksRepository,
    private readonly opportunities: OpportunitiesRepository,
    private readonly clock: ClockService,
  ) {}

  async list(query: ListFollowupTasksQueryDto): Promise<FollowupTaskResponseDto[]> {
    const rows = await this.repository.findMany({
      sellerId: query.sellerId,
      status: query.status ?? 'OPEN',
      dueUntil: fromDateOnly(query.dueUntil ?? this.clock.today()),
    });
    return rows.map(toResponse);
  }

  async complete(id: string): Promise<FollowupTaskResponseDto> {
    const task = await this.repository.findById(id);
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    const done = task.status === 'OPEN' ? await this.repository.markDone(id, this.clock.now()) : null;
    if (!done) throw new UnprocessableEntityException('A tarefa já foi encerrada.');
    return toResponse(done);
  }

  async generate(): Promise<GenerateFollowupTasksResponseDto> {
    const today = this.clock.today();
    const opportunities = await this.opportunities.findOpen();

    const desired = new Map<string, DesiredTask>();
    for (const record of opportunities) {
      const attention = evaluateAttention(
        {
          stage: record.stage,
          proposalValidUntil: toDateOnly(record.proposalValidUntil),
          lastContactAt: toDateOnly(record.lastContactAt),
          eventDate: toDateOnly(record.eventDate),
        },
        today,
      );
      for (const signal of attention.signals) {
        desired.set(`${record.id}:${signal.code}`, {
          opportunityId: record.id,
          sellerId: record.sellerId,
          reasonKey: signal.code,
          reason: signal.message,
          level: signal.level,
        });
      }
    }

    const open = await this.repository.findOpenKeys();
    const openByKey = new Map(open.map((task) => [`${task.opportunityId}:${task.reasonKey}`, task]));

    const dueDate = fromDateOnly(today);
    const doneToday = new Set((await this.repository.findDoneOn(dueDate)).map((task) => `${task.opportunityId}:${task.reasonKey}`));

    const created = await this.repository.createMany(
      [...desired.entries()]
        .filter(([key]) => !openByKey.has(key) && !doneToday.has(key))
        .map(([, task]) => ({ ...task, dueDate })),
    );

    const refreshes: FollowupTaskRefresh[] = [];
    for (const [key, task] of openByKey) {
      const wanted = desired.get(key);
      if (wanted && (wanted.level !== task.level || wanted.reason !== task.reason)) {
        refreshes.push({ id: task.id, level: wanted.level, reason: wanted.reason });
      }
    }
    await this.repository.refresh(refreshes);

    const dismissed = await this.repository.dismiss(
      open.filter((task) => !desired.has(`${task.opportunityId}:${task.reasonKey}`)).map((task) => task.id),
      this.clock.now(),
    );

    this.logger.log(`Tarefas de retorno geradas para ${today}: ${created} novas, ${dismissed} dispensadas, ${refreshes.length} atualizadas.`);
    return { created, dismissed };
  }
}
