import { createTestApp, resetDatabase, type TestApp } from './support/app.js';

const API_KEY = 'chave-de-teste-0123456789';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await createTestApp({ env: { API_KEY } });
  await resetDatabase(ctx.prisma);
});

afterAll(async () => {
  await ctx.close();
});

describe('chave de API (API_KEY definida)', () => {
  it('responde 401 sem a chave ou com a chave errada', async () => {
    const missing = await ctx.http().get('/opportunities').expect(401);
    expect(missing.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Chave de API ausente ou inválida. Envie o cabeçalho x-api-key.',
      errors: [],
    });

    await ctx.http().get('/opportunities').set('x-api-key', 'errada').expect(401);
    await ctx.http().get('/opportunities').set('x-api-key', `${API_KEY}x`).expect(401);
    await ctx.http().get('/catalogs').expect(401);
    await ctx.http().post('/followup-tasks/generate').expect(401);
  });

  it('responde 200 com a chave correta', async () => {
    const response = await ctx.http().get('/opportunities').set('x-api-key', API_KEY).expect(200);
    expect(response.body).toHaveLength(7);
    await ctx.http().get('/catalogs').set('x-api-key', API_KEY).expect(200);
  });

  it('mantém /health e /docs liberados', async () => {
    await ctx.http().get('/health').expect(200);
    await ctx.http().get('/docs').redirects(1).expect(200);
    await ctx.http().get('/docs-json').expect(200);
  });
});
