import { createTestApp, resetDatabase, type TestApp } from './support/app.js';

let ctx: TestApp;

const STAGES = ['PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FECHAMENTO', 'PERDIDA'] as const;

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDatabase(ctx.prisma);
});

afterAll(async () => {
  await ctx.close();
});

describe('GET /catalogs', () => {
  it('devolve data de referência, etapas, transições, matriz de bloqueios e motivos de perda', async () => {
    const { body } = await ctx.http().get('/catalogs').expect(200);

    expect(body.today).toBe('2026-10-15');
    expect(body.stages.map((stage: { id: string }) => stage.id)).toEqual(STAGES);
    expect(body.stages.map((stage: { order: number }) => stage.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(body.stages.filter((stage: { final: boolean }) => stage.final).map((stage: { id: string }) => stage.id)).toEqual(['FECHAMENTO', 'PERDIDA']);
    expect(body.stages[1]).toEqual({
      id: 'APRESENTACAO_ORCAMENTO',
      label: 'Apresentação de Orçamento',
      order: 2,
      final: false,
      hint: 'Orçamento montado e enviado ao cliente. Exige valor estimado e ao menos um brinde.',
      requirement: 'Exige valor estimado e ao menos um brinde.',
    });
    expect(body.stages[0].requirement).toBeNull();

    expect(body.transitions).toEqual({
      PRIMEIRO_CONTATO: ['APRESENTACAO_ORCAMENTO', 'PERDIDA'],
      APRESENTACAO_ORCAMENTO: ['FOLLOW_UP', 'PERDIDA'],
      FOLLOW_UP: ['FORECAST', 'APRESENTACAO_ORCAMENTO', 'PERDIDA'],
      FORECAST: ['FECHAMENTO', 'FOLLOW_UP', 'PERDIDA'],
      FECHAMENTO: [],
      PERDIDA: [],
    });

    expect(body.lossReasons).toEqual([
      { code: 'PRICE', label: 'Preço acima do orçamento do cliente', active: true },
      { code: 'DEADLINE', label: 'Prazo de entrega inviável', active: true },
      { code: 'COMPETITOR', label: 'Escolheu outro fornecedor', active: true },
      { code: 'EVENT_CANCELLED', label: 'Evento cancelado ou adiado', active: true },
      { code: 'NO_RESPONSE', label: 'Sem resposta do cliente', active: true },
      { code: 'OTHER', label: 'Outro motivo', active: true },
      { code: 'NOT_INFORMED', label: 'Não informado (migração)', active: false },
    ]);
  });

  it('a matriz de bloqueios é 6x6 e coerente com as transições', async () => {
    const { body } = await ctx.http().get('/catalogs').expect(200);
    expect(Object.keys(body.blockedReasons)).toEqual([...STAGES]);
    for (const from of STAGES) {
      expect(Object.keys(body.blockedReasons[from])).toEqual([...STAGES]);
      for (const to of STAGES) {
        const reason = body.blockedReasons[from][to];
        const allowed = from === to || body.transitions[from].includes(to);
        expect(reason === null, `${from} -> ${to}`).toBe(allowed);
        if (!allowed) expect(typeof reason).toBe('string');
      }
    }
    expect(body.blockedReasons.FOLLOW_UP.PRIMEIRO_CONTATO).toMatch(/qualificado/);
    expect(body.blockedReasons.FOLLOW_UP.FECHAMENTO).toBe('Fechamento só é permitido a partir de Forecast.');
  });

  it('a matriz é a mesma que a API aplica ao mover e o que cada oportunidade expõe', async () => {
    const catalogs = (await ctx.http().get('/catalogs').expect(200)).body;
    const list = (await ctx.http().get('/opportunities').expect(200)).body;
    for (const opp of list) expect(opp.allowedTransitions).toEqual(catalogs.transitions[opp.stage]);

    const followUp = list.find((opp: { code: string }) => opp.code === 'OPP-2003');
    const rejected = await ctx
      .http()
      .patch(`/opportunities/${followUp.id}/stage`)
      .send({ to: 'FECHAMENTO', expectedVersion: followUp.version })
      .expect(422);
    expect(rejected.body.message).toBe(catalogs.blockedReasons.FOLLOW_UP.FECHAMENTO);
  });
});

describe('saúde, documentação e formato de erros', () => {
  it('GET /health verifica o banco', async () => {
    const response = await ctx.http().get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('GET /health responde 503 quando o banco cai', async () => {
    const broken = await createTestApp({
      override: (builder, { PrismaService }) =>
        builder.overrideProvider(PrismaService).useValue({ $queryRaw: () => Promise.reject(new Error('conexão recusada')) }),
    });
    try {
      const response = await broken.http().get('/health').expect(503);
      expect(response.body).toEqual({ status: 'error', database: 'down' });
    } finally {
      await broken.close();
    }
  });

  it('serve o Swagger e o documento OpenAPI com componentes de enum e a chave de API', async () => {
    const html = await ctx.http().get('/docs').redirects(1).expect(200);
    expect(html.text).toContain('swagger-ui');

    const { body } = await ctx.http().get('/docs-json').expect(200);
    expect(body.components.securitySchemes['api-key']).toEqual(expect.objectContaining({ type: 'apiKey', in: 'header', name: 'x-api-key' }));
    expect(body.components.schemas.Stage.enum).toEqual([...STAGES]);
    expect(body.components.schemas.FollowupTaskStatus.enum).toEqual(['OPEN', 'DONE', 'DISMISSED']);
    expect(body.components.schemas.CatalogsResponseDto).toBeDefined();
    expect(body.paths['/catalogs'].get.security).toEqual([{ 'api-key': [] }]);
    expect(body.paths['/health'].get.security).toBeUndefined();
  });

  it('gera e devolve x-request-id, reaproveitando o recebido quando válido', async () => {
    const generated = await ctx.http().get('/sellers').expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await ctx.http().get('/sellers').set('x-request-id', 'teste-123').expect(200);
    expect(echoed.headers['x-request-id']).toBe('teste-123');

    const unsafe = await ctx.http().get('/sellers').set('x-request-id', 'valor com espaço').expect(200);
    expect(unsafe.headers['x-request-id']).not.toBe('valor com espaço');
  });

  it('aplica cabeçalhos de segurança e expõe X-Total-Count via CORS', async () => {
    const response = await ctx.http().get('/opportunities').query({ pageSize: 1 }).set('Origin', 'http://localhost:3000').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-expose-headers']).toMatch(/X-Total-Count/);
  });

  it('usa o mesmo formato de erro para 400, 404 e JSON malformado', async () => {
    const notFound = await ctx.http().get('/rota-que-nao-existe').expect(404);
    expect(notFound.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Rota não encontrada.', errors: [] });

    const malformed = await ctx.http().post('/opportunities').set('Content-Type', 'application/json').send('{"company":').expect(400);
    expect(malformed.body).toEqual({ statusCode: 400, error: 'Bad Request', message: 'O corpo da requisição não é um JSON válido.', errors: [] });

    const invalid = await ctx.http().post('/opportunities').send({ sellerId: 'x' }).expect(400);
    expect(invalid.body.statusCode).toBe(400);
    expect(invalid.body.error).toBe('Bad Request');
    expect(invalid.body.message).toBe(invalid.body.errors[0].message);
    expect(invalid.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'company' })]));
  });

  it('GET /sellers lista os vendedores ativos', async () => {
    const response = await ctx.http().get('/sellers').expect(200);
    expect(response.body.map((seller: { name: string }) => seller.name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});
