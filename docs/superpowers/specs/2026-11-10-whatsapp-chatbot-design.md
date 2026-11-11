# Chatbot de WhatsApp da Dynamo — Especificação

**Data:** 2026-11-10 · **Status:** aguardando revisão do João Victor

## 1. Objetivo

Um chatbot de WhatsApp que a Dynamo vende aos clientes, construído pela própria Dynamo, **sem plataforma intermediária** (nada de Z-API, Twilio, ManyChat etc.). Nesta fase ele:

1. responde no **estilo de fala do atendente humano do cliente**, aprendido de conversas exportadas e ajustável no painel;
2. **consulta planilhas** (Google Sheets) para responder preços, estoque, horários e afins sem inventar;
3. executa **automações**: registrar lead no CRM, passar para humano, avisar o responsável, disparar o n8n.

Ele também grava tokens e custo por mensagem, que alimentam a **simulação de custos para clientes** (próxima etapa, fora desta especificação).

**Sucesso desta fase:** o número da própria Dynamo (piloto) atende os leads do site pelo WhatsApp no tom do João Victor, responde com dados de uma planilha, registra os leads no CRM e passa conversas para humano. Tudo configurado pelo painel, com um segundo cliente podendo ser ligado sem mudar código.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Conexão | **WhatsApp Cloud API oficial da Meta, direto.** Número dedicado por cliente. Sem API não oficial. |
| Clientes | **Multiempresa desde o início**, tudo com `organization_id`. A Dynamo liga cada número manualmente (sem Embedded Signup nesta fase). |
| Piloto | Número da **própria Dynamo**, atendendo leads do site. |
| Estilo de fala | Conversas exportadas do WhatsApp → **guia de estilo editável + banco de exemplos reais** (só as falas do atendente, anonimizadas). |
| Planilhas | **Google Sheets compartilhado com uma conta de serviço da Dynamo, só leitura**, copiado para o banco a cada 5 min ou sob demanda; o bot faz busca pontual, nunca lê a planilha inteira. |
| Automações | **Ações prontas** (registrar lead, passar para humano, avisar responsável) **+ webhook para o n8n**. Cada empresa liga/desliga as suas. |
| IA | **Claude (Anthropic):** `claude-haiku-5-5` nas conversas, `claude-sonnet-5-5` para gerar o guia de estilo. Prompt caching nas instruções fixas de cada empresa. Modelo configurável por empresa. |
| Onde mora | **Serviço novo `apps/bot`** (Node, sem telas) em `bot.dynamo.business`; **telas no CRM** (seção Chatbot); mesmo Postgres. |

## 3. Arquitetura

```
Cliente final ──WhatsApp──▶ Meta ──webhook──▶ bot.dynamo.business (apps/bot)
                                              │ confere X-Hub-Signature-256
                                              │ grava a mensagem (único por wamid)
                                              │ responde 200 na hora
                                              ▼
                                      bot_job (fila no Postgres) ──▶ worker (mesmo processo)
                                              │ empresa ← phone_number_id que recebeu
                                              │ contexto: guia de estilo + exemplos parecidos
                                              │           + últimas mensagens da conversa
                                              │ Claude + ferramentas
                                              ▼
                                      envia pela Graph API, grava resposta, tokens e custo

app.dynamo.business (CRM) ── seção Chatbot: conversas, estilo, planilhas, automações, simulador
```

### Unidades de código

- **`packages/chatbot`**: o núcleo, sem dependência de HTTP. Usado pelo bot **e** pelo CRM (simulador e telas).
  - `db/schema.ts`: tabelas da seção 4 (reexportadas pelo schema do CRM, para haver **um único histórico de migrations**, gerado e aplicado pelo CRM como hoje).
  - `brain/`: monta o contexto e roda a conversa com o Claude e as ferramentas (`respond(orgId, conversationId) → Reply`).
  - `tools/`: `buscar_planilha`, `registrar_lead`, `passar_humano`, `avisar_responsavel`, `enviar_n8n`; cada uma recebe a empresa já resolvida.
  - `style/`: leitura das conversas exportadas (Android e iPhone, pt-BR), anonimização, extração de exemplos, geração do guia.
  - `sheets/`: sincronização Google Sheets → `sheet_row` e busca.
  - `whatsapp/`: cliente da Graph API (enviar texto, marcar como lida) e verificação de assinatura.
  - `crypto.ts`: cifra/decifra tokens com `CHATBOT_ENC_KEY` (AES-256-GCM).
