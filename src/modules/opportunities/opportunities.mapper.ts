import { toDateOnly } from '../../common/utils/dates.js';
import { evaluateAttention } from './domain/attention.js';
import { allowedTransitions, isLossReasonPending } from './domain/stage-rules.js';
import type { OpportunityResponseDto } from './dto/opportunities-response.dto.js';
import type { OpportunityRecord } from './opportunities.repository.js';

export function toOpportunityResponse(record: OpportunityRecord, today: string): OpportunityResponseDto {
  const lastContactAt = toDateOnly(record.lastContactAt);
  const proposalValidUntil = toDateOnly(record.proposalValidUntil);
  const eventDate = toDateOnly(record.eventDate);

  return {
    id: record.id,
    code: `OPP-${record.number}`,
    company: record.company,
    seller: record.seller,
    items: record.items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })),
    estimatedValue: record.estimatedValue == null ? null : record.estimatedValue.toNumber(),
    lastContactAt,
    proposalValidUntil,
    eventDate,
    stage: record.stage,
    lossReason: record.lossReason ? { code: record.lossReason.code, label: record.lossReason.label } : null,
    lossNote: record.lossNote,
    lossReasonPending: isLossReasonPending(record.stage, record.lossReasonCode),
    version: record.version,
    attention: evaluateAttention({ stage: record.stage, proposalValidUntil, lastContactAt, eventDate }, today),
    allowedTransitions: [...allowedTransitions(record.stage)],
  };
}
