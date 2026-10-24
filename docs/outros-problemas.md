# Os outros 3 problemas do case: como eu resolveria

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
