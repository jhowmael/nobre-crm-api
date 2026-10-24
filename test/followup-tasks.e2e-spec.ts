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

interface TaskBody {
  id: string;
  opportunityCode: string;
  reasonKey: string;
  level: string;
  status: string;
  dueDate: string;
  reason: string;
}

const summary = (tasks: TaskBody[]) =>
  tasks.map((task) => `${task.opportunityCode}:${task.reasonKey}:${task.level}`).sort();

describe('tarefas de retorno', () => {
  it('gera as tarefas das três oportunidades do case (OPP-2002, 2003 e 2004) com o nível do alerta', async () => {
    const generated = await ctx.http().post('/followup-tasks/generate').expect(200);
    expect(generated.body).toEqual({ created: 6, dismissed: 0 });

    const list = await ctx.http().get('/followup-tasks').expect(200);
    expect(summary(list.body)).toEqual([
      'OPP-2002:NO_CONTACT:high',
      'OPP-2002:PROPOSAL_EXPIRED:high',
      'OPP-2003:EVENT_NEAR:high',
      'OPP-2003:PROPOSAL_AFTER_EVENT:medium',
      'OPP-2004:NO_CONTACT:high',
      'OPP-2004:PROPOSAL_EXPIRED:high',
    ]);
    for (const task of list.body as TaskBody[]) {
      expect(task).toMatchObject({ status: 'OPEN', dueDate: '2026-10-15' });
      expect(task.reason).toBeTruthy();
    }
    expect(list.body.at(-1).level).toBe('medium');

    const rows = await ctx.prisma.followupTask.findMany({ select: { level: true } });
    expect(rows.filter((row) => row.level === 'high')).toHaveLength(5);
  });

  it('é idempotente: a segunda execução não cria nada', async () => {
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const second = await ctx.http().post('/followup-tasks/generate').expect(200);
    expect(second.body).toEqual({ created: 0, dismissed: 0 });
    expect(await ctx.prisma.followupTask.count()).toBe(6);
  });

  it('execuções simultâneas não duplicam tarefas', async () => {
    const responses = await Promise.all([ctx.http().post('/followup-tasks/generate'), ctx.http().post('/followup-tasks/generate')]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await ctx.prisma.followupTask.count()).toBe(6);
  });

  it('dispensa sozinha a tarefa cujo motivo sumiu depois de registrar contato', async () => {
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const opp = await opportunityByNumber(ctx.prisma, 2002);
    await ctx.http().post(`/opportunities/${opp.id}/contacts`).send({ note: 'Cliente respondeu' }).expect(201);

    const after = await ctx.http().post('/followup-tasks/generate').expect(200);
    expect(after.body).toEqual({ created: 0, dismissed: 1 });

    const dismissed = await ctx.http().get('/followup-tasks').query({ status: 'DISMISSED' }).expect(200);
    expect(summary(dismissed.body)).toEqual(['OPP-2002:NO_CONTACT:high']);

    const open = await ctx.http().get('/followup-tasks').expect(200);
    expect(open.body).toHaveLength(5);
  });

  it('dispensa as tarefas de uma oportunidade que foi perdida', async () => {
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const opp = await opportunityByNumber(ctx.prisma, 2004);
    await ctx.http().patch(`/opportunities/${opp.id}/stage`).send({ to: 'PERDIDA', lossReasonCode: 'NO_RESPONSE', expectedVersion: opp.version }).expect(200);

    const after = await ctx.http().post('/followup-tasks/generate').expect(200);
    expect(after.body).toEqual({ created: 0, dismissed: 2 });
  });

  it('filtra por vendedor e conclui tarefas uma única vez', async () => {
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const ana = await sellerByName(ctx.prisma, 'Ana');
    const mine = await ctx.http().get('/followup-tasks').query({ sellerId: ana.id }).expect(200);
    expect(summary(mine.body)).toEqual(['OPP-2003:EVENT_NEAR:high', 'OPP-2003:PROPOSAL_AFTER_EVENT:medium']);

    const done = await ctx.http().patch(`/followup-tasks/${mine.body[0].id}/done`).expect(200);
    expect(done.body).toMatchObject({ status: 'DONE', level: 'high' });
    const again = await ctx.http().patch(`/followup-tasks/${mine.body[0].id}/done`).expect(422);
    expect(again.body.message).toBe('A tarefa já foi encerrada.');

    const regenerated = await ctx.http().post('/followup-tasks/generate').expect(200);
    expect(regenerated.body).toEqual({ created: 0, dismissed: 0 });

    await ctx.http().patch('/followup-tasks/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/done').expect(404);
  });

  it('atualiza o nível de uma tarefa aberta quando o alerta se agrava', async () => {
    const opp = await opportunityByNumber(ctx.prisma, 2003);
    await ctx.prisma.opportunity.update({ where: { id: opp.id }, data: { lastContactAt: new Date('2026-10-10T00:00:00.000Z') } });
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const medium = await ctx.prisma.followupTask.findFirstOrThrow({ where: { opportunityId: opp.id, reasonKey: 'NO_CONTACT' } });
    expect(medium.level).toBe('medium');

    await ctx.prisma.opportunity.update({ where: { id: opp.id }, data: { lastContactAt: new Date('2026-10-07T00:00:00.000Z') } });
    await ctx.http().post('/followup-tasks/generate').expect(200);
    const high = await ctx.prisma.followupTask.findUniqueOrThrow({ where: { id: medium.id } });
    expect(high).toMatchObject({ level: 'high', reason: 'Sem contato há 8 dias', status: 'OPEN' });
  });
});
