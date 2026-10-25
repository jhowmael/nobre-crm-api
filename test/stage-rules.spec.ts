import { Stage } from '../src/generated/prisma/enums.js';
import {
  ALL_STAGES,
  allowedTransitions,
  blockedReason,
  hasProposal,
  isFinalStage,
  isLossReasonPending,
  STAGE_HINTS,
  STAGE_LABELS,
  STAGE_REQUIREMENTS,
  validateLossReason,
  validateMove,
  validateProposalValidity,
  type LossReasonOption,
} from '../src/modules/opportunities/domain/stage-rules.js';

const CATALOG: LossReasonOption[] = [
  { code: 'PRICE', label: 'Preço acima do orçamento do cliente', active: true },
  { code: 'COMPETITOR', label: 'Escolheu outro fornecedor', active: true },
  { code: 'OTHER', label: 'Outro motivo', active: true },
  { code: 'NOT_INFORMED', label: 'Não informado (migração)', active: false },
];

describe('stage rules', () => {
  it('conhece todas as etapas do enum, com rótulo e dica', () => {
    expect([...ALL_STAGES].sort()).toEqual((Object.values(Stage) as Stage[]).sort());
    for (const stage of ALL_STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
      expect(STAGE_HINTS[stage]).toBeTruthy();
    }
    expect(STAGE_REQUIREMENTS.APRESENTACAO_ORCAMENTO).toBe('Exige valor estimado e ao menos um brinde.');
    expect(STAGE_REQUIREMENTS.FOLLOW_UP).toBeNull();
  });

  it('permite apenas as transições da matriz definida', () => {
    const allowed: Record<Stage, Stage[]> = {
      PRIMEIRO_CONTATO: ['APRESENTACAO_ORCAMENTO', 'PERDIDA'],
      APRESENTACAO_ORCAMENTO: ['FOLLOW_UP', 'PERDIDA'],
      FOLLOW_UP: ['FORECAST', 'APRESENTACAO_ORCAMENTO', 'PERDIDA'],
      FORECAST: ['FECHAMENTO', 'FOLLOW_UP', 'PERDIDA'],
      FECHAMENTO: [],
      PERDIDA: [],
    };

    for (const from of ALL_STAGES) {
      for (const to of ALL_STAGES) {
        if (from === to) continue;
        expect(blockedReason(from, to) === null, `${from} -> ${to}`).toBe(allowed[from].includes(to));
      }
    }
  });

  it('só entra em Fechamento a partir de Forecast', () => {
    for (const from of ALL_STAGES.filter((stage) => stage !== 'FORECAST' && !isFinalStage(stage))) {
      expect(blockedReason(from, 'FECHAMENTO')).toMatch(/Forecast/);
    }
    expect(blockedReason('FORECAST', 'FECHAMENTO')).toBeNull();
  });

  it('não permite sair de etapas finais nem voltar para Primeiro Contato', () => {
    expect(allowedTransitions('FECHAMENTO')).toEqual([]);
    expect(allowedTransitions('PERDIDA')).toEqual([]);
    expect(blockedReason('FOLLOW_UP', 'PRIMEIRO_CONTATO')).toMatch(/qualificado/);
    expect(blockedReason('FORECAST', 'APRESENTACAO_ORCAMENTO')).not.toBeNull();
  });

  it('exige valor estimado e ao menos um item para Apresentação de Orçamento', () => {
    const subject = { stage: Stage.PRIMEIRO_CONTATO, estimatedValue: null, itemCount: 0 };
    const fields = validateMove(subject, { to: 'APRESENTACAO_ORCAMENTO' }).map((violation) => violation.field);
    expect(fields).toEqual(['estimatedValue', 'items']);

    expect(validateMove(subject, { to: 'APRESENTACAO_ORCAMENTO', estimatedValue: 4500, itemCount: 1 })).toEqual([]);
    expect(validateMove({ ...subject, estimatedValue: 4500, itemCount: 2 }, { to: 'APRESENTACAO_ORCAMENTO' })).toEqual([]);
    expect(validateMove({ ...subject, estimatedValue: 0, itemCount: 1 }, { to: 'APRESENTACAO_ORCAMENTO' })).toHaveLength(1);
  });

  it('exige um motivo de perda ativo do catálogo para Perdida a partir de qualquer etapa não final', () => {
    for (const stage of ALL_STAGES.filter((item) => !isFinalStage(item))) {
      const subject = { stage, estimatedValue: 1000, itemCount: 1 };
      expect(validateMove(subject, { to: 'PERDIDA' }, CATALOG)).toEqual([{ field: 'lossReasonCode', message: 'Informe o motivo da perda.' }]);
      expect(validateMove(subject, { to: 'PERDIDA', lossReasonCode: '   ' }, CATALOG)).toHaveLength(1);
      expect(validateMove(subject, { to: 'PERDIDA', lossReasonCode: 'INEXISTENTE' }, CATALOG)[0].message).toBe('Motivo de perda inválido.');
      expect(validateMove(subject, { to: 'PERDIDA', lossReasonCode: 'NOT_INFORMED' }, CATALOG)[0].message).toMatch(/não pode ser selecionado/);
      expect(validateMove(subject, { to: 'PERDIDA', lossReasonCode: 'COMPETITOR' }, CATALOG)).toEqual([]);
      expect(validateMove(subject, { to: 'PERDIDA', lossReasonCode: 'OTHER', lossNote: 'Cliente fechou com a matriz' }, CATALOG)).toEqual([]);
    }
  });

  it('não aceita motivo de perda fora da mudança para Perdida', () => {
    const subject = { stage: Stage.FOLLOW_UP, estimatedValue: 1000, itemCount: 1 };
    expect(validateMove(subject, { to: 'FORECAST', lossReasonCode: 'PRICE' }, CATALOG)).toEqual([
      { field: 'lossReasonCode', message: 'O motivo da perda só pode ser informado ao mover para Perdida.' },
    ]);
    expect(validateMove(subject, { to: 'FORECAST', lossNote: 'texto' }, CATALOG)).toHaveLength(1);
  });

  it('valida o motivo isoladamente e reconhece motivo pendente', () => {
    expect(validateLossReason('PRICE', CATALOG)).toEqual([]);
    expect(validateLossReason(undefined, CATALOG)).toHaveLength(1);
    expect(isLossReasonPending('PERDIDA', 'NOT_INFORMED')).toBe(true);
    expect(isLossReasonPending('PERDIDA', 'PRICE')).toBe(false);
    expect(isLossReasonPending('FOLLOW_UP', null)).toBe(false);
  });

  it('não aceita validade da proposta anterior a hoje', () => {
    expect(validateProposalValidity(undefined, '2026-10-15')).toEqual([]);
    expect(validateProposalValidity('2026-10-15', '2026-10-15')).toEqual([]);
    expect(validateProposalValidity('2026-10-14', '2026-10-15')).toEqual([
      { field: 'proposalValidUntil', message: 'A validade da proposta não pode ser anterior a hoje (15/10/2026).' },
    ]);
  });

  it('rejeita mover para a etapa atual', () => {
    expect(validateMove({ stage: Stage.FOLLOW_UP, estimatedValue: 1, itemCount: 1 }, { to: 'FOLLOW_UP' })).toHaveLength(1);
  });

  it('considera que a proposta existe a partir de Apresentação de Orçamento e antes das etapas finais', () => {
    expect(hasProposal('PRIMEIRO_CONTATO')).toBe(false);
    expect(hasProposal('APRESENTACAO_ORCAMENTO')).toBe(true);
    expect(hasProposal('FORECAST')).toBe(true);
    expect(hasProposal('FECHAMENTO')).toBe(false);
  });
});
