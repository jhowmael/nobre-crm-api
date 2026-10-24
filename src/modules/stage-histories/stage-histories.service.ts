import { Injectable, NotFoundException } from '@nestjs/common';
import type { StageHistoryResponseDto } from './dto/stage-histories-response.dto.js';
import { StageHistoriesRepository } from './stage-histories.repository.js';

@Injectable()
export class StageHistoriesService {
  constructor(private readonly repository: StageHistoriesRepository) {}

  async listByOpportunity(opportunityId: string): Promise<StageHistoryResponseDto[]> {
    if (!(await this.repository.opportunityExists(opportunityId))) throw new NotFoundException('Oportunidade não encontrada.');
    const rows = await this.repository.findByOpportunity(opportunityId);
    return rows.map((row) => ({
      id: row.id,
      from: row.fromStage,
      to: row.toStage,
      note: row.note,
      at: row.changedAt.toISOString(),
    }));
  }
}
