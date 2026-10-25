import { Stage } from '../../../generated/prisma/enums.js';
import { daysBetween, plural } from '../../../common/utils/dates.js';
import { hasProposal, isFinalStage, STAGE_LABELS } from './stage-rules.js';

export type AttentionLevel = (typeof ATTENTION_LEVELS)[number];

export type AttentionCode = (typeof ATTENTION_CODES)[number];

export interface AttentionSignal {
  code: AttentionCode;
  level: (typeof ATTENTION_SIGNAL_LEVELS)[number];
  message: string;
}

export interface Attention {
  level: AttentionLevel;
  signals: AttentionSignal[];
}

export interface AttentionSubject {
  stage: Stage;
  proposalValidUntil: string | null;
  lastContactAt: string | null;
  eventDate: string | null;
}

export const ATTENTION_LEVELS = ['none', 'medium', 'high'] as const;

export const ATTENTION_SIGNAL_LEVELS = ['high', 'medium'] as const;

export const ATTENTION_CODES = [
  'PROPOSAL_EXPIRED',
  'PROPOSAL_EXPIRES_TODAY',
  'PROPOSAL_EXPIRING',
  'PROPOSAL_MISSING',
  'PROPOSAL_AFTER_EVENT',
  'NO_CONTACT_REGISTERED',
  'NO_CONTACT',
  'EVENT_NEAR',
  'EVENT_PAST',
] as const;

const NO_CONTACT_MEDIUM_DAYS = 5;
const NO_CONTACT_HIGH_DAYS = 7;
const PROPOSAL_EXPIRING_DAYS = 3;
const EVENT_NEAR_DAYS = 7;
const FORECAST_EVENT_DAYS = 3;

const RANK: Record<AttentionLevel, number> = { none: 0, medium: 1, high: 2 };

const when = (days: number) => (days === 0 ? 'hoje' : `em ${plural(days, 'dia', 'dias')}`);

export function evaluateAttention(subject: AttentionSubject, today: string): Attention {
  if (isFinalStage(subject.stage)) return { level: 'none', signals: [] };

  const signals: AttentionSignal[] = [];
  const add = (code: AttentionCode, level: AttentionSignal['level'], message: string) => signals.push({ code, level, message });

  if (subject.proposalValidUntil) {
    const left = daysBetween(today, subject.proposalValidUntil);
    if (left < 0) add('PROPOSAL_EXPIRED', 'high', `Proposta vencida há ${plural(-left, 'dia', 'dias')}`);
    else if (left === 0) add('PROPOSAL_EXPIRES_TODAY', 'medium', 'Proposta vence hoje');
    else if (left <= PROPOSAL_EXPIRING_DAYS) add('PROPOSAL_EXPIRING', 'medium', `Proposta vence em ${plural(left, 'dia', 'dias')}`);
  } else if (hasProposal(subject.stage)) {
    add('PROPOSAL_MISSING', 'medium', 'Proposta sem validade informada');
  }

  if (subject.lastContactAt == null) {
    add('NO_CONTACT_REGISTERED', 'medium', 'Nenhum contato registrado');
  } else {
    const silent = -daysBetween(today, subject.lastContactAt);
    if (silent >= NO_CONTACT_MEDIUM_DAYS) {
      add('NO_CONTACT', silent >= NO_CONTACT_HIGH_DAYS ? 'high' : 'medium', `Sem contato há ${plural(silent, 'dia', 'dias')}`);
    }
  }

  if (subject.eventDate) {
    const left = daysBetween(today, subject.eventDate);
    const limit = subject.stage === Stage.FORECAST ? FORECAST_EVENT_DAYS : EVENT_NEAR_DAYS;
    if (left < 0) add('EVENT_PAST', 'high', 'A data do evento já passou');
    else if (left <= limit) add('EVENT_NEAR', 'high', `Evento ${when(left)} e ainda em ${STAGE_LABELS[subject.stage]}`);

    if (left >= 0 && subject.proposalValidUntil && subject.proposalValidUntil > subject.eventDate) {
      add('PROPOSAL_AFTER_EVENT', 'medium', 'Validade da proposta posterior ao evento');
    }
  }

  const level = signals.reduce<AttentionLevel>((acc, signal) => (RANK[signal.level] > RANK[acc] ? signal.level : acc), 'none');
  return { level, signals };
}
