# Decisões, segurança e limitações

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

## Como protegeria a API em produção

- Autenticação por OIDC/JWT (SSO do grupo), com autorização por papel: o vendedor enxerga e altera as próprias oportunidades; o gestor vê todas. A chave de API atual protege a integração entre serviços, não identifica usuários.
- HTTPS, CORS restrito às origens do frontend, Helmet e limite de requisições (já ativos), além de limite por usuário quando houver autenticação.
- Validação estrita de entrada (`whitelist` e `forbidNonWhitelisted`) e consultas parametrizadas pelo Prisma.
- Segredos em variáveis de ambiente ou em um gerenciador de segredos, nunca no repositório; usuário do banco com privilégio mínimo (sem DDL em runtime) e conexão por TLS.
- Logs com `x-request-id`, auditoria das mudanças de etapa (histórico), monitoramento pelo `/health` e backups do banco.

## Limitações

- Sem autenticação de usuário: o `sellerId` vem do cliente.
- O limite de requisições usa memória local; com várias instâncias, troque por um armazenamento compartilhado (Redis). Atrás de proxy, configure `trust proxy` para o IP real.
- A busca não ignora acentos (usa `ILIKE`); a extensão `unaccent` resolveria.
- A geração de tarefas lê todas as oportunidades abertas; em volume alto, vale processar em lotes.
- A matriz de transições existe no domínio e no gatilho do banco; ao alterá-la, os dois precisam mudar juntos.
