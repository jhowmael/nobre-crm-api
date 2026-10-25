# Nobre CRM API

API do CRM de funil de vendas da Nobre Brindes. Faz par com o frontend [nobre-crm-web](https://github.com/jhowmael/nobre-crm-web).

Tecnologias: NestJS, TypeScript, Prisma, PostgreSQL 16 e Docker.

## O que ela faz

- Guarda as oportunidades de venda e as move pelo funil: Primeiro Contato, Apresentação de Orçamento, Follow-up, Forecast e Fechamento, mais Perdida.
- Aplica as regras do funil no servidor e no banco, nunca só na tela (por exemplo: Fechamento só a partir de Forecast, e Perdida exige motivo).
- Registra o histórico de cada mudança de etapa: de onde, para onde e quando.
- Gera nos dias úteis, às 7h, as tarefas de retorno dos vendedores (proposta vencida, cliente sem contato, evento chegando).

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

Para desenvolver com a API fora do Docker (recarga automática), deixando só o banco no Docker:

```
npm install
npm run db:generate
npm run docker:db
npm run db:deploy
npm run db:seed
npm run start:dev
```

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
npm run db:generate         # gera o client do Prisma, que não vai para o Git
npm test                    # unitários: regras do funil e alertas, não precisam de banco
docker compose up -d db     # sobe o banco para os testes de integração
npm run test:e2e            # integração: usam o banco nobre_crm_test e apagam os dados dele
```

## Regras do funil

| De | Para |
|---|---|
| Primeiro Contato | Apresentação de Orçamento, Perdida |
| Apresentação de Orçamento | Follow-up, Perdida |
| Follow-up | Forecast, Apresentação de Orçamento, Perdida |
| Forecast | Fechamento, Follow-up, Perdida |
| Fechamento, Perdida | nenhuma (etapas finais) |

- Apresentação de Orçamento exige valor estimado e ao menos um item de brinde. Fechamento só a partir de Forecast. Perdida vale para qualquer etapa não final e exige um motivo do catálogo.
- Retornos: só Follow-up → Apresentação de Orçamento (o cliente pediu revisão da proposta) e Forecast → Follow-up (a negociação reabriu). Nada volta para Primeiro Contato, porque o lead já foi qualificado, e etapa final não reabre: para retomar, cria-se outra oportunidade.
- As regras são checadas no DTO, no domínio (`stage-rules.ts`) e no banco, com `CHECK` e gatilhos que repetem a matriz. Mover e editar rodam em transação, travam a linha da oportunidade e conferem a `version` enviada pelo cliente (`409` se estiver desatualizada). Cada mudança de etapa grava o histórico: de onde, para onde e quando.
- Campos em branco do case: a OPP-2001 está sem validade porque ainda não tem proposta, e isso não gera alerta em Primeiro Contato. A OPP-2007 está Perdida sem motivo; o seed grava `NOT_INFORMED`, e o motivo pode ser completado uma vez depois. O case também não traz as datas de mudança de etapa, então o seed monta o histórico a partir de 28/09, uma etapa a cada 2 dias.
- A data de referência do case (15/10/2026) vem de `APP_TODAY`. Sem ela, vale a data atual no fuso de São Paulo.

## Automação: tarefas de retorno

Escolhi o problema 4 (retorno esquecido) porque ele usa só dados que o case já traz e não depende de integração externa. Na data de referência ele já aponta 3 das 5 oportunidades abertas (R$ 20.900 em negociação), e é o risco que o próprio enunciado destaca: a proposta esquecida na gaveta.

Nos dias úteis, às 7h (horário de Brasília), e sob demanda em `POST /followup-tasks/generate`, a API cria uma tarefa para cada alerta das oportunidades abertas. Ela não duplica tarefa aberta, atualiza o nível quando o alerta muda e dispensa a tarefa cujo motivo sumiu (contato registrado, oportunidade fechada ou perdida).

Os alertas: proposta vencida (agir hoje); proposta que vence hoje ou em até 3 dias (acompanhar); sem contato há 5 dias (acompanhar) ou 7 (agir hoje); nenhum contato registrado; evento em até 7 dias, ou 3 se já estiver em Forecast; evento que já passou; validade da proposta depois do evento; proposta sem validade a partir de Apresentação de Orçamento.

## Segurança e produção

Já está ativo: Helmet, limite de 120 requisições por minuto por IP (configurável), CORS restrito a `CORS_ORIGIN`, `x-request-id` em cada requisição e chave de API opcional (`API_KEY`, enviada no cabeçalho `x-api-key`). As credenciais ficam só no `.env`, que não vai para o Git.

Em produção eu acrescentaria:

- login pelo SSO do grupo (OIDC/JWT), com papéis: o vendedor mexe nas próprias oportunidades e o gestor vê todas;
- HTTPS e limite de requisições por usuário;
- segredos num cofre, usuário do banco sem permissão de DDL e conexão por TLS;
- logs com o `x-request-id`, monitoramento pelo `/health` e backup do banco.

## Limitações

- Não há autenticação de usuário: o `sellerId` vem do cliente.
- O limite de requisições fica em memória. Com mais de uma instância, precisaria de um armazenamento compartilhado, como Redis.
- A busca não ignora acentos: "clinica" não acha "Clínica".
- As tarefas só aparecem na tela. Não há aviso por e-mail ou WhatsApp.
- A matriz de transições existe no código e no gatilho do banco; mudar uma exige mudar a outra.

## Os outros 3 problemas

1. **SLA do primeiro contato.** O lead entra direto no CRM (formulário do site, WhatsApp) numa fila de "sem primeiro contato", com o prazo à vista. Se o prazo estourar, o vendedor é avisado e depois o gestor. Implementação: `POST /leads`, distribuição em rodízio e um job no mesmo padrão do `@Cron` das tarefas de retorno.
2. **Conhecer a empresa do lead.** Com o CNPJ, a API busca os dados públicos da empresa em segundo plano e mostra uma ficha no card. Implementação: tabela `companies`, consulta à BrasilAPI ou ReceitaWS por fila, com novas tentativas e cache de 30 dias.
3. **Informações da ligação.** O roteiro vira um formulário na gaveta do card, preenchido durante ou logo depois da ligação, e as respostas ficam na linha do tempo e pesquisáveis. Implementação: roteiro versionado em `call_scripts` e respostas em `call_notes` (`jsonb`).

## Uso de IA

Usei um assistente de IA como apoio de desenvolvimento nos dois projetos, para gerar e revisar código, escrever migrations e testes, conferir contraste e acessibilidade, e redigir parte da documentação.

As decisões de produto e de regra de negócio foram minhas: o funil e a matriz de transições, as regras de preenchimento por etapa, a escolha da automação (retorno esquecido), os critérios de atenção, o modelo de dados e a defesa das regras em três camadas (DTO, domínio e banco). Também defini o visual e o comportamento da interface, e revisei o resultado rodando a aplicação e os testes.
