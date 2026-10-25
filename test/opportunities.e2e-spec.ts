import { toBusinessDate } from '../src/common/clock/clock.service.js';
import { codes, createTestApp, opportunityByNumber, resetDatabase, sellerByName, type TestApp } from './support/app.js';

let ctx: TestApp;

const historyCount = (opportunityId: string) => ctx.prisma.stageHistory.count({ where: { opportunityId } });

const move = async (number: number, body: Record<string, unknown>, status: number) => {
  const opp = await opportunityByNumber(ctx.prisma, number);
  return ctx
    .http()
    .patch(`/opportunities/${opp.id}/stage`)
    .send({ expectedVersion: opp.version, ...body })
    .expect(status);
};

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

describe('GET /opportunities: listagem e filtros', () => {
  beforeAll(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('lista as 7 oportunidades do case em ordem de código, já com atenção e transições', async () => {
    const response = await ctx.http().get('/opportunities').expect(200);
    expect(codes(response.body)).toEqual(['OPP-2001', 'OPP-2002', 'OPP-2003', 'OPP-2004', 'OPP-2005', 'OPP-2006', 'OPP-2007']);
    expect(response.headers['x-total-count']).toBeUndefined();

    const first = response.body[0];
    expect(first).toMatchObject({
      code: 'OPP-2001',
      company: 'Tech Alpha Ltda',
      seller: { name: 'Ana' },
      items: [{ name: 'Caneca personalizada', quantity: 300 }],
      estimatedValue: 4500,
      lastContactAt: '2026-10-14',
      proposalValidUntil: null,
      eventDate: '2026-11-30',
      stage: 'PRIMEIRO_CONTATO',
      lossReason: null,
      lossNote: null,
      lossReasonPending: false,
      version: 1,
      attention: { level: 'none', signals: [] },
      allowedTransitions: ['APRESENTACAO_ORCAMENTO', 'PERDIDA'],
    });
  });

  it('traz o motivo de perda migrado da OPP-2007 como pendente', async () => {
    const response = await ctx.http().get('/opportunities').query({ search: 'OPP-2007' }).expect(200);
    expect(response.body[0]).toMatchObject({
      stage: 'PERDIDA',
      lossReason: { code: 'NOT_INFORMED', label: 'Não informado (migração)' },
      lossNote: null,
      lossReasonPending: true,
      allowedTransitions: [],
    });
  });

  it('busca pelo código OPP-2003', async () => {
    const response = await ctx.http().get('/opportunities').query({ search: 'OPP-2003' }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2003']);
    const lower = await ctx.http().get('/opportunities').query({ search: 'opp2003' }).expect(200);
    expect(codes(lower.body)).toEqual(['OPP-2003']);
  });

  it('busca pelo nome do brinde, sem diferenciar maiúsculas', async () => {
    const response = await ctx.http().get('/opportunities').query({ search: 'squeeze' }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2003']);
  });

  it('busca por empresa e por vendedor', async () => {
    expect(codes((await ctx.http().get('/opportunities').query({ search: 'banco' }).expect(200)).body)).toEqual(['OPP-2005']);
    expect(codes((await ctx.http().get('/opportunities').query({ search: 'Carla' }).expect(200)).body)).toEqual(['OPP-2004', 'OPP-2006']);
  });

  it('não quebra com código fora do intervalo de inteiros', async () => {
    const response = await ctx.http().get('/opportunities').query({ search: 'OPP-99999999999999' }).expect(200);
    expect(response.body).toEqual([]);
  });

  it('filtra por vendedor', async () => {
    const ana = await sellerByName(ctx.prisma, 'Ana');
    const response = await ctx.http().get('/opportunities').query({ sellerId: ana.id }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2001', 'OPP-2003', 'OPP-2007']);
  });

  it('filtra por etapa', async () => {
    const response = await ctx.http().get('/opportunities').query({ stage: 'FOLLOW_UP' }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2003', 'OPP-2004']);
  });

  it('filtra somente o que exige atenção, combinando com outros filtros', async () => {
    const response = await ctx.http().get('/opportunities').query({ onlyAttention: 'true' }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2002', 'OPP-2003', 'OPP-2004']);
    for (const opp of response.body) expect(opp.attention.level).toBe('high');

    const ana = await sellerByName(ctx.prisma, 'Ana');
    const mine = await ctx.http().get('/opportunities').query({ onlyAttention: 'true', sellerId: ana.id }).expect(200);
    expect(codes(mine.body)).toEqual(['OPP-2003']);

    const all = await ctx.http().get('/opportunities').query({ onlyAttention: 'false' }).expect(200);
    expect(all.body).toHaveLength(7);
  });

  it('rejeita filtros inválidos com 400 e a lista de erros', async () => {
    const response = await ctx.http().get('/opportunities').query({ stage: 'QUALQUER', sellerId: 'abc' }).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(response.body.errors.map((error: { field: string }) => error.field).sort()).toEqual(['sellerId', 'stage']);
  });
});

describe('GET /opportunities: paginação e ordenação', () => {
  beforeAll(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('pagina e devolve X-Total-Count quando page ou pageSize são enviados', async () => {
    const first = await ctx.http().get('/opportunities').query({ page: 1, pageSize: 2 }).expect(200);
    expect(codes(first.body)).toEqual(['OPP-2001', 'OPP-2002']);
    expect(first.headers['x-total-count']).toBe('7');

    const last = await ctx.http().get('/opportunities').query({ page: 2, pageSize: 5 }).expect(200);
    expect(codes(last.body)).toEqual(['OPP-2006', 'OPP-2007']);
    expect(last.headers['x-total-count']).toBe('7');

    const beyond = await ctx.http().get('/opportunities').query({ page: 9, pageSize: 5 }).expect(200);
    expect(beyond.body).toEqual([]);
    expect(beyond.headers['x-total-count']).toBe('7');

    const onlyPage = await ctx.http().get('/opportunities').query({ page: 1 }).expect(200);
    expect(onlyPage.body).toHaveLength(7);
    expect(onlyPage.headers['x-total-count']).toBe('7');
  });

  it('pagina depois do filtro de atenção', async () => {
    const response = await ctx.http().get('/opportunities').query({ onlyAttention: 'true', pageSize: 2 }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2002', 'OPP-2003']);
    expect(response.headers['x-total-count']).toBe('3');
  });

  it('respeita o total filtrado', async () => {
    const response = await ctx.http().get('/opportunities').query({ stage: 'FOLLOW_UP', page: 1, pageSize: 1 }).expect(200);
    expect(codes(response.body)).toEqual(['OPP-2003']);
    expect(response.headers['x-total-count']).toBe('2');
  });

  it('ordena por valor estimado, empresa, data do evento e código', async () => {
    const byValue = await ctx.http().get('/opportunities').query({ sort: 'estimatedValue', order: 'desc' }).expect(200);
    expect(codes(byValue.body)).toEqual(['OPP-2005', 'OPP-2006', 'OPP-2002', 'OPP-2003', 'OPP-2001', 'OPP-2004', 'OPP-2007']);

    const byCompany = await ctx.http().get('/opportunities').query({ sort: 'company' }).expect(200);
    expect(byCompany.body.map((opp: { company: string }) => opp.company)).toEqual([
      'Agência Pulso',
      'Banco Norte',
      'Clínica Vida',
      'Construtora Horizonte',
      'Escola Saber',
      'Padaria do Bairro',
      'Tech Alpha Ltda',
    ]);

    const byEvent = await ctx.http().get('/opportunities').query({ sort: 'eventDate', order: 'asc' }).expect(200);
    expect(codes(byEvent.body)).toEqual(['OPP-2006', 'OPP-2003', 'OPP-2007', 'OPP-2002', 'OPP-2004', 'OPP-2001', 'OPP-2005']);

    const byNumber = await ctx.http().get('/opportunities').query({ sort: 'number', order: 'desc' }).expect(200);
    expect(codes(byNumber.body)[0]).toBe('OPP-2007');
  });

  it('deixa valores vazios por último nas duas direções', async () => {
    const ana = await sellerByName(ctx.prisma, 'Ana');
    await ctx.http().post('/opportunities').send({ company: 'Sem Valor SA', sellerId: ana.id }).expect(201);

    const asc = await ctx.http().get('/opportunities').query({ sort: 'estimatedValue', order: 'asc' }).expect(200);
    const desc = await ctx.http().get('/opportunities').query({ sort: 'estimatedValue', order: 'desc' }).expect(200);
    expect(asc.body.at(-1).company).toBe('Sem Valor SA');
    expect(desc.body.at(-1).company).toBe('Sem Valor SA');
  });

  it('rejeita parâmetros de paginação e ordenação inválidos', async () => {
    await ctx.http().get('/opportunities').query({ page: 0 }).expect(400);
    await ctx.http().get('/opportunities').query({ pageSize: 101 }).expect(400);
    await ctx.http().get('/opportunities').query({ page: 'abc' }).expect(400);
    await ctx.http().get('/opportunities').query({ sort: 'seller' }).expect(400);
    await ctx.http().get('/opportunities').query({ order: 'up' }).expect(400);
  });
});

describe('POST /opportunities', () => {
  beforeAll(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('cria em Primeiro Contato, com contato de hoje e histórico de criação', async () => {
    const bruno = await sellerByName(ctx.prisma, 'Bruno');
    const response = await ctx
      .http()
      .post('/opportunities')
      .send({
        company: '  Nova Empresa Ltda  ',
        sellerId: bruno.id,
        items: [{ name: ' Boné bordado ', quantity: 150 }],
        estimatedValue: 2750.5,
        eventDate: '2026-12-01',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      code: 'OPP-2008',
      company: 'Nova Empresa Ltda',
      seller: { id: bruno.id, name: 'Bruno' },
      items: [{ name: 'Boné bordado', quantity: 150 }],
      estimatedValue: 2750.5,
      lastContactAt: '2026-10-15',
      eventDate: '2026-12-01',
      stage: 'PRIMEIRO_CONTATO',
      version: 1,
    });

    const history = await ctx.http().get(`/opportunities/${response.body.id}/history`).expect(200);
    expect(history.body).toEqual([
      { id: expect.any(String), from: null, to: 'PRIMEIRO_CONTATO', note: 'Oportunidade criada', at: expect.any(String) },
    ]);
    expect(toBusinessDate(new Date(history.body[0].at))).toBe('2026-10-15');

    const found = await ctx.http().get(`/opportunities/${response.body.id}`).expect(200);
    expect(found.body.code).toBe('OPP-2008');
  });

  it('valida a entrada', async () => {
    const response = await ctx.http().post('/opportunities').send({ company: '   ', sellerId: 'x', extra: 1 }).expect(400);
    const fields = response.body.errors.map((error: { field: string }) => error.field);
    expect(fields).toEqual(expect.arrayContaining(['company', 'sellerId', 'extra']));
    expect(response.body.errors.find((error: { field: string }) => error.field === 'extra').message).toBe('O campo extra não é permitido.');
  });

  it('responde 422 para vendedor inexistente', async () => {
    const response = await ctx
      .http()
      .post('/opportunities')
      .send({ company: 'Fantasma', sellerId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
      .expect(422);
    expect(response.body.message).toMatch(/Referência inválida/);
  });

  it('responde 404 para oportunidade inexistente e 400 para id inválido', async () => {
    await ctx.http().get('/opportunities/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d').expect(404);
    const invalid = await ctx.http().get('/opportunities/nao-e-uuid').expect(400);
    expect(invalid.body).toEqual({ statusCode: 400, error: 'Bad Request', message: 'Identificador inválido: informe um UUID.', errors: [] });
  });
});

describe('PATCH /opportunities/:id/stage', () => {
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('move para a próxima etapa, incrementa a versão e grava o histórico (de, para, quando)', async () => {
    const before = await opportunityByNumber(ctx.prisma, 2001);
    const response = await move(2001, { to: 'APRESENTACAO_ORCAMENTO', proposalValidUntil: '2026-10-30' }, 200);

    expect(response.body).toMatchObject({
      stage: 'APRESENTACAO_ORCAMENTO',
      version: before.version + 1,
      proposalValidUntil: '2026-10-30',
      allowedTransitions: ['FOLLOW_UP', 'PERDIDA'],
    });

    const history = await ctx.http().get(`/opportunities/${before.id}/history`).expect(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toMatchObject({ from: 'PRIMEIRO_CONTATO', to: 'APRESENTACAO_ORCAMENTO', note: null });
    expect(toBusinessDate(new Date(history.body[0].at))).toBe('2026-10-15');
  });

  it('move para Perdida com motivo do catálogo e observação, gravando o motivo no histórico', async () => {
    const before = await opportunityByNumber(ctx.prisma, 2002);
    const response = await move(2002, { to: 'PERDIDA', lossReasonCode: 'PRICE', lossNote: '  Cliente achou caro  ' }, 200);

    expect(response.body).toMatchObject({
      stage: 'PERDIDA',
      lossReason: { code: 'PRICE', label: 'Preço acima do orçamento do cliente' },
      lossNote: 'Cliente achou caro',
      lossReasonPending: false,
      allowedTransitions: [],
      attention: { level: 'none', signals: [] },
    });

    const history = await ctx.http().get(`/opportunities/${before.id}/history`).expect(200);
    expect(history.body[0]).toMatchObject({
      from: 'APRESENTACAO_ORCAMENTO',
      to: 'PERDIDA',
      note: 'Preço acima do orçamento do cliente: Cliente achou caro',
    });
  });

  it('percorre o funil até Fechamento, com os retornos permitidos', async () => {
    const steps = ['FOLLOW_UP', 'FORECAST', 'FOLLOW_UP', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FECHAMENTO'];
    for (const to of steps) await move(2002, { to }, 200);

    const opp = await opportunityByNumber(ctx.prisma, 2002);
    expect(opp.stage).toBe('FECHAMENTO');
    expect(opp.version).toBe(1 + steps.length);
    expect(await historyCount(opp.id)).toBe(2 + steps.length);
  });

  it('substitui itens e valor ao mover para Apresentação de Orçamento', async () => {
    const ana = await sellerByName(ctx.prisma, 'Ana');
    const created = await ctx.http().post('/opportunities').send({ company: 'Lead Vazio', sellerId: ana.id }).expect(201);

    const response = await ctx
      .http()
      .patch(`/opportunities/${created.body.id}/stage`)
      .send({ to: 'APRESENTACAO_ORCAMENTO', expectedVersion: 1, estimatedValue: 1200, items: [{ name: 'Chaveiro', quantity: 400 }] })
      .expect(200);
    expect(response.body).toMatchObject({ estimatedValue: 1200, items: [{ name: 'Chaveiro', quantity: 400 }], stage: 'APRESENTACAO_ORCAMENTO' });
  });

  describe('violações respondem 422 com errors[] e não alteram nada', () => {
    const expectRejected = async (number: number, body: Record<string, unknown>, fields: string[], message: RegExp) => {
      const before = await opportunityByNumber(ctx.prisma, number);
      const historyBefore = await historyCount(before.id);
      const response = await move(number, body, 422);

      expect(response.body).toMatchObject({ statusCode: 422, error: 'Unprocessable Entity' });
      expect(response.body.message).toMatch(message);
      expect(response.body.errors.map((error: { field: string }) => error.field)).toEqual(fields);
      for (const error of response.body.errors) expect(typeof error.message).toBe('string');

      const after = await opportunityByNumber(ctx.prisma, number);
      expect(after.stage).toBe(before.stage);
      expect(after.version).toBe(before.version);
      expect(await historyCount(before.id)).toBe(historyBefore);
      return response.body;
    };

    it('transição inválida a partir de etapa final', async () => {
      await expectRejected(2006, { to: 'FORECAST' }, ['to'], /etapa final/);
      await expectRejected(2007, { to: 'FOLLOW_UP' }, ['to'], /nova oportunidade/);
    });

    it('pular etapa', async () => {
      await expectRejected(2001, { to: 'FOLLOW_UP' }, ['to'], /pular etapas\. A próxima é Apresentação de Orçamento/);
      await expectRejected(2002, { to: 'FORECAST' }, ['to'], /pular etapas/);
    });

    it('voltar para Primeiro Contato', async () => {
      await expectRejected(2003, { to: 'PRIMEIRO_CONTATO' }, ['to'], /Primeiro Contato: o lead já foi qualificado/);
    });

    it('voltar mais de uma etapa', async () => {
      await expectRejected(2005, { to: 'APRESENTACAO_ORCAMENTO' }, ['to'], /voltar uma etapa por vez/);
    });

    it('Fechamento fora de Forecast', async () => {
      await expectRejected(2003, { to: 'FECHAMENTO' }, ['to'], /Fechamento só é permitido a partir de Forecast/);
      await expectRejected(2001, { to: 'FECHAMENTO' }, ['to'], /Forecast/);
    });

    it('mover para a etapa atual', async () => {
      await expectRejected(2003, { to: 'FOLLOW_UP' }, ['to'], /já está nesta etapa/);
    });

    it('Apresentação de Orçamento sem valor estimado', async () => {
      const ana = await sellerByName(ctx.prisma, 'Ana');
      const created = await ctx
        .http()
        .post('/opportunities')
        .send({ company: 'Sem Valor', sellerId: ana.id, items: [{ name: 'Copo', quantity: 10 }] })
        .expect(201);
      await expectRejected(Number(created.body.code.slice(4)), { to: 'APRESENTACAO_ORCAMENTO' }, ['estimatedValue'], /valor estimado/);
    });

    it('Apresentação de Orçamento sem itens', async () => {
      const ana = await sellerByName(ctx.prisma, 'Ana');
      const created = await ctx.http().post('/opportunities').send({ company: 'Sem Itens', sellerId: ana.id, estimatedValue: 900 }).expect(201);
      await expectRejected(Number(created.body.code.slice(4)), { to: 'APRESENTACAO_ORCAMENTO' }, ['items'], /ao menos um item/);
    });

    it('Apresentação de Orçamento sem valor e sem itens lista as duas violações', async () => {
      const ana = await sellerByName(ctx.prisma, 'Ana');
      const created = await ctx.http().post('/opportunities').send({ company: 'Vazia', sellerId: ana.id }).expect(201);
      await expectRejected(Number(created.body.code.slice(4)), { to: 'APRESENTACAO_ORCAMENTO' }, ['estimatedValue', 'items'], /valor estimado/);
    });

    it('Perdida sem motivo', async () => {
      await expectRejected(2002, { to: 'PERDIDA' }, ['lossReasonCode'], /Informe o motivo da perda/);
      await expectRejected(2002, { to: 'PERDIDA', lossNote: 'só a observação' }, ['lossReasonCode'], /Informe o motivo da perda/);
    });

    it('Perdida com motivo inativo ou inexistente', async () => {
      await expectRejected(2003, { to: 'PERDIDA', lossReasonCode: 'NOT_INFORMED' }, ['lossReasonCode'], /não pode ser selecionado/);
      await expectRejected(2003, { to: 'PERDIDA', lossReasonCode: 'INEXISTENTE' }, ['lossReasonCode'], /Motivo de perda inválido/);
    });

    it('motivo de perda fora da mudança para Perdida', async () => {
      await expectRejected(2003, { to: 'FORECAST', lossReasonCode: 'PRICE' }, ['lossReasonCode'], /só pode ser informado ao mover para Perdida/);
    });
  });

  it('formato inválido do motivo responde 400', async () => {
    const response = await move(2003, { to: 'PERDIDA', lossReasonCode: 'preço' }, 400);
    expect(response.body.errors[0]).toEqual({ field: 'lossReasonCode', message: 'Motivo de perda inválido.' });
  });

  it('responde 409 com expectedVersion desatualizada', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2003);
    const response = await ctx
      .http()
      .patch(`/opportunities/${opp.id}/stage`)
      .send({ to: 'FORECAST', expectedVersion: opp.version + 5 })
      .expect(409);
    expect(response.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'A oportunidade foi alterada por outra pessoa. Atualize e tente novamente.',
      errors: [],
    });
    expect((await opportunityByNumber(ctx.prisma, 2003)).stage).toBe('FOLLOW_UP');
  });

  it('concorrência: duas mudanças simultâneas com a mesma versão geram um 200, um 409 e uma linha de histórico', async () => {
    for (let round = 0; round < 6; round += 1) {
      const opp = await opportunityByNumber(ctx.prisma, 2003);
      const to = opp.stage === 'FOLLOW_UP' ? 'FORECAST' : 'FOLLOW_UP';
      const historyBefore = await historyCount(opp.id);

      const responses = await Promise.all([
        ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to, expectedVersion: opp.version }),
        ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to, expectedVersion: opp.version }),
      ]);

      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(await historyCount(opp.id)).toBe(historyBefore + 1);
      const after = await opportunityByNumber(ctx.prisma, 2003);
      expect(after.version).toBe(opp.version + 1);
      expect(after.stage).toBe(to);
    }
  });

  it('concorrência: destinos diferentes com a mesma versão também resultam em um único vencedor', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2005);
    const responses = await Promise.all([
      ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to: 'FECHAMENTO', expectedVersion: opp.version }),
      ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to: 'PERDIDA', lossReasonCode: 'COMPETITOR', expectedVersion: opp.version }),
      ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to: 'FOLLOW_UP', expectedVersion: opp.version }),
    ]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409, 409]);
    expect(await historyCount(opp.id)).toBe(5);
  });
});

