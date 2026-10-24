# API: uso, rotas e configuração

## Modo desenvolvimento (API local com recarga automática)

Banco no Docker e API no seu computador:

```
cp .env.example .env
npm install
npm run docker:db
npm run db:deploy
npm run db:seed
npm run start:dev
```

Sem Docker, aponte `DATABASE_URL` para qualquer PostgreSQL 16 e pule o `docker:db`.

## Experimente a API

Com o seed carregado, no Git Bash ou em qualquer terminal com `curl`:

```
curl "localhost:3333/opportunities?search=OPP-2003"
curl localhost:3333/catalogs
curl -X POST localhost:3333/followup-tasks/generate
curl localhost:3333/followup-tasks
```

Para ver uma regra do funil agindo, pegue o `id` e a `version` de uma oportunidade da lista e tente mover a OPP-2001 (Primeiro Contato) direto para Fechamento:

```
curl -X PATCH localhost:3333/opportunities/<id>/stage -H "content-type: application/json" -d "{\"to\":\"FECHAMENTO\",\"expectedVersion\":1}"
```

A resposta é `422` com a mensagem "Fechamento só é permitido a partir de Forecast." Mover a OPP-2003 (Follow-up) para `FORECAST` funciona e grava uma linha em `GET /opportunities/<id>/history`. Todas as rotas estão no Swagger, com o botão "Try it out".

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `port is already allocated` ou erro ao subir o banco | Algo já usa a porta `5433`. Mude `POSTGRES_PORT` no `.env` (e a porta em `DATABASE_URL`) e suba de novo. |
| `Cannot find module ... generated/prisma` | Falta gerar o Prisma Client: `npm run db:generate`. |
| A tela mostra erro de CORS | Inclua a origem do frontend em `CORS_ORIGIN`, no `.env` da API. |
| Todas as rotas respondem `401` | `API_KEY` está definida: envie o cabeçalho `x-api-key` ou deixe a variável vazia. |
| `npm run test:e2e` apagou meus dados | Os testes apagam o banco apontado por `TEST_DATABASE_URL`. Use um banco exclusivo (`nobre_crm_test`), nunca o de desenvolvimento. |
| `429 Too Many Requests` | Limite de requisições por IP; ajuste `THROTTLE_LIMIT` e `THROTTLE_TTL_SECONDS`. |

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | obrigatória | conexão do PostgreSQL |
| `PORT` | `3333` | porta HTTP |
| `CORS_ORIGIN` | `http://localhost:3000` | origens permitidas, separadas por vírgula |
| `APP_TODAY` | data real (fuso de São Paulo) | fixa a data de referência (`AAAA-MM-DD`); o case usa `2026-10-15` |
| `API_KEY` | vazia | quando definida, todas as rotas exigem o cabeçalho `x-api-key` (exceto `/health` e `/docs`) |
| `THROTTLE_LIMIT` | `120` | requisições permitidas por IP na janela |
| `THROTTLE_TTL_SECONDS` | `60` | tamanho da janela do limite, em segundos |
| `TEST_DATABASE_URL` | vazia | banco usado pelos testes de integração (os dados dele são apagados) |
| `SHADOW_DATABASE_URL` | vazia | banco auxiliar do `prisma migrate diff --from-migrations` e do `migrate dev` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `nobre`, `change-me`, `nobre_crm` | criam o banco no Docker |
| `POSTGRES_PORT` | `5433` | porta do PostgreSQL no seu computador |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run docker:db` | sobe só o PostgreSQL |
| `npm run docker:app` | sobe banco, migrations e a API em containers |
| `npm run docker:seed` | carrega os 7 registros do case no banco do Docker |
| `npm run docker:down` | derruba os containers (os dados ficam no volume) |
| `npm run db:generate` | gera o Prisma Client em `src/generated` (necessário após `npm install`) |
| `npm run db:migrate` | cria uma nova migration a partir do `schema.prisma` (desenvolvimento) |
| `npm run db:deploy` | aplica as migrations pendentes |
| `npm run db:seed` | carrega os 7 registros do case (apaga os dados atuais) |
| `npm run db:reset` | recria o banco e reaplica migrations e seed |
| `npm test` | testes unitários das regras e verificação do `openapi.json` |
| `npm run test:e2e` | testes de integração contra PostgreSQL real |
| `npm run openapi:export` | compila e regrava o `openapi.json` |
| `npm run lint` | oxlint com regras type-aware |

## Endpoints

| Método e rota | Descrição |
|---|---|
| `GET /health` | verifica o banco (`SELECT 1`): `{ status, database }`, `503` se o banco cair |
| `GET /catalogs` | data de referência, etapas, transições, matriz de bloqueios e motivos de perda |
| `GET /sellers` | vendedores ativos |
| `GET /opportunities` | lista com `search`, `sellerId`, `stage`, `onlyAttention`, `page`, `pageSize`, `sort` e `order` |
| `GET /opportunities/:id` | detalhe |
| `POST /opportunities` | cria em Primeiro Contato |
| `PATCH /opportunities/:id` | edita valor, validade, data do evento ou completa o motivo de perda pendente |
| `PATCH /opportunities/:id/stage` | move de etapa (regras abaixo) |
| `GET /opportunities/:id/history` | histórico de etapas |
| `GET/POST/DELETE /opportunities/:id/items` | itens de brinde |
| `GET/POST /opportunities/:id/contacts` | contatos registrados |
| `GET /followup-tasks` | tarefas de retorno (`sellerId`, `status`, `dueUntil`), com `level` (`high` ou `medium`) |
| `POST /followup-tasks/generate` | executa a geração de tarefas sob demanda |
| `PATCH /followup-tasks/:id/done` | conclui uma tarefa |

Cada oportunidade sai com `attention` (nível e sinais), `allowedTransitions`, `lossReason` (`{ code, label }` ou `null`), `lossNote` e `lossReasonPending`, para o frontend apenas exibir.

**Listagem.** Sem `page` nem `pageSize`, a resposta é a lista completa (contrato original). Com qualquer um deles, a lista é paginada (padrão de 20 itens, máximo 100) e o cabeçalho `X-Total-Count` traz o total do filtro. `sort` aceita `number` (padrão), `company`, `eventDate` e `estimatedValue`; `order` aceita `asc` (padrão) ou `desc`, com valores vazios sempre no fim. `onlyAttention=true` filtra depois de calcular a atenção, e a paginação vale sobre o resultado filtrado.

## Catálogos

`GET /catalogs` entrega ao frontend tudo o que antes ficava duplicado na tela:

```json
{
  "today": "2026-10-15",
  "stages": [
    { "id": "APRESENTACAO_ORCAMENTO", "label": "Apresentação de Orçamento", "order": 2, "final": false,
      "hint": "Orçamento montado e enviado ao cliente. Exige valor estimado e ao menos um brinde.",
      "requirement": "Exige valor estimado e ao menos um brinde." }
  ],
  "transitions": { "FOLLOW_UP": ["FORECAST", "APRESENTACAO_ORCAMENTO", "PERDIDA"] },
  "blockedReasons": { "FOLLOW_UP": { "FECHAMENTO": "Fechamento só é permitido a partir de Forecast.", "FORECAST": null } },
  "lossReasons": [
    { "code": "PRICE", "label": "Preço acima do orçamento do cliente", "active": true },
    { "code": "NOT_INFORMED", "label": "Não informado (migração)", "active": false }
  ]
}
```

- `transitions` e `blockedReasons` saem da mesma matriz (`TRANSITIONS` e `blockedReason` do domínio) que a API aplica ao mover; a matriz de bloqueios é 6x6, com `null` quando a transição é permitida ou origem e destino são iguais.
- `lossReasons` vem da tabela `loss_reasons`, em ordem de exibição. Somente motivos ativos podem ser escolhidos; `NOT_INFORMED` existe apenas para dados migrados.

### Motivos de perda

O motivo deixou de ser texto livre: `opportunities.loss_reason_code` referencia `loss_reasons.code` e `loss_note` guarda um detalhe opcional. Códigos: `PRICE`, `DEADLINE`, `COMPETITOR`, `EVENT_CANCELLED`, `NO_RESPONSE`, `OTHER` e `NOT_INFORMED` (inativo).

- Mover para Perdida exige `lossReasonCode` ativo (`lossNote` é opcional). O histórico grava `rótulo: observação`.
- A migration converteu os dados existentes: "Não informado (migração)" virou `NOT_INFORMED`; textos iguais a um rótulo do catálogo viraram o código correspondente; os demais viraram `OTHER`, com o texto preservado em `loss_note`.
- Uma oportunidade Perdida com `NOT_INFORMED` aparece com `lossReasonPending: true` e pode ser completada uma vez com `PATCH /opportunities/:id` (`lossReasonCode`, `lossNote`, `expectedVersion`).

## Formato de erro

Todos os erros têm o mesmo corpo:

```json
{ "statusCode": 422, "error": "Unprocessable Entity", "message": "Informe o motivo da perda.", "errors": [{ "field": "lossReasonCode", "message": "Informe o motivo da perda." }] }
```

- `400`: formato da entrada (DTOs), com cada campo inválido em `errors[]`.
- `401`: chave de API ausente ou inválida. `404`: recurso ou rota inexistente.
- `409`: `expectedVersion` desatualizada.
- `422`: regra de negócio, com cada violação em `errors[]`; também quando o banco recusa a operação por uma regra de integridade.
- `429`: limite de requisições. `503`: banco indisponível.

## Contrato OpenAPI

Os campos enum usam `enumName` (`Stage`, `FollowupTaskStatus`, `AttentionLevel`, `AttentionSignalLevel`, `AttentionCode`, `OpportunitySortField`, `SortDirection`), o que gera componentes reutilizáveis para geradores de tipos. `npm run openapi:export` compila a aplicação e grava `openapi.json` na raiz, sem conectar ao banco e com chaves ordenadas. `npm test` falha se o arquivo estiver desatualizado em relação ao código.

## Testes

`npm test` cobre a matriz completa de transições, os campos obrigatórios, o catálogo de motivos de perda, os limites de dias da regra de atenção, os 7 registros do case e o contrato OpenAPI.

`npm run test:e2e` sobe a aplicação Nest completa (mesma configuração do `main.ts`, via `app.setup.ts`) contra um PostgreSQL real: aplica as migrations com `prisma migrate deploy`, roda o seed e cobre listagem e filtros, paginação e ordenação, criação, mudanças de etapa com histórico, cada violação com `422` e `errors[]`, `409` de versão, concorrência (duas mudanças simultâneas: um `200`, um `409` e uma linha de histórico), regras de itens, registro de contato, geração idempotente de tarefas, violações diretas por SQL (gatilhos e `CHECK`), `/health`, `/catalogs`, limite de requisições e chave de API.

**Atenção:** os testes apagam e recriam os dados do banco de teste. Use um banco exclusivo.

Com Docker:

```
npm run docker:db
TEST_DATABASE_URL=postgresql://nobre:change-me@localhost:5433/nobre_crm_test?schema=public npm run test:e2e
```

Com qualquer PostgreSQL 16, basta definir `TEST_DATABASE_URL` (no ambiente ou no `.env`); o Prisma cria o banco se ele não existir. Sem `TEST_DATABASE_URL`, os testes usam `DATABASE_URL` somente se ela vier do ambiente (nunca a do `.env`), para não apagar o banco de desenvolvimento por engano.

Para conferir que as migrations e o `schema.prisma` estão alinhados:

```
SHADOW_DATABASE_URL=postgresql://... npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code
```
