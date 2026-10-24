import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClockService } from '../../common/clock/clock.service.js';
import { daysBetween, fromDateOnly, toDateOnly } from '../../common/utils/dates.js';
import { isFinalStage } from '../opportunities/domain/stage-rules.js';
import { ContactLogsRepository } from './contact-logs.repository.js';
import type { CreateContactLogRequestDto } from './dto/contact-logs-request.dto.js';
import type { ContactLogResponseDto } from './dto/contact-logs-response.dto.js';

@Injectable()
export class ContactLogsService {
  constructor(
    private readonly repository: ContactLogsRepository,
    private readonly clock: ClockService,
  ) {}

  async list(opportunityId: string): Promise<ContactLogResponseDto[]> {
    if (!(await this.repository.findOpportunity(opportunityId))) throw new NotFoundException('Oportunidade não encontrada.');
    const rows = await this.repository.findByOpportunity(opportunityId);
    return rows.map((row) => ({ id: row.id, contactedAt: toDateOnly(row.contactedAt)!, note: row.note }));
  }

  async register(opportunityId: string, dto: CreateContactLogRequestDto): Promise<ContactLogResponseDto> {
    const today = this.clock.today();
    const contactedAt = dto.contactedAt ?? today;

    const log = await this.repository.transaction(async (tx) => {
      const stage = await this.repository.lockOpportunity(opportunityId, tx);
      if (!stage) throw new NotFoundException('Oportunidade não encontrada.');
      if (isFinalStage(stage)) {
        throw new UnprocessableEntityException('Não é possível registrar contato em oportunidade de etapa final.');
      }
      if (daysBetween(today, contactedAt) > 0) {
        throw new UnprocessableEntityException('A data do contato não pode estar no futuro.');
      }
      return this.repository.register(
        opportunityId,
        { contactedAt: fromDateOnly(contactedAt), note: dto.note?.trim() || undefined, sellerId: dto.sellerId },
        tx,
      );
    });
    return { id: log.id, contactedAt: toDateOnly(log.contactedAt)!, note: log.note };
  }
}
