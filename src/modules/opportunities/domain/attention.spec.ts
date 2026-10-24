import type { Stage } from '../../../generated/prisma/enums.js';
import { evaluateAttention, type AttentionSubject } from './attention.js';

const TODAY = '2026-10-15';

const subject = (overrides: Partial<AttentionSubject>): AttentionSubject => ({
  stage: 'FOLLOW_UP',
  proposalValidUntil: '2026-10-30',
  lastContactAt: '2026-10-15',
  eventDate: '2026-12-01',
  ...overrides,
});

const codes = (value: AttentionSubject) => evaluateAttention(value, TODAY).signals.map((signal) => signal.code);

describe('evaluateAttention com os dados do case (hoje = 15/10/2026)', () => {
  const cases: [string, AttentionSubject, string, string[]][] = [
    ['OPP-2001', { stage: 'PRIMEIRO_CONTATO', lastContactAt: '2026-10-14', proposalValidUntil: null, eventDate: '2026-11-30' }, 'none', []],
    ['OPP-2002', { stage: 'APRESENTACAO_ORCAMENTO', lastContactAt: '2026-10-06', proposalValidUntil: '2026-10-13', eventDate: '2026-10-25' }, 'high', ['PROPOSAL_EXPIRED', 'NO_CONTACT']],
    ['OPP-2003', { stage: 'FOLLOW_UP', lastContactAt: '2026-10-13', proposalValidUntil: '2026-10-20', eventDate: '2026-10-18' }, 'high', ['EVENT_NEAR', 'PROPOSAL_AFTER_EVENT']],
    ['OPP-2004', { stage: 'FOLLOW_UP', lastContactAt: '2026-10-02', proposalValidUntil: '2026-10-10', eventDate: '2026-11-05' }, 'high', ['PROPOSAL_EXPIRED', 'NO_CONTACT']],
    ['OPP-2005', { stage: 'FORECAST', lastContactAt: '2026-10-15', proposalValidUntil: '2026-10-22', eventDate: '2026-12-12' }, 'none', []],
    ['OPP-2006', { stage: 'FECHAMENTO', lastContactAt: '2026-10-09', proposalValidUntil: '2026-10-16', eventDate: '2026-10-17' }, 'none', []],
    ['OPP-2007', { stage: 'PERDIDA', lastContactAt: '2026-10-01', proposalValidUntil: '2026-10-08', eventDate: '2026-10-20' }, 'none', []],
  ];

  it.each(cases)('%s', (_code, input, level, expected) => {
    const attention = evaluateAttention(input, TODAY);
    expect(attention.level).toBe(level);
    expect(attention.signals.map((signal) => signal.code)).toEqual(expected);
  });
});

describe('evaluateAttention nos limites', () => {
  it('sem contato: 4 dias não alerta, 5 acompanha, 7 age', () => {
    expect(codes(subject({ lastContactAt: '2026-10-11' }))).toEqual([]);
    expect(evaluateAttention(subject({ lastContactAt: '2026-10-10' }), TODAY).level).toBe('medium');
    expect(evaluateAttention(subject({ lastContactAt: '2026-10-08' }), TODAY).level).toBe('high');
  });

  it('proposta: vence hoje acompanha, em 3 dias acompanha, em 4 dias não alerta, ontem age', () => {
    expect(codes(subject({ proposalValidUntil: '2026-10-15' }))).toEqual(['PROPOSAL_EXPIRES_TODAY']);
    expect(codes(subject({ proposalValidUntil: '2026-10-18' }))).toEqual(['PROPOSAL_EXPIRING']);
    expect(codes(subject({ proposalValidUntil: '2026-10-19' }))).toEqual([]);
    expect(evaluateAttention(subject({ proposalValidUntil: '2026-10-14' }), TODAY).level).toBe('high');
  });

  it('campos em branco: sem validade só alerta a partir de Orçamento; sem contato alerta sempre', () => {
    expect(codes(subject({ stage: 'PRIMEIRO_CONTATO', proposalValidUntil: null }))).toEqual([]);
    expect(codes(subject({ stage: 'APRESENTACAO_ORCAMENTO', proposalValidUntil: null }))).toEqual(['PROPOSAL_MISSING']);
    expect(codes(subject({ lastContactAt: null }))).toEqual(['NO_CONTACT_REGISTERED']);
    expect(codes(subject({ eventDate: null }))).toEqual([]);
  });

  it('evento: limite de 7 dias fora de Forecast e de 3 dias em Forecast', () => {
    expect(codes(subject({ eventDate: '2026-10-22' }))).toContain('EVENT_NEAR');
    expect(codes(subject({ eventDate: '2026-10-23' }))).not.toContain('EVENT_NEAR');
    expect(codes(subject({ stage: 'FORECAST', eventDate: '2026-10-18' }))).toContain('EVENT_NEAR');
    expect(codes(subject({ stage: 'FORECAST', eventDate: '2026-10-19' }))).not.toContain('EVENT_NEAR');
    expect(codes(subject({ eventDate: '2026-10-10' }))).toContain('EVENT_PAST');
  });

  it('etapas finais nunca geram alerta', () => {
    for (const stage of ['FECHAMENTO', 'PERDIDA'] as Stage[]) {
      expect(evaluateAttention(subject({ stage, proposalValidUntil: '2026-01-01', lastContactAt: null }), TODAY)).toEqual({ level: 'none', signals: [] });
    }
  });
});