- **`apps/bot`**: servidor HTTP mínimo (`GET /webhook` para a verificação da Meta, `POST /webhook` para mensagens, `GET /health`) e o worker da fila, num único processo. Também roda a sincronização periódica das planilhas.
- **`apps/crm`**: telas da seção Chatbot e server actions; lê e escreve as tabelas pelo núcleo, sempre com a empresa vinda de `getOrgContext()`.

## 4. Dados

Todas as tabelas têm `organization_id` (exceto `bot_job`, que referencia a empresa) e toda consulta filtra por ele.

| Tabela | Campos principais |
|---|---|
| `whatsapp_number` | `phone_number_id` (único), `waba_id`, `display_phone`, `access_token_enc`, `status` (`ativo` / `com_problema` / `desligado`) |
| `bot_config` (1 por empresa) | `enabled`, `style_guide` (texto), `extra_rules`, `model`, `actions` (jsonb: quais ligadas), `n8n_webhook_url`, `owner_phone`, `non_text_policy` (`pedir_texto` / `humano`), `handoff_hours` (padrão 12), `monthly_cap_brl`, `retention_months` (padrão 12), `debounce_seconds` (padrão 4) |
| `style_upload` | arquivo de origem (nome, data), `status`, contagem de exemplos |
| `style_example` | `customer_text`, `agent_text`, `search` (tsvector, `portuguese`), `upload_id` |
| `sheet_source` | `spreadsheet_id`, `tab`, `label`, `last_synced_at`, `last_error` |
| `sheet_row` | `source_id`, `data` (jsonb, cabeçalho → valor), `search` (tsvector) |
| `conversation` | `wa_id` (telefone do cliente final), `contact_name`, `mode` (`bot` / `humano`), `handoff_until`, `lead_id` (CRM), `last_customer_at` |
| `message` | `conversation_id`, `direction` (`in` / `out`), `author` (`cliente` / `bot` / `humano`), `wamid` (único), `type`, `text`, `input_tokens`, `cached_tokens`, `output_tokens`, `cost_usd`, `created_at` |
| `bot_job` | `kind` (`responder` / `sync_planilha` / `gerar_guia`), `payload`, `run_after`, `attempts`, `status`; pego com `FOR UPDATE SKIP LOCKED` |

## 5. Comportamento

### Conversa
1. Mensagem chega → grava → agenda `responder` para daqui a `debounce_seconds`. Novas mensagens da mesma conversa nesse intervalo empurram o horário; **uma conversa é processada por vez**.
2. Se `mode = humano` e `handoff_until` no futuro → não responde. Vencido o prazo, volta para `bot`.
3. Mensagem que não é texto → segue `non_text_policy`.
4. Contexto enviado ao Claude: instruções fixas da Dynamo (com cache), guia de estilo + regras extras da empresa (com cache), até 8 exemplos encontrados por busca de texto com a mensagem do cliente, últimas 20 mensagens da conversa.
5. **Regra fixa:** preço, estoque, horário e qualquer dado do negócio só podem vir de `buscar_planilha`; sem resultado, o bot diz que vai confirmar e chama `passar_humano`.
6. **Bot do negócio:** se apresenta como assistente virtual da empresa na primeira resposta e recusa assuntos fora do negócio (política da Meta contra assistentes de IA de uso geral).

### Ferramentas
- `buscar_planilha(consulta, planilha?)` → até 10 linhas da cópia local, por busca de texto.
- `registrar_lead(nome, interesse, etapa?)` → cria ou atualiza o lead no CRM (origem `whatsapp`) e liga à conversa.
- `passar_humano(motivo)` → `mode = humano`, `handoff_until = agora + handoff_hours`, avisa o responsável.
- `avisar_responsavel(mensagem)` → mensagem de WhatsApp para `owner_phone`.
- `enviar_n8n(evento, dados)` → POST no `n8n_webhook_url` com a empresa, a conversa e os dados.

Ferramentas desligadas na empresa não são oferecidas ao modelo.

### Estilo de fala
- Upload de `.txt` ou `.zip` exportado do WhatsApp; o painel pergunta qual nome no arquivo é o atendente.
- Pares "última fala do cliente → resposta do atendente" viram `style_example`, após **anonimização** (nomes de terceiros, telefones, e-mails, CPF/CNPJ, endereços com número → marcadores).
- `gerar_guia` envia uma amostra dos exemplos ao `claude-sonnet-5-5` e grava o resultado em `style_guide`; o painel mostra o texto para edição. Gerar de novo nunca apaga edições sem confirmação.

