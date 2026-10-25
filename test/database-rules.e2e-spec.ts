import { createTestApp, resetDatabase, type TestApp } from './support/app.js';

let ctx: TestApp;

const run = (sql: string) => ctx.prisma.$executeRawUnsafe(sql);

const rejects = async (sql: string, pattern: RegExp) => {
  await expect(run(sql)).rejects.toThrow(pattern);
};

const stageOf = async (number: number) => (await ctx.prisma.opportunity.findUniqueOrThrow({ where: { number } })).stage;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

describe('regras de integridade no banco (SQL direto)', () => {
  it('o gatilho de transição bloqueia pulo de etapa, volta para Primeiro Contato e Fechamento fora de Forecast', async () => {
    await rejects(`UPDATE opportunities SET stage = 'FOLLOW_UP' WHERE number = 2001`, /Transição inválida de PRIMEIRO_CONTATO para FOLLOW_UP/);
    await rejects(`UPDATE opportunities SET stage = 'PRIMEIRO_CONTATO' WHERE number = 2003`, /Transição inválida/);
    await rejects(`UPDATE opportunities SET stage = 'FECHAMENTO' WHERE number = 2003`, /Transição inválida/);
    expect(await stageOf(2001)).toBe('PRIMEIRO_CONTATO');
  });

  it('o gatilho impede alterar etapa final', async () => {
    await rejects(`UPDATE opportunities SET stage = 'FORECAST' WHERE number = 2006`, /Etapa final FECHAMENTO não pode ser alterada/);
    await rejects(`UPDATE opportunities SET stage = 'FOLLOW_UP' WHERE number = 2007`, /Etapa final PERDIDA/);
  });

  it('Perdida exige loss_reason_code não nulo e existente no catálogo', async () => {
    await rejects(`UPDATE opportunities SET stage = 'PERDIDA' WHERE number = 2002`, /opportunities_loss_reason_check/);
    await rejects(`UPDATE opportunities SET stage = 'PERDIDA', loss_reason_code = 'INEXISTENTE' WHERE number = 2002`, /opportunities_loss_reason_code_fkey/);
    await rejects(`UPDATE opportunities SET loss_reason_code = NULL WHERE number = 2007`, /opportunities_loss_reason_check/);
    await expect(run(`UPDATE opportunities SET stage = 'PERDIDA', loss_reason_code = 'PRICE' WHERE number = 2002`)).resolves.toBe(1);
    expect(await stageOf(2002)).toBe('PERDIDA');
  });

  it('motivo e observação de perda só existem em oportunidades Perdidas', async () => {
    await rejects(`UPDATE opportunities SET loss_reason_code = 'PRICE' WHERE number = 2001`, /opportunities_loss_reason_stage_check/);
    await rejects(`UPDATE opportunities SET loss_note = 'texto' WHERE number = 2001`, /opportunities_loss_reason_stage_check/);
    await rejects(`UPDATE opportunities SET loss_note = '   ' WHERE number = 2007`, /opportunities_loss_note_check/);
  });

  it('CHECKs de valor, versão, empresa, quantidade e nome do brinde', async () => {
    await rejects(`UPDATE opportunities SET estimated_value = -1 WHERE number = 2001`, /opportunities_estimated_value_check/);
    await rejects(`UPDATE opportunities SET estimated_value = NULL WHERE number = 2002`, /opportunities_quote_value_check/);
    await rejects(`UPDATE opportunities SET version = 0 WHERE number = 2001`, /opportunities_version_check/);
    await rejects(`UPDATE opportunities SET company = '  ' WHERE number = 2001`, /opportunities_company_check/);
    await rejects(`UPDATE opportunity_items SET quantity = 0`, /opportunity_items_quantity_check/);
    await rejects(`UPDATE opportunity_items SET name = ''`, /opportunity_items_name_check/);
  });

  it('as etapas de orçamento exigem ao menos um item (gatilho adiado até o commit)', async () => {
    await rejects(
      `DELETE FROM opportunity_items WHERE opportunity_id = (SELECT id FROM opportunities WHERE number = 2002)`,
      /exige ao menos um item de brinde/,
    );
    await rejects(
      `INSERT INTO opportunities (id, company, seller_id, stage, estimated_value, updated_at)
       SELECT gen_random_uuid(), 'Direto no banco', id, 'FOLLOW_UP', 100, now() FROM sellers WHERE name = 'Ana'`,
      /exige ao menos um item de brinde/,
    );
    expect(await ctx.prisma.opportunityItem.count({ where: { opportunity: { number: 2002 } } })).toBe(1);
  });

  it('o histórico não aceita origem igual ao destino', async () => {
    await rejects(
      `INSERT INTO stage_histories (id, opportunity_id, from_stage, to_stage)
       SELECT gen_random_uuid(), id, 'FOLLOW_UP', 'FOLLOW_UP' FROM opportunities WHERE number = 2003`,
      /stage_histories_transition_check/,
    );
  });

  it('o catálogo de motivos protege códigos em uso e valida o formato', async () => {
    await rejects(`DELETE FROM loss_reasons WHERE code = 'NOT_INFORMED'`, /opportunities_loss_reason_code_fkey/);
    await rejects(`INSERT INTO loss_reasons (code, label, sort_order) VALUES ('minusculo', 'Teste', 1)`, /loss_reasons_code_check/);
    await rejects(`INSERT INTO loss_reasons (code, label, sort_order) VALUES ('VAZIO', ' ', 1)`, /loss_reasons_label_check/);
  });

  it('o catálogo inicial tem os sete motivos, com NOT_INFORMED inativo', async () => {
    const rows = await ctx.prisma.lossReason.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(rows.map((row) => [row.code, row.active])).toEqual([
      ['PRICE', true],
      ['DEADLINE', true],
      ['COMPETITOR', true],
      ['EVENT_CANCELLED', true],
      ['NO_RESPONSE', true],
      ['OTHER', true],
      ['NOT_INFORMED', false],
    ]);
  });

  it('a API traduz uma violação do banco em 422 no formato padrão', async () => {
    const opp = await ctx.prisma.opportunity.findUniqueOrThrow({ where: { number: 2003 } });
    await run(`ALTER TABLE opportunities ADD CONSTRAINT e2e_value_cap CHECK (estimated_value IS NULL OR estimated_value < 1000000)`);
    try {
      const response = await ctx
        .http()
        .patch(`/opportunities/${opp.id}`)
        .send({ expectedVersion: opp.version, estimatedValue: 2_000_000 })
        .expect(422);
      expect(response.body).toEqual({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'A operação viola uma regra de integridade dos dados.',
        errors: [],
      });
    } finally {
      await run(`ALTER TABLE opportunities DROP CONSTRAINT e2e_value_cap`);
    }
    expect((await ctx.prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } })).version).toBe(opp.version);
  });
});
