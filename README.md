# Nobre CRM API

API REST do CRM interno da Nobre Brindes. Guarda as oportunidades do funil de vendas, aplica as regras de negócio no servidor, registra o histórico de etapas e gera as tarefas de retorno dos vendedores. É a fonte única da verdade para o frontend (`nobre-crm-web`): regras, catálogos e alertas saem daqui.

**Tecnologias:** NestJS 12 (ESM), TypeScript, Prisma 7, PostgreSQL 16, class-validator, Swagger/OpenAPI, `@nestjs/schedule`, `@nestjs/throttler`, Helmet, Vitest + Supertest e Docker Compose.

**Neste README:** [Subir em 3 minutos](#subir-em-3-minutos) · [Experimente](#experimente-a-api) · [Problemas comuns](#problemas-comuns) · [Variáveis](#variáveis-de-ambiente) · [Comandos](#comandos) · [Estrutura](#estrutura) · [Endpoints](#endpoints) · [Regras do funil](#regras-do-funil-e-decisões) · [Automação](#automação-tarefas-de-retorno) · [Testes](#testes) · [Segurança](#como-protegeria-a-api-em-produção) · [Os outros 3 problemas](#os-outros-3-problemas-do-case-como-eu-resolveria) · [Limitações](#limitações)

## Subir em 3 minutos

Requisito: Docker (Docker Desktop no Windows). Não precisa instalar Node nem PostgreSQL para este caminho.

```
cp .env.example .env
docker compose --profile app up --build -d
docker compose --profile tools run --rm --build seed
```

O primeiro comando cria o `.env`. O segundo sobe o banco, aplica as migrations e inicia a API. O terceiro carrega os 7 registros do case. (Com Node instalado, `npm run docker:app` e `npm run docker:seed` fazem o mesmo.)

Confira:

| O quê | Onde |
|---|---|
| Saúde da API e do banco | http://localhost:3333/health |
| Documentação interativa (Swagger) | http://localhost:3333/docs |
| PostgreSQL (DBeaver etc.) | `localhost:5433`, usuário `nobre`, banco `nobre_crm` |

Para ver a tela, suba também o frontend: veja o README de `nobre-crm-web` (`npm install` e `npm run dev`, depois http://localhost:3000).

Para desligar: `docker compose --profile app --profile tools down` (os dados ficam guardados; acrescente `-v` para apagá-los).

### Modo desenvolvimento (API local com recarga automática)

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

## Estrutura

```
prisma/
  schema.prisma             modelos e enums
  migrations/               SQL versionado (tabelas, regras de integridade, catálogo de motivos, nível das tarefas)
  seed-data.ts              dados do case (reutilizado pelos testes)
  seed.ts                   executa o seed
src/
  main.ts                   sobe a aplicação
  app.setup.ts              Helmet, CORS, validação, filtro de erros, x-request-id e Swagger (usado por main.ts e pelos testes)
  config/                   validação das variáveis de ambiente
  database/                 PrismaService (módulo global)
  common/
    auth/                   guard de chave de API e decorator @Public()
    clock/                  relógio injetável (APP_TODAY)
    filters/                filtro global que padroniza os erros
    health/                 GET /health
    http/                   x-request-id, logs de requisição, DTO de erro e ValidationPipe
  modules/
    catalogs/               etapas, transições, bloqueios e motivos de perda para o frontend
    sellers/                vendedores
    opportunities/          oportunidades, mover de etapa, regras de domínio
    opportunity-items/      itens de brinde da oportunidade
    stage-histories/        histórico de mudanças de etapa
    contact-logs/           contatos registrados com o cliente
    followup-tasks/         automação das tarefas de retorno
scripts/                    exportação do OpenAPI
test/                       testes de integração (*.e2e-spec.ts) e do contrato OpenAPI
openapi.json                contrato gerado (versionado)
```

Cada módulo segue o mesmo padrão: `module`, `controller` (HTTP), `service` (casos de uso), `repository` (únicas consultas ao Prisma) e `dto/` com `*-request.dto.ts` e `*-response.dto.ts`. As regras de negócio ficam em funções puras em `modules/opportunities/domain/`, sem dependência de Nest nem de banco.

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

## Regras do funil e decisões

Etapas: Primeiro Contato, Apresentação de Orçamento, Follow-up, Forecast e Fechamento, mais Perdida. Fechamento e Perdida são finais.

| De | Para |
|---|---|
| Primeiro Contato | Apresentação de Orçamento, Perdida |
| Apresentação de Orçamento | Follow-up, Perdida |
| Follow-up | Forecast, Apresentação de Orçamento, Perdida |
| Forecast | Fechamento, Follow-up, Perdida |
| Fechamento, Perdida | nenhuma |

- **Retornos permitidos:** Follow-up para Apresentação de Orçamento (o cliente pede revisão da proposta) e Forecast para Follow-up (a negociação reabre). Não se volta para Primeiro Contato, porque o lead já foi qualificado, nem se pula etapas.
- **Apresentação de Orçamento** exige valor estimado maior que zero e ao menos um item de brinde.
- **Fechamento** só a partir de Forecast.
- **Perdida** vale para qualquer etapa não final e exige um motivo ativo do catálogo.
- **Etapa final não se reabre:** para retomar, cria-se uma nova oportunidade.
- A validade da proposta só pode ser informada a partir de Apresentação de Orçamento.

As regras são validadas em três camadas, para que nenhuma delas dependa da tela:

1. **DTOs** (class-validator): formato e tipos da entrada, com mensagens em português.
2. **Domínio** (`stage-rules.ts`): transições, campos obrigatórios e motivo de perda, com respostas `422` que listam cada violação.
3. **Banco** (migrations): `CHECK` de valores, Perdida exige `loss_reason_code`, motivo e observação só em Perdida, valor exigido nas etapas de orçamento e chave estrangeira para o catálogo; gatilhos que repetem a matriz de transições, impedem sair de etapa final e exigem ao menos um item nas etapas de orçamento.

**Consistência.** Mover de etapa, editar, mexer em itens e registrar contato rodam em transação e travam a linha da oportunidade (`SELECT ... FOR UPDATE`). Mover e editar conferem a `version` enviada pelo cliente (`409` se estiver desatualizada) e gravam o histórico (de, para, quando e motivo). Itens e contatos também incrementam a `version`. Dois vendedores movendo a mesma oportunidade nunca geram histórico duplicado: o teste de integração dispara as duas requisições ao mesmo tempo e confere um `200`, um `409` e uma única linha nova.

**Campos em branco do case.** A OPP-2001 não tem validade de proposta (ainda não há proposta): isso não é erro; o alerta só aparece a partir de Apresentação de Orçamento. A OPP-2007 está Perdida sem motivo: o seed registra `NOT_INFORMED` para respeitar a regra, e o motivo pode ser completado depois.

**Relógio.** A data de referência do case (15/10/2026) vem da variável `APP_TODAY`. Sem ela, a API usa a data atual no fuso de São Paulo.

## Automação: tarefas de retorno

Escolhi o problema 4 (retorno esquecido). A regra `evaluateAttention` aponta o que exige atenção, e `FollowupTasksService.generate()` transforma isso em tarefas por vendedor:

- roda todo dia útil às 7h (`@Cron`, fuso de São Paulo) e também sob demanda em `POST /followup-tasks/generate`;
- é idempotente: não duplica tarefa aberta para o mesmo motivo da mesma oportunidade, nem quando duas execuções rodam juntas (índice único);
- grava o nível do alerta (`level`: `high` para agir hoje, `medium` para acompanhar) e atualiza o nível e o texto das tarefas abertas quando o alerta muda;
- dispensa sozinha a tarefa cujo motivo deixou de existir (por exemplo, depois de um contato registrado ou de a oportunidade ser fechada ou perdida).

Regras de atenção (ignoram etapas finais): proposta vencida (agir hoje); proposta que vence hoje ou em até 3 dias (acompanhar); sem contato há 5 dias (acompanhar) ou 7 dias (agir hoje); nenhum contato registrado; evento em até 7 dias e a oportunidade ainda fora de Forecast (3 dias em Forecast); evento já passado; validade de proposta posterior ao evento; proposta sem validade a partir de Apresentação de Orçamento.

## Segurança e operação

- **Helmet** com os cabeçalhos padrão (CSP compatível com o Swagger).
- **Limite de requisições** global por IP (`@nestjs/throttler`): 120 por minuto por padrão, configurável com `THROTTLE_LIMIT` e `THROTTLE_TTL_SECONDS`. `/health` fica fora do limite.
- **Chave de API opcional:** com `API_KEY` definida, as rotas exigem `x-api-key` (comparação em tempo constante). `/health` e `/docs` ficam sempre liberados; rotas públicas usam o decorator `@Public()`. O Swagger declara o esquema `api-key`.
- **CORS** restrito a `CORS_ORIGIN`, expondo `X-Total-Count` e `X-Request-Id`.
- **Correlação:** cada requisição recebe um `x-request-id` (reaproveitado quando o cliente envia um válido), devolvido no cabeçalho e presente no log de cada requisição e nos erros `5xx`.

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

## Como protegeria a API em produção

- Autenticação por OIDC/JWT (SSO do grupo), com autorização por papel: o vendedor enxerga e altera as próprias oportunidades; o gestor vê todas. A chave de API atual protege a integração entre serviços, não identifica usuários.
- HTTPS, CORS restrito às origens do frontend, Helmet e limite de requisições (já ativos), além de limite por usuário quando houver autenticação.
- Validação estrita de entrada (`whitelist` e `forbidNonWhitelisted`) e consultas parametrizadas pelo Prisma.
- Segredos em variáveis de ambiente ou em um gerenciador de segredos, nunca no repositório; usuário do banco com privilégio mínimo (sem DDL em runtime) e conexão por TLS.
- Logs com `x-request-id`, auditoria das mudanças de etapa (histórico), monitoramento pelo `/health` e backups do banco.

## Os outros 3 problemas do case: como eu resolveria

O problema 4 (retorno esquecido) está implementado. Os outros três ficam descritos abaixo, com a ideia de implementação sobre a estrutura que já existe.

### 1. SLA do primeiro contato

**Como resolveria.** O lead entra no CRM no instante em que chega (formulário do site, WhatsApp, telefone) e fica numa fila de "leads sem primeiro contato", com um relógio visível. Se o prazo do SLA estourar, o vendedor é avisado e, depois, o gestor.

**Ideia de implementação.**
- Endpoint público `POST /leads` (com chave de integração) que cria a oportunidade em Primeiro Contato e registra `created_at`. O primeiro registro em `contact_logs` fecha o SLA: `first_contact_at` é derivado dele, sem campo duplicado.
- Distribuição automática entre vendedores (rodízio ponderado pela carga atual de leads abertos).
- Tabela `sla_policies` (prazo por marca e por horário comercial) e um job a cada minuto no mesmo padrão do `@Cron` atual, idempotente: um alerta por lead e por nível (aviso ao vendedor no prazo, escalonamento ao gestor no dobro do prazo).
- Notificação por webhook (WhatsApp, Slack ou e-mail) atrás de uma interface, para trocar o canal sem mexer na regra.
- Métrica no painel: tempo até o primeiro contato (mediana e percentil 90) e porcentagem dentro do SLA, por vendedor.
- Testes: relógio injetável (`APP_TODAY` já existe) para provar os limites do prazo e a idempotência dos alertas.

### 2. Conhecer a empresa do lead

**Como resolveria.** Ao cadastrar o lead com CNPJ, o sistema busca os dados públicos da empresa e mostra uma ficha no card ("Sobre a empresa"), para o vendedor chegar na ligação já sabendo com quem fala.

**Ideia de implementação.**
- Tabela `companies` (CNPJ único, razão social, nome fantasia, CNAE principal, porte, situação cadastral, endereço, sócios, `enriched_at`) e `opportunities.company_id` opcional.
- Provedor público (BrasilAPI ou ReceitaWS) atrás de uma interface `CompanyLookup`, o que permite trocar o provedor ou usar um mock nos testes.
- Enriquecimento assíncrono, fora da requisição do vendedor: fila com tentativas e espera crescente, tratamento de limite de uso do provedor e cache com validade (por exemplo, 30 dias) para não consultar duas vezes o mesmo CNPJ.
- Sem CNPJ, o vendedor pode buscar por nome; a ficha mostra a origem e a data da consulta, e falhas aparecem como "dados indisponíveis", nunca como erro que bloqueie o cadastro.
- Pontos de atenção: LGPD (só dados públicos de pessoa jurídica) e dados de sócios exibidos apenas a quem precisa.

### 3. Informações da ligação acessíveis depois

**Como resolveria.** A ligação segue um roteiro; as respostas são digitadas num formulário guiado dentro do card, durante ou logo depois da conversa, e ficam pesquisáveis na linha do tempo da oportunidade.

**Ideia de implementação.**
- Tabelas `call_scripts` (roteiro versionado, com as perguntas: orçamento disponível, prazo do evento, público, quantidades, decisor, concorrentes consultados) e `call_notes` (oportunidade, versão do roteiro, respostas em `jsonb`, vendedor, data e hora).
- Aba "Ligações" na gaveta do card, com o formulário gerado a partir do roteiro, e cada ligação aparecendo também na linha do tempo do card.
- Respostas-chave promovem campos da própria oportunidade (valor estimado, data do evento, quantidade), com confirmação do vendedor, para alimentar os alertas que já existem.
- Busca por conteúdo das respostas (índice GIN no `jsonb`) para achar, por exemplo, "todos os leads que citaram a concorrente X".
- Evolução opcional: transcrição da chamada e resumo automático, sempre como rascunho que o vendedor revisa antes de salvar.

## Limitações

- Sem autenticação de usuário: o `sellerId` vem do cliente.
- O limite de requisições usa memória local; com várias instâncias, troque por um armazenamento compartilhado (Redis). Atrás de proxy, configure `trust proxy` para o IP real.
- A busca não ignora acentos (usa `ILIKE`); a extensão `unaccent` resolveria.
- A geração de tarefas lê todas as oportunidades abertas; em volume alto, vale processar em lotes.
- A matriz de transições existe no domínio e no gatilho do banco; ao alterá-la, os dois precisam mudar juntos.

## Uso de IA

Usei um assistente de IA como apoio de desenvolvimento nos dois projetos, para gerar e revisar código, escrever migrations e testes, conferir contraste e acessibilidade, e redigir parte da documentação.

As decisões de produto e de regra de negócio foram minhas: o funil e a matriz de transições (quais retornos de etapa fazem sentido e quais não), as regras de preenchimento por etapa, a escolha da automação (retorno esquecido), os critérios de atenção, o modelo de dados e a defesa das regras em três camadas (DTO, domínio e banco). Também defini o visual, a paleta e o comportamento da interface, e revisei o resultado, rodando a aplicação e os testes.

Para validar, os testes de integração rodam contra um PostgreSQL real, e os bugs que eles revelaram foram corrigidos no código.
