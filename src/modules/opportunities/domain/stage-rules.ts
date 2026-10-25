import { Stage } from '../../../generated/prisma/enums.js';

export interface RuleViolation {
  field: string;
  message: string;
}

export interface LossReasonOption {
  code: string;
  label: string;
  active: boolean;
}

export interface MoveSubject {
  stage: Stage;
  estimatedValue: number | null;
  itemCount: number;
}

export interface MoveInput {
  to: Stage;
  lossReasonCode?: string;
  lossNote?: string;
  estimatedValue?: number;
  itemCount?: number;
}

export const STAGE_ORDER: Stage[] = [
  Stage.PRIMEIRO_CONTATO,
  Stage.APRESENTACAO_ORCAMENTO,
  Stage.FOLLOW_UP,
  Stage.FORECAST,
  Stage.FECHAMENTO,
];

export const ALL_STAGES: Stage[] = [...STAGE_ORDER, Stage.PERDIDA];

export const STAGE_LABELS: Record<Stage, string> = {
  PRIMEIRO_CONTATO: 'Primeiro Contato',
  APRESENTACAO_ORCAMENTO: 'Apresentação de Orçamento',
  FOLLOW_UP: 'Follow-up',
  FORECAST: 'Forecast',
  FECHAMENTO: 'Fechamento',
  PERDIDA: 'Perdida',
};

export const STAGE_HINTS: Record<Stage, string> = {
  PRIMEIRO_CONTATO: 'Lead recém-chegado. Falta qualificar e entender o que o cliente precisa.',
  APRESENTACAO_ORCAMENTO: 'Orçamento montado e enviado ao cliente. Exige valor estimado e ao menos um brinde.',
  FOLLOW_UP: 'Aguardando resposta ou negociando ajustes da proposta.',
  FORECAST: 'Negociação avançada, com grande chance de fechar.',
  FECHAMENTO: 'Venda fechada. Etapa final.',
  PERDIDA: 'Negociação perdida, com motivo registrado. Etapa final.',
};

export const STAGE_REQUIREMENTS: Record<Stage, string | null> = {
  PRIMEIRO_CONTATO: null,
  APRESENTACAO_ORCAMENTO: 'Exige valor estimado e ao menos um brinde.',
  FOLLOW_UP: null,
  FORECAST: null,
  FECHAMENTO: 'Só a partir de Forecast. Etapa final: não pode ser desfeita.',
  PERDIDA: 'Etapa final: exige o motivo da perda.',
};

export const TRANSITIONS: Record<Stage, Stage[]> = {
  PRIMEIRO_CONTATO: [Stage.APRESENTACAO_ORCAMENTO, Stage.PERDIDA],
  APRESENTACAO_ORCAMENTO: [Stage.FOLLOW_UP, Stage.PERDIDA],
  FOLLOW_UP: [Stage.FORECAST, Stage.APRESENTACAO_ORCAMENTO, Stage.PERDIDA],
  FORECAST: [Stage.FECHAMENTO, Stage.FOLLOW_UP, Stage.PERDIDA],
  FECHAMENTO: [],
  PERDIDA: [],
};

export const isFinalStage = (stage: Stage) => stage === Stage.FECHAMENTO || stage === Stage.PERDIDA;

export const hasProposal = (stage: Stage) =>
  !isFinalStage(stage) && STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(Stage.APRESENTACAO_ORCAMENTO);

export const allowedTransitions = (stage: Stage): Stage[] => TRANSITIONS[stage];

export const NOT_INFORMED_LOSS_REASON = 'NOT_INFORMED';

export const isLossReasonPending = (stage: Stage, lossReasonCode: string | null) =>
  stage === Stage.PERDIDA && (lossReasonCode == null || lossReasonCode === NOT_INFORMED_LOSS_REASON);

const toBrazilianDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export function blockedReason(from: Stage, to: Stage): string | null {
  if (from === to || TRANSITIONS[from].includes(to)) return null;

  if (from === Stage.FECHAMENTO) return 'Venda fechada é uma etapa final e não pode ser movida.';
  if (from === Stage.PERDIDA) {
    return 'Oportunidade perdida é uma etapa final e não pode ser movida. Para retomar, crie uma nova oportunidade.';
  }
  if (to === Stage.FECHAMENTO) return 'Fechamento só é permitido a partir de Forecast.';
  if (to === Stage.PRIMEIRO_CONTATO) return 'Não é possível voltar para Primeiro Contato: o lead já foi qualificado.';

  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);

  if (toIndex > fromIndex) {
    const next = TRANSITIONS[from].find((stage) => STAGE_ORDER.indexOf(stage) === fromIndex + 1);
    return next ? `Não é possível pular etapas. A próxima é ${STAGE_LABELS[next]}.` : 'Não é possível pular etapas.';
  }

  const back = TRANSITIONS[from].find((stage) => STAGE_ORDER.indexOf(stage) === fromIndex - 1);
  return back
    ? `Só é possível voltar uma etapa por vez, para ${STAGE_LABELS[back]}.`
    : `Não é possível voltar de ${STAGE_LABELS[from]} para ${STAGE_LABELS[to]}.`;
}

export function validateLossReason(code: string | undefined, catalog: LossReasonOption[]): RuleViolation[] {
  const value = code?.trim();
  if (!value) return [{ field: 'lossReasonCode', message: 'Informe o motivo da perda.' }];
  const found = catalog.find((reason) => reason.code === value);
  if (!found) return [{ field: 'lossReasonCode', message: 'Motivo de perda inválido.' }];
  if (!found.active) return [{ field: 'lossReasonCode', message: 'Este motivo de perda não pode ser selecionado.' }];
  return [];
}

export function validateMove(subject: MoveSubject, input: MoveInput, lossReasons: LossReasonOption[] = []): RuleViolation[] {
  const blocked = blockedReason(subject.stage, input.to);
  if (blocked) return [{ field: 'to', message: blocked }];
  if (subject.stage === input.to) return [{ field: 'to', message: 'A oportunidade já está nesta etapa.' }];

  const violations: RuleViolation[] = [];

  if (input.to === Stage.APRESENTACAO_ORCAMENTO) {
    const value = input.estimatedValue ?? subject.estimatedValue;
    const items = input.itemCount ?? subject.itemCount;
    if (value == null || value <= 0) {
      violations.push({ field: 'estimatedValue', message: 'Informe o valor estimado para gerar o orçamento.' });
    }
    if (items < 1) {
      violations.push({ field: 'items', message: 'Informe ao menos um item de brinde para gerar o orçamento.' });
    }
  }

  if (input.to === Stage.PERDIDA) {
    violations.push(...validateLossReason(input.lossReasonCode, lossReasons));
  } else if (input.lossReasonCode !== undefined || input.lossNote !== undefined) {
    violations.push({ field: 'lossReasonCode', message: 'O motivo da perda só pode ser informado ao mover para Perdida.' });
  }

  return violations;
}

export function validateProposalValidity(proposalValidUntil: string | undefined, today: string): RuleViolation[] {
  if (proposalValidUntil === undefined || proposalValidUntil.slice(0, 10) >= today) return [];
  return [
    { field: 'proposalValidUntil', message: `A validade da proposta não pode ser anterior a hoje (${toBrazilianDate(today)}).` },
  ];
}
