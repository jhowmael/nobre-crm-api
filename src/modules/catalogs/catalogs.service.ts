import { Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import type { Stage } from '../../generated/prisma/enums.js';
import {
  ALL_STAGES,
  blockedReason,
  isFinalStage,
  STAGE_HINTS,
  STAGE_LABELS,
  STAGE_REQUIREMENTS,
  TRANSITIONS,
} from '../opportunities/domain/stage-rules.js';
import { CatalogsRepository } from './catalogs.repository.js';
import type {
  BlockedReasonsByTargetResponseDto,
  BlockedReasonsResponseDto,
  CatalogsResponseDto,
  StageCatalogItemResponseDto,
  StageTransitionsResponseDto,
} from './dto/catalogs-response.dto.js';

const byStage = <T>(build: (stage: Stage) => T) => Object.fromEntries(ALL_STAGES.map((stage) => [stage, build(stage)])) as Record<Stage, T>;

const buildStageCatalog = (): StageCatalogItemResponseDto[] =>
  ALL_STAGES.map((stage, index) => ({
    id: stage,
    label: STAGE_LABELS[stage],
    order: index + 1,
    final: isFinalStage(stage),
    hint: STAGE_HINTS[stage],
    requirement: STAGE_REQUIREMENTS[stage],
  }));

const buildTransitions = (): StageTransitionsResponseDto => byStage((stage) => [...TRANSITIONS[stage]]);

const buildBlockedReasons = (): BlockedReasonsResponseDto =>
  byStage((from) => byStage<string | null>((to) => blockedReason(from, to)) as BlockedReasonsByTargetResponseDto);

@Injectable()
export class CatalogsService {
  constructor(
    private readonly repository: CatalogsRepository,
    private readonly clock: ClockService,
  ) {}

  async get(): Promise<CatalogsResponseDto> {
    return {
      today: this.clock.today(),
      stages: buildStageCatalog(),
      transitions: buildTransitions(),
      blockedReasons: buildBlockedReasons(),
      lossReasons: await this.repository.findLossReasons(),
    };
  }
}
