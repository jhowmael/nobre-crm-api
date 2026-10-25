import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Stage } from '../../generated/prisma/enums.js';
import { hasProposal, isFinalStage } from '../opportunities/domain/stage-rules.js';
import type { CreateOpportunityItemRequestDto } from './dto/opportunity-items-request.dto.js';
import type { OpportunityItemResponseDto } from './dto/opportunity-items-response.dto.js';
import { OpportunityItemsRepository } from './opportunity-items.repository.js';

const FINAL_STAGE_MESSAGE = 'Itens não podem ser alterados em oportunidades em etapa final.';

@Injectable()
export class OpportunityItemsService {
  constructor(private readonly repository: OpportunityItemsRepository) {}

  async list(opportunityId: string): Promise<OpportunityItemResponseDto[]> {
    if (!(await this.repository.findOpportunityStage(opportunityId))) throw new NotFoundException('Oportunidade não encontrada.');
    const rows = await this.repository.findByOpportunity(opportunityId);
    return rows.map(({ id, name, quantity }) => ({ id, name, quantity }));
  }

  add(opportunityId: string, dto: CreateOpportunityItemRequestDto): Promise<OpportunityItemResponseDto> {
    return this.repository.transaction(async (tx) => {
      await this.lockEditable(opportunityId, tx);
      const { id, name, quantity } = await this.repository.create(opportunityId, { name: dto.name.trim(), quantity: dto.quantity }, tx);
      return { id, name, quantity };
    });
  }

  async remove(opportunityId: string, id: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      const stage = await this.lockEditable(opportunityId, tx);
      if (!(await this.repository.findOne(opportunityId, id, tx))) throw new NotFoundException('Item não encontrado.');
      if (hasProposal(stage) && (await this.repository.countByOpportunity(opportunityId, tx)) <= 1) {
        throw new UnprocessableEntityException('A oportunidade precisa ter ao menos um item de brinde nesta etapa.');
      }
      await this.repository.remove(opportunityId, id, tx);
    });
  }

  private async lockEditable(opportunityId: string, tx: Prisma.TransactionClient): Promise<Stage> {
    const stage = await this.repository.lockOpportunity(opportunityId, tx);
    if (!stage) throw new NotFoundException('Oportunidade não encontrada.');
    if (isFinalStage(stage)) throw new UnprocessableEntityException(FINAL_STAGE_MESSAGE);
    return stage;
  }
}
