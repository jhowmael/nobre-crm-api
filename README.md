# Nobre CRM API

API do CRM de funil de vendas da Nobre Brindes. Guarda as oportunidades, aplica as regras do funil no servidor, registra o histórico de etapas e gera as tarefas de retorno dos vendedores. Faz par com o frontend [nobre-crm-web](https://github.com/jhowmael/nobre-crm-web).

Tecnologias: NestJS, TypeScript, Prisma, PostgreSQL 16 e Docker.

## Como colocar no ar

Precisa só de Docker.

```
cp .env.example .env
docker compose --profile app up --build -d
docker compose --profile tools run --rm --build seed
```

| O quê | Onde |
|---|---|
| API | http://localhost:3333 |
| Documentação (Swagger) | http://localhost:3333/docs |
| Saúde da API e do banco | http://localhost:3333/health |
| PostgreSQL | `localhost:5433` (usuário `nobre`, banco `nobre_crm`) |

Depois suba o frontend (veja o README do `nobre-crm-web`). Para desligar: `docker compose --profile app --profile tools down`.

## Estrutura

```
prisma/
  schema.prisma       tabelas e enums
  migrations/         SQL versionado (tabelas e regras de integridade no banco)
  seed-data.ts        os 7 registros do case
src/
  main.ts             sobe a aplicação
  config/ database/   variáveis de ambiente e conexão com o banco
  common/             segurança, erros, relógio, health
  modules/
    opportunities/    oportunidades, mover de etapa e regras do funil (domain/)
    opportunity-items/ itens de brinde
    stage-histories/  histórico de etapas
    contact-logs/     contatos com o cliente
    followup-tasks/   automação das tarefas de retorno
    catalogs/         etapas, transições e motivos de perda para o frontend
    sellers/          vendedores
test/                 testes de integração
openapi.json          contrato da API
```

Cada módulo tem `controller` (HTTP), `service` (casos de uso), `repository` (consultas ao banco) e `dto/` (entrada e saída).

## Testes

```
npm install
npm test                    # unitários, não precisam de banco
docker compose up -d db     # para os de integração
npm run test:e2e            # usam o banco nobre_crm_test e apagam os dados dele
```

## Mais detalhes

- [docs/api.md](docs/api.md): rotas, exemplos, variáveis de ambiente, erros e problemas comuns.
- [docs/decisoes.md](docs/decisoes.md): regras do funil, retornos de etapa, automação, segurança em produção e limitações.
- [docs/outros-problemas.md](docs/outros-problemas.md): como eu resolveria os outros 3 problemas do case.

## Uso de IA

Usei um assistente de IA como apoio de desenvolvimento nos dois projetos, para gerar e revisar código, escrever migrations e testes, conferir contraste e acessibilidade, e redigir parte da documentação.

As decisões de produto e de regra de negócio foram minhas: o funil e a matriz de transições, as regras de preenchimento por etapa, a escolha da automação (retorno esquecido), os critérios de atenção, o modelo de dados e a defesa das regras em três camadas (DTO, domínio e banco). Também defini o visual e o comportamento da interface, e revisei o resultado rodando a aplicação e os testes.