### Planilhas
- O cliente compartilha a planilha com o e-mail da conta de serviço (`GOOGLE_SERVICE_ACCOUNT_JSON`) como leitor.
- Sincroniza a cada 5 min e no botão **Atualizar agora**; troca as linhas de uma vez (transação), e falha mantém a cópia anterior com `last_error`.

### Erros e limites
- Claude indisponível ou lento → até 3 tentativas com espera crescente; depois envia "já te respondo" e chama `passar_humano`.
- Envio pela Meta falha por token/permissão → `whatsapp_number.status = com_problema`, aviso no painel; erros temporários tentam de novo.
- Gasto do mês da empresa (soma de `cost_usd` × `USD_BRL_RATE`, variável de ambiente, com valor padrão anotado no README) ≥ `monthly_cap_brl` → novas conversas vão para humano e o responsável é avisado. `cost_usd` usa os preços por modelo de uma tabela única no código (`pricing.ts`), conferidos na documentação oficial da Anthropic no momento da implementação.
- Resposta manual pelo painel só é permitida até 24 h após `last_customer_at` (regra da Meta).

## 6. Telas do CRM (seção Chatbot)

Para `owner` e `admin` da empresa:

1. **Visão geral:** ligado/desligado, conversas do dia, leads gerados, custo do mês e teto.
2. **Conversas:** lista, leitura, **Assumir**, **Devolver ao bot**, resposta manual (dentro das 24 h).
3. **Estilo:** upload, guia editável, exemplos (remover), **Gerar guia de novo**.
4. **Planilhas:** colar link, escolher aba, prévia, **Atualizar agora**, última sincronização.
5. **Automações:** liga/desliga cada ação, URL do n8n, telefone do responsável, política de não texto, prazo do modo humano, teto mensal.
6. **Simulador:** chat no painel com o mesmo `respond()`, sem WhatsApp; ações ficam em modo de teste (mostram o que fariam, não executam).

**Só a Dynamo** (chave `ADMIN_TOKEN`, na tela `/admin` existente) liga e desliga números de WhatsApp.

## 7. Segurança e LGPD

- `POST /webhook` rejeita requisições sem `X-Hub-Signature-256` válida (`META_APP_SECRET`).
- Tokens da Meta cifrados no banco; segredos só em variáveis do Easypanel.
- Isolamento entre empresas testado em cada consulta e ferramenta.
- Anonimização das conversas exportadas antes de gravar; o arquivo original não é guardado.
- Mensagens apagadas após `retention_months`; exclusão por titular (telefone) pelo painel da Dynamo.
- A API da Anthropic não usa os dados enviados para treinar modelos.

## 8. Testes

- **Unitários (Vitest):** parser das exportações (formatos Android e iPhone, mensagens de várias linhas, mídia omitida), anonimização, debounce e trava por conversa, regras de modo humano e de 24 h, teto mensal, cada ferramenta, busca em planilha, cálculo de custo.
- **Isolamento:** dados de uma empresa nunca aparecem para outra (núcleo e telas).
- **Webhook:** requisições assinadas válidas, inválidas e duplicadas (mesmo `wamid`).
- **Claude e Meta:** substituídos por versões falsas controladas nos testes automáticos; nenhum teste chama serviços reais.
- **Prova de qualidade por cliente:** lista de perguntas típicas rodada no simulador antes de ligar o número; o João Victor aprova.

## 9. Fora desta fase

Embedded Signup / Tech Provider; áudio e imagem; escrever em planilhas; construtor visual de fluxos; campanhas e disparos ativos (mensagens de modelo); cobrança dos clientes; aprendizado com correções do humano; busca semântica de exemplos; **a simulação de custos** (próxima etapa, usando os dados de `message`).

## 10. O que o João Victor providencia

1. App na **Meta for Developers** ligado ao Meta Business da Dynamo, com o produto WhatsApp, e um **usuário do sistema** com token permanente.
2. **Número de telefone dedicado** ao bot (sem WhatsApp ativo nele).
3. **Chave da API da Anthropic.**
4. **Projeto no Google Cloud** com a API do Sheets e uma conta de serviço (arquivo JSON).
5. DNS: `A bot` → `168.231.100.173`, e o serviço `bot` no Easypanel.

O passo a passo de cada item vai no README de deploy do bot.