describe('PATCH /opportunities/:id', () => {
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('atualiza valor, validade e data do evento e incrementa a versão', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2003);
    const response = await ctx
      .http()
      .patch(`/opportunities/${opp.id}`)
      .send({ expectedVersion: opp.version, estimatedValue: 8000, proposalValidUntil: '2026-10-17', eventDate: '2026-10-25' })
      .expect(200);
    expect(response.body).toMatchObject({ estimatedValue: 8000, proposalValidUntil: '2026-10-17', eventDate: '2026-10-25', version: opp.version + 1 });
  });

  it('completa o motivo pendente da OPP-2007 uma única vez', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2007);
    const response = await ctx
      .http()
      .patch(`/opportunities/${opp.id}`)
      .send({ expectedVersion: opp.version, lossReasonCode: 'COMPETITOR', lossNote: 'Padaria fechou com gráfica do bairro' })
      .expect(200);
    expect(response.body).toMatchObject({
      lossReason: { code: 'COMPETITOR', label: 'Escolheu outro fornecedor' },
      lossNote: 'Padaria fechou com gráfica do bairro',
      lossReasonPending: false,
      version: opp.version + 1,
    });

    const again = await ctx
      .http()
      .patch(`/opportunities/${opp.id}`)
      .send({ expectedVersion: opp.version + 1, lossReasonCode: 'PRICE' })
      .expect(422);
    expect(again.body.errors).toEqual([{ field: 'lossReasonCode', message: 'O motivo da perda já foi registrado e não pode ser alterado.' }]);
  });

  it('não aceita motivo inativo, motivo fora de Perdida nem editar etapa final', async () => {
    const lost = await opportunityByNumber(ctx.prisma, 2007);
    await ctx.http().patch(`/opportunities/${lost.id}`).send({ expectedVersion: lost.version, lossReasonCode: 'NOT_INFORMED' }).expect(422);
    await ctx.http().patch(`/opportunities/${lost.id}`).send({ expectedVersion: lost.version, lossNote: 'sem código' }).expect(422);
    await ctx.http().patch(`/opportunities/${lost.id}`).send({ expectedVersion: lost.version, estimatedValue: 10 }).expect(422);

    const closed = await opportunityByNumber(ctx.prisma, 2006);
    await ctx.http().patch(`/opportunities/${closed.id}`).send({ expectedVersion: closed.version, lossReasonCode: 'PRICE' }).expect(422);

    const open = await opportunityByNumber(ctx.prisma, 2003);
    const response = await ctx.http().patch(`/opportunities/${open.id}`).send({ expectedVersion: open.version, lossReasonCode: 'PRICE' }).expect(422);
    expect(response.body.errors[0].field).toBe('lossReasonCode');
  });

  it('não aceita validade de proposta anterior a hoje, ao editar nem ao mover', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    const response = await ctx.http().patch(`/opportunities/${opp.id}`).send({ expectedVersion: opp.version, proposalValidUntil: '2026-10-14' }).expect(422);
    expect(response.body.errors).toEqual([{ field: 'proposalValidUntil', message: 'A validade da proposta não pode ser anterior a hoje (15/10/2026).' }]);
    await ctx.http().patch(`/opportunities/${opp.id}`).send({ expectedVersion: opp.version, proposalValidUntil: '2026-10-15' }).expect(200);

    const lead = await opportunityByNumber(ctx.prisma, 2001);
    await ctx.http().patch(`/opportunities/${lead.id}/stage`).send({ to: 'APRESENTACAO_ORCAMENTO', expectedVersion: lead.version, proposalValidUntil: '2026-10-01' }).expect(422);
  });

  it('não aceita validade de proposta em Primeiro Contato nem corpo vazio', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2001);
    await ctx.http().patch(`/opportunities/${opp.id}`).send({ expectedVersion: opp.version, proposalValidUntil: '2026-10-30' }).expect(422);
    await ctx.http().patch(`/opportunities/${opp.id}`).send({ expectedVersion: opp.version }).expect(422);
  });

  it('responde 409 com versão desatualizada', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2003);
    await ctx.http().patch(`/opportunities/${opp.id}`).send({ expectedVersion: opp.version + 1, estimatedValue: 1 }).expect(409);
  });
});
