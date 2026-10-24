import { createTestApp, opportunityByNumber, resetDatabase, sellerByName, type TestApp } from './support/app.js';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
});

describe('itens de brinde', () => {
  it('lista, adiciona e remove itens, incrementando a versão', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    const added = await ctx.http().post(`/opportunities/${opp.id}/items`).send({ name: ' Caderno ', quantity: 120 }).expect(201);
    expect(added.body).toEqual({ id: expect.any(String), name: 'Caderno', quantity: 120 });

    const list = await ctx.http().get(`/opportunities/${opp.id}/items`).expect(200);
    expect(list.body).toHaveLength(2);

    await ctx.http().delete(`/opportunities/${opp.id}/items/${opp.items[0].id}`).expect(204);
    const after = await opportunityByNumber(ctx.prisma, 2002);
    expect(after.items.map((item) => item.name)).toEqual(['Caderno']);
    expect(after.version).toBe(opp.version + 2);
  });

  it('não remove o último item depois de Apresentação de Orçamento', async () => {
    for (const number of [2002, 2003, 2005]) {
      const opp = await opportunityByNumber(ctx.prisma, number);
      const response = await ctx.http().delete(`/opportunities/${opp.id}/items/${opp.items[0].id}`).expect(422);
      expect(response.body).toMatchObject({ statusCode: 422, message: 'A oportunidade precisa ter ao menos um item de brinde nesta etapa.', errors: [] });
      expect((await opportunityByNumber(ctx.prisma, number)).items).toHaveLength(1);
    }
  });

  it('permite remover o último item em Primeiro Contato', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2001);
    await ctx.http().delete(`/opportunities/${opp.id}/items/${opp.items[0].id}`).expect(204);
    expect((await opportunityByNumber(ctx.prisma, 2001)).items).toHaveLength(0);
  });

  it('não altera itens em etapa final', async () => {
    for (const number of [2006, 2007]) {
      const opp = await opportunityByNumber(ctx.prisma, number);
      await ctx.http().post(`/opportunities/${opp.id}/items`).send({ name: 'Extra', quantity: 1 }).expect(422);
      await ctx.http().delete(`/opportunities/${opp.id}/items/${opp.items[0].id}`).expect(422);
      expect((await opportunityByNumber(ctx.prisma, number)).items).toHaveLength(1);
    }
  });

  it('valida quantidade e nome e responde 404 para item de outra oportunidade', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    const other = await opportunityByNumber(ctx.prisma, 2003);
    const invalid = await ctx.http().post(`/opportunities/${opp.id}/items`).send({ name: '', quantity: 0 }).expect(400);
    expect(invalid.body.errors.map((error: { field: string }) => error.field).sort()).toEqual(['name', 'quantity']);
    await ctx.http().delete(`/opportunities/${opp.id}/items/${other.items[0].id}`).expect(404);
  });

  it('remoções simultâneas não deixam a oportunidade sem itens', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    await ctx.http().post(`/opportunities/${opp.id}/items`).send({ name: 'Segundo', quantity: 5 }).expect(201);
    const items = (await opportunityByNumber(ctx.prisma, 2002)).items;

    const responses = await Promise.all(items.map((item) => ctx.http().delete(`/opportunities/${opp.id}/items/${item.id}`)));
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([204, 422]);
    expect((await opportunityByNumber(ctx.prisma, 2002)).items).toHaveLength(1);
  });
});

describe('registro de contato', () => {
  it('registra contato de hoje, atualiza last_contact_at, aumenta a versão e remove o alerta de silêncio', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    const bruno = await sellerByName(ctx.prisma, 'Bruno');
    const response = await ctx.http().post(`/opportunities/${opp.id}/contacts`).send({ note: 'Ligação de retorno', sellerId: bruno.id }).expect(201);
    expect(response.body).toEqual({ id: expect.any(String), contactedAt: '2026-10-15', note: 'Ligação de retorno' });

    const row = await opportunityByNumber(ctx.prisma, 2002);
    expect(row.lastContactAt?.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(row.version).toBe(opp.version + 1);

    const detail = await ctx.http().get(`/opportunities/${opp.id}`).expect(200);
    expect(detail.body.lastContactAt).toBe('2026-10-15');
    expect(detail.body.attention.signals.map((signal: { code: string }) => signal.code)).not.toContain('NO_CONTACT');

    const contacts = await ctx.http().get(`/opportunities/${opp.id}/contacts`).expect(200);
    expect(contacts.body[0]).toMatchObject({ contactedAt: '2026-10-15', note: 'Ligação de retorno' });
  });

  it('contato retroativo não regride a data do último contato', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2005);
    await ctx.http().post(`/opportunities/${opp.id}/contacts`).send({ contactedAt: '2026-10-01' }).expect(201);
    const row = await opportunityByNumber(ctx.prisma, 2005);
    expect(row.lastContactAt?.toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('rejeita data futura e etapa final', async () => {
    const open = await opportunityByNumber(ctx.prisma, 2003);
    const future = await ctx.http().post(`/opportunities/${open.id}/contacts`).send({ contactedAt: '2026-10-16' }).expect(422);
    expect(future.body.message).toBe('A data do contato não pode estar no futuro.');

    const closed = await opportunityByNumber(ctx.prisma, 2006);
    await ctx.http().post(`/opportunities/${closed.id}/contacts`).send({}).expect(422);
  });
});
