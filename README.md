# Nobre CRM API

API do CRM de funil de vendas da Nobre Brindes. Faz par com o frontend [nobre-crm-web](https://github.com/jhowmael/nobre-crm-web).

Tecnologias: NestJS, TypeScript, Prisma, PostgreSQL 16 e Docker.

## O que ela faz

- Guarda as oportunidades de venda e as move pelo funil: Primeiro Contato, Apresentação de Orçamento, Follow-up, Forecast e Fechamento, mais Perdida.
- Aplica as regras do funil no servidor e no banco, nunca só na tela (por exemplo: Fechamento só a partir de Forecast, e Perdida exige motivo).
- Registra o histórico de cada mudança de etapa: de onde, para onde e quando.
- Gera todo dia as tarefas de retorno dos vendedores (proposta vencida, cliente sem contato, evento chegando).

## Como colocar no ar

**Você precisa de:** Docker (no Windows, o Docker Desktop aberto). Não precisa instalar Node nem PostgreSQL para este caminho.

Na pasta do projeto, rode os três comandos, um de cada vez:

```
cp .env.example .env
docker compose --profile app up --build -d
docker compose --profile tools run --rm --build seed
```

1. **`cp .env.example .env`** cria o arquivo de configuração com valores prontos para desenvolvimento. Não precisa editar nada.
2. **`docker compose --profile app up --build -d`** constrói e inicia o banco de dados e a API. Na primeira vez leva alguns minutos, porque baixa as imagens e compila o projeto. As tabelas são criadas automaticamente.
3. **`docker compose --profile tools run --rm --build seed`** carrega os 7 registros de exemplo do case. Sem este passo, o funil abre vazio.

**Como saber que funcionou:** abra http://localhost:3333/health. A resposta deve ser `{"status":"ok","database":"up"}`.

| O quê | Endereço |
|---|---|
| API | http://localhost:3333 |
| Documentação interativa (Swagger) | http://localhost:3333/docs |
| Saúde da API e do banco | http://localhost:3333/health |
| PostgreSQL | `localhost:5433` (usuário `nobre`, banco `nobre_crm`) |

Para ver a interface, suba também o frontend (README do `nobre-crm-web`).

**Para desligar:** `docker compose --profile app --profile tools down`. Os dados ficam guardados; para apagá-los, acrescente `-v` ao final.

**Se algo der errado**

| Sintoma | O que fazer |
|---|---|
| Erro de porta ocupada ao subir o banco | Algum programa já usa a porta 5433. Troque `POSTGRES_PORT` no `.env` e rode o segundo comando de novo. |
| O primeiro comando não encontra o `.env.example` | Você não está na pasta do projeto (`nobre-crm-api`). |
| `docker` não é reconhecido, ou o Docker não responde | Abra o Docker Desktop, espere ele iniciar e tente de novo. |

Para desenvolver com a API rodando fora do Docker, veja [docs/api.md](docs/api.md).

## Estrutura

```
prisma/
  schema.prisma        tabelas e enums
  migrations/          SQL versionado (tabelas e regras de integridade no banco)
  seed-data.ts         os 7 registros do case
src/
  main.ts              sobe a aplicação
  config/ database/    variáveis de ambiente e conexão com o banco
  common/              segurança, erros, relógio e health
  modules/
    opportunities/     oportunidades, mover de etapa e regras do funil (domain/)
    opportunity-items/ itens de brinde
    stage-histories/   histórico de etapas
    contact-logs/      contatos com o cliente
    followup-tasks/    automação das tarefas de retorno
    catalogs/          etapas, transições e motivos de perda para o frontend
    sellers/           vendedores
test/                  testes unitários e de integração
openapi.json           contrato da API
```

Cada módulo tem `controller` (recebe as requisições HTTP), `service` (regras e casos de uso), `repository` (consultas ao banco) e `dto/` (formato de entrada e de saída).

## Testes

```
npm install
npm test                    # unitários: regras do funil e alertas, não precisam de banco
docker compose up -d db     # sobe o banco para os testes de integração
npm run test:e2e            # integração: usam o banco nobre_crm_test e apagam os dados dele
```

## Mais detalhes

- [docs/api.md](docs/api.md): rotas, exemplos, variáveis de ambiente, formato de erro e problemas comuns.
- [docs/decisoes.md](docs/decisoes.md): regras do funil, retornos de etapa, automação, segurança em produção e limitações.
- [docs/outros-problemas.md](docs/outros-problemas.md): como eu resolveria os outros 3 problemas do case.

## Uso de IA

Usei um assistente de IA como apoio de desenvolvimento nos dois projetos, para gerar e revisar código, escrever migrations e testes, conferir contraste e acessibilidade, e redigir parte da documentação.

As decisões de produto e de regra de negócio foram minhas: o funil e a matriz de transições, as regras de preenchimento por etapa, a escolha da automação (retorno esquecido), os critérios de atenção, o modelo de dados e a defesa das regras em três camadas (DTO, domínio e banco). Também defini o visual e o comportamento da interface, e revisei o resultado rodando a aplicação e os testes.
