# Chatbot de WhatsApp — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chatbot de WhatsApp multiempresa da Dynamo (Cloud API oficial, Claude, estilo de fala aprendido, consulta a Google Sheets, automações), com telas no CRM e serviço próprio em `bot.dynamo.business`.

**Architecture:** O esquema do banco sai do CRM para `packages/db` (compartilhado). O núcleo do bot fica em `packages/chatbot` (sem HTTP; todas as dependências externas injetáveis). `apps/bot` é um processo Node com webhook, worker da fila (Postgres, `SKIP LOCKED`) e tarefas periódicas. O CRM ganha a seção Chatbot, que usa o mesmo núcleo.

**Tech Stack:** TypeScript, Drizzle 0.45 + Postgres 16 (PGlite nos testes), `@anthropic-ai/sdk`, Graph API da Meta via `fetch`, `google-auth-library` + Sheets REST, `fflate`, Vitest 3, Next 16.4.5 (CRM), esbuild (bundle do bot), Docker.

**Spec:** `docs/superpowers/specs/2026-11-10-whatsapp-chatbot-design.md`

## Global Constraints

- Toda tabela nova tem `organization_id` (FK `organization.id`, `on delete cascade`); toda função do núcleo recebe `organizationId` já validado e filtra por ele.
- Modelos: conversa `claude-haiku-5-5` com `output_config: { effort: "low" }`; guia de estilo `claude-sonnet-5-5` com `output_config: { effort: "medium" }`. Sem `thinking: {type:"disabled"}`, sem `budget_tokens`, sem `temperature`, sem `tool_choice` forçado, sem prefill. Sempre devolver `response.content` inteiro no laço de ferramentas.
- Preços (USD por 1M tokens, conferidos na skill claude-api em 2026-11-10): Haiku 5.5 entrada 0.10 / saída 0.50 / leitura de cache 0.01 / escrita de cache 0.125; Sonnet 5.5 entrada 2.00 / saída 10.00 / leitura de cache 0.20 / escrita de cache 2.50. Ficam só em `packages/chatbot/src/pricing.ts`.
- Padrões de `bot_config`: `debounce_seconds` 4, `handoff_hours` 12, `retention_months` 12, `non_text_policy` `pedir_texto`, `monthly_cap_brl` 300, `enabled` false. Exemplos de estilo por resposta: até 8. Histórico enviado: últimas 20 mensagens. Linhas de planilha por busca: até 10. Sincronização: a cada 5 min. Tentativas de job: 3 (espera 5 s, 30 s, 120 s). Laço de ferramentas: no máximo 6 voltas.
- Textos fixos (exatos):
  - `MSG_NAO_TEXTO = "Por aqui eu leio só mensagens de texto. Pode me escrever?"`
  - `MSG_JA_RESPONDO = "Recebi sua mensagem! Já te respondo."`
- Variáveis de ambiente do bot: `DATABASE_URL`, `DATABASE_SSL`, `ANTHROPIC_API_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_VERSION` (padrão `v24.0`), `CHATBOT_ENC_KEY` (32 bytes em base64), `GOOGLE_SERVICE_ACCOUNT_JSON`, `USD_BRL_RATE` (padrão `5.50`), `PORT` (padrão 3001). O CRM ganha `CHATBOT_ENC_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `USD_BRL_RATE`.
- Nenhum teste chama Meta, Anthropic ou Google de verdade: tudo injetado.
- Mês de cobrança e "conversas de hoje" no fuso `America/Sao_Paulo`.
- Mensagens de commit em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca na `main`.

## Review Focus

1. **PGlite sem o dicionário `portuguese`** de busca de texto: o esquema usa `to_tsvector('portuguese', …)`; se o PGlite não tiver, os testes quebram de forma confusa. Teste explícito na Task 2.
2. **Exportações reais do WhatsApp** trazem `‎`/` `, ano com 2 dígitos, segundos opcionais, "às", linhas de sistema e mídia omitida em vários textos: o parser deve ignorar o que não é fala e não perder linhas de continuação. Fixtures na Task 4.
3. **Webhooks que não são mensagem** (só `statuses`), `phone_number_id` desconhecido, número desligado, bot desligado ou corpo inválido: responder 200 (exceto assinatura inválida → 401) e não criar job. Testes na Task 9.
4. **Rajada de mensagens durante uma resposta em andamento**: a nova mensagem vira um job pendente que roda depois, sem resposta duplicada nem perdida. Testes na Task 6.
5. **Ferramenta com entrada inválida, nome desconhecido ou que lança erro, e `stop_reason: "refusal"`**: o laço devolve `tool_result` com `is_error: true` e segue; recusa vira passagem para humano. Testes na Task 8.

---

### Task 1: Esquema compartilhado em `packages/db`

Move o esquema do CRM para um pacote, sem mudar nenhuma tabela.

**Files:**
- Create: `packages/db/package.json` (`@dynamo/db`, `type: module`, `main: ./src/index.ts`, exports `"."`, `"./schema"`, `"./testing"`; deps `drizzle-orm@^0.45.4`, `postgres@^4.1.0`; dev `@electric-sql/pglite`, `vitest@^3`, `typescript@^5`, `@types/node@^20`), `packages/db/tsconfig.json` (igual ao de `public-lead`)
- Move: `apps/crm/src/lib/db/schema.ts` → `packages/db/src/schema.ts`; `apps/crm/src/lib/db/auth-schema.ts` → `packages/db/src/auth-schema.ts`
- Create: `packages/db/src/index.ts`, `packages/db/src/stages.ts`
- Modify: `apps/crm/src/lib/db/index.ts`, `apps/crm/src/lib/db/schema.ts` (vira `export * from "@dynamo/db/schema"`), `apps/crm/src/lib/data/leads.ts` (usa `ensureStages` do pacote), `apps/crm/drizzle.config.ts` (`schema: "../../packages/db/src/schema.ts"`), `apps/crm/next.config.ts` (`transpilePackages` + `"@dynamo/db"`), `apps/crm/package.json` (dep `@dynamo/db: workspace:*`), `Dockerfile.crm` (copiar `packages/db/package.json` antes do install e `packages/db` antes do build)

**Interfaces:**
- Produces:
  - `type Db = PgDatabase<any, typeof schema>` e `createDb(url: string, opts?: { ssl?: false | "require"; max?: number }): Db` em `@dynamo/db`
  - `export * as schema` / `export * from "./schema"` em `@dynamo/db/schema`
  - `ensureStages(db: Db, organizationId: string): Promise<PipelineStage[]>` em `@dynamo/db` (mesmo comportamento do atual em `leads.ts`)

- [ ] **Step 1:** Mover os arquivos com `git mv` e criar o pacote. `apps/crm/src/lib/db/index.ts` passa a `export const db = createDb(connectionString, { ssl: dbSsl, max: 10 })` mantendo `dbSsl` e `schema` exportados como hoje.
- [ ] **Step 2:** `pnpm install` e rodar `pnpm --filter crm typecheck`. Expected: sem erros.
- [ ] **Step 3:** `cd apps/crm && pnpm drizzle-kit generate`. Expected: `No schema changes, nothing to migrate` (prova de que o esquema não mudou).
- [ ] **Step 4:** `pnpm --filter crm build`. Expected: build OK.
- [ ] **Step 5:** `docker build -f Dockerfile.crm -t dynamo-crm-test .`. Expected: imagem gerada.
- [ ] **Step 6:** Commit `refactor(db): esquema do banco em pacote compartilhado @dynamo/db`.

### Task 2: Tabelas do chatbot, migração e banco de teste

**Files:**
- Create: `packages/db/src/chatbot-schema.ts` (reexportado por `schema.ts`), `packages/db/src/testing.ts`, `packages/db/tests/chatbot-schema.test.ts`, `packages/db/vitest.config.ts`
- Generate: `apps/crm/drizzle/0001_*.sql` (via `drizzle-kit generate`)

**Interfaces:**
- Produces (tabelas e colunas como na seção 4 da spec, com estes acréscimos decididos aqui):
  - enums: `bot_number_status` (`ativo`,`com_problema`,`desligado`), `bot_non_text_policy` (`pedir_texto`,`humano`), `bot_conversation_mode` (`bot`,`humano`), `bot_message_direction` (`in`,`out`), `bot_message_author` (`cliente`,`bot`,`humano`), `bot_job_kind` (`responder`,`sync_planilha`,`gerar_guia`), `bot_job_status` (`pending`,`running`,`done`,`failed`)
  - `conversation.channel` text (`whatsapp` | `simulador` | `sistema`), único `(organization_id, channel, wa_id)`
  - `bot_config.model` (padrão `claude-haiku-5-5`), `bot_config.style_guide_draft` (proposta gerada, aguardando o dono aplicar), `bot_config.cap_notified_month` (texto `AAAA-MM` do último aviso de teto)
  - `message.cache_write_tokens` integer (além de `cached_tokens`), `message.cost_usd` numeric(12,6), `message.tool_calls` jsonb (nomes e entradas das ferramentas usadas)
  - `bot_job.organization_id`, `bot_job.conversation_id` (nullable), `bot_job.last_error`; índice único parcial `bot_job_pending_responder_uq` em `(conversation_id)` `where kind='responder' and status='pending'`
  - `style_example.search` e `sheet_row.search`: coluna `tsvector` gerada (`generatedAlwaysAs`) com `to_tsvector('portuguese', …)` e índice GIN
  - `whatsapp_number.phone_number_id` único global
  - `bot_config` com PK `organization_id`
- Produces em `@dynamo/db/testing`: `createTestDb(): Promise<{ db: Db; close(): Promise<void> }>` (PGlite em memória + `migrate` com `apps/crm/drizzle`), `seedOrg(db: Db, name: string): Promise<string>` (retorna o id)

- [ ] **Step 1: Teste que falha** — `packages/db/tests/chatbot-schema.test.ts`:
  - `it("has the portuguese text search config")`: `select to_tsvector('portuguese','bacalhaus gostosos')::text` contém `'bacalhau'`.
  - `it("generates searchable vectors for style examples")`: insere um `style_example` e encontra com `search @@ plainto_tsquery('portuguese','bacalhau')`.
  - `it("allows a single pending responder job per conversation")`: segundo insert pendente para a mesma conversa viola o índice; um `running` mais um `pending` é aceito.
  - `it("deletes chatbot rows with the organization")`: apaga a empresa → `conversation`, `message`, `bot_config` vazios.
- [ ] **Step 2:** `pnpm --filter @dynamo/db test`. Expected: FAIL (tabelas não existem).
- [ ] **Step 3:** Escrever `chatbot-schema.ts`, rodar `cd apps/crm && pnpm drizzle-kit generate --name chatbot`, conferir o SQL gerado (enums, GIN, índice parcial).
  Se o teste do dicionário `portuguese` falhar no PGlite, **Ruling** obrigatório: usar `'simple'` nos testes não é aceitável (diverge da produção); trocar o banco de teste por Postgres 16 em Docker (`postgres:16-alpine` na porta 54329, `createTestDb` cria um schema por teste) e registrar.
- [ ] **Step 4:** `pnpm --filter @dynamo/db test`. Expected: PASS 4/4.
- [ ] **Step 5:** `pnpm --filter crm typecheck`. Expected: OK.
- [ ] **Step 6:** Commit `feat(db): tabelas do chatbot`.

### Task 3: Núcleo — pacote, cifra, preços e cliente do WhatsApp

**Files:**
- Create: `packages/chatbot/package.json` (`@dynamo/chatbot`; deps `@dynamo/db`, `@anthropic-ai/sdk`, `drizzle-orm`, `zod`, `fflate`, `google-auth-library`; dev iguais aos do `db`), `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/env.ts`, `src/crypto.ts`, `src/pricing.ts`, `src/whatsapp/signature.ts`, `src/whatsapp/client.ts`, `src/whatsapp/webhook-payload.ts`
- Test: `packages/chatbot/tests/{crypto,pricing,whatsapp}.test.ts`

**Interfaces:**
- Produces:
  - `encrypt(plain: string, keyB64: string): string` / `decrypt(token: string, keyB64: string): string` (AES-256-GCM; formato `v1.<iv>.<tag>.<data>` em base64url)
  - `type ModelId = "claude-haiku-5-5" | "claude-sonnet-5-5"`; `costUsd(model: ModelId, usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number`
  - `verifySignature(rawBody: string, header: string | null, appSecret: string): boolean` (HMAC-SHA256, `sha256=<hex>`, comparação em tempo constante)
  - `parseWebhook(body: unknown): IncomingMessage[]` com `IncomingMessage = { phoneNumberId: string; waId: string; contactName: string | null; wamid: string; type: string; text: string | null; timestamp: Date }` (ignora `statuses`, tolera campos faltando)
  - `createWhatsAppClient(opts: { graphVersion: string; fetch?: typeof fetch }): { sendText(n: { phoneNumberId: string; accessToken: string }, to: string, body: string): Promise<{ wamid: string }>; markRead(n, wamid: string): Promise<void> }`; lança `WhatsAppAuthError` em 401/403 (e erro código 190) e `WhatsAppTemporaryError` em 429/5xx/rede. `sendText` divide textos acima de 4096 caracteres em várias mensagens, quebrando em parágrafo ou espaço.

- [ ] **Step 1: Testes que falham:**
  - crypto: ida e volta; token adulterado lança; chave errada lança.
  - pricing: `costUsd("claude-haiku-5-5", {input_tokens: 1_000_000, output_tokens: 0})` = `0.10`; 1M de saída Haiku = `0.50`; 1M de leitura de cache Sonnet = `0.20`; 1M de escrita de cache Haiku = `0.125`; campos `null` contam como 0.
  - signature: assinatura correta aceita; corpo alterado, header ausente ou sem prefixo `sha256=` recusados.
  - webhook-payload: fixture de texto → 1 mensagem com todos os campos; fixture só com `statuses` → `[]`; fixture de imagem → `type: "image"`, `text: null`; `{}` e `null` → `[]`.
  - client (fetch falso): URL `https://graph.facebook.com/v24.0/<id>/messages`, `Authorization: Bearer`, corpo `{messaging_product:"whatsapp", to, type:"text", text:{body}}`; texto de 5000 caracteres gera 2 envios; 401 → `WhatsAppAuthError`; 503 → `WhatsAppTemporaryError`.
- [ ] **Step 2:** `pnpm --filter @dynamo/chatbot test`. Expected: FAIL (módulos não existem).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm --filter @dynamo/chatbot test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(chatbot): núcleo com cifra, preços e cliente do WhatsApp`.

### Task 4: Estilo de fala — leitura das exportações, anonimização e exemplos

**Files:**
- Create: `packages/chatbot/src/style/parse-export.ts`, `anonymize.ts`, `examples.ts`, `import.ts`
- Test: `packages/chatbot/tests/style.test.ts`, fixtures em `packages/chatbot/tests/fixtures/` (`android.txt`, `iphone.txt`, `export.zip` gerado no teste com `fflate.zipSync`)

**Interfaces:**
- Produces:
  - `parseExport(input: { fileName: string; bytes: Uint8Array }): ChatLine[]` com `ChatLine = { at: Date; author: string; text: string }`. Aceita `.txt` e `.zip` (pega o primeiro `.txt` de dentro). Formatos: Android `10/11/2026 14:32 - Nome: texto` (também `10/11/26`, e `às` entre data e hora); iPhone `[10/11/2026, 14:32:05] Nome: texto` (segundos opcionais). Remove `‎`, `‏`, ` `. Linhas sem prefixo de data continuam a mensagem anterior. Ignora linhas de sistema (sem `Nome:`) e mídia (`<Mídia oculta>`, `imagem ocultada`, `áudio ocultado`, `vídeo omitido`, `figurinha omitida`, `documento omitido`, `Mensagem apagada`, `Esta mensagem foi apagada`).
  - `listAuthors(lines: ChatLine[]): { author: string; count: number }[]` (para o painel perguntar quem é o atendente)
  - `anonymize(text: string, names: string[]): string`: telefones → `[TELEFONE]`, e-mails → `[EMAIL]`, CPF → `[CPF]`, CNPJ → `[CNPJ]`, CEP → `[CEP]`, cada nome (completo e primeiro nome com 3+ letras, sem diferenciar acento/caixa, palavra inteira) → `[CLIENTE]`
  - `extractExamples(lines: ChatLine[], agent: string): { customerText: string; agentText: string }[]`: agrupa falas seguidas do cliente e as falas seguidas do atendente que vêm logo depois; descarta par com resposta menor que 2 ou maior que 1000 caracteres; remove duplicados.
  - `importStyleExport(db: Db, organizationId: string, file: { fileName: string; bytes: Uint8Array }, agent: string): Promise<{ uploadId: string; examples: number }>`: grava `style_upload` e os `style_example` anonimizados (nomes = todos os autores que não são o atendente). O arquivo original não é gravado.

- [ ] **Step 1: Testes que falham:**
  - Android e iPhone (fixtures com `‎`, ano de 2 dígitos, `às`, segundos ausentes, linha de sistema, mídia omitida, mensagem de 3 linhas) produzem as mesmas `ChatLine` esperadas.
  - zip com o `.txt` dentro dá o mesmo resultado do `.txt`.
  - `anonymize("Oi Maria Souza, meu cpf é 123.456.789-09 e zap (27) 99876-5432, maria@x.com", ["Maria Souza"])` = `"Oi [CLIENTE], meu cpf é [CPF] e zap [TELEFONE], [EMAIL]"`.
  - `extractExamples` com 2 falas do cliente seguidas de 2 do atendente gera 1 par com os textos unidos por `\n`; resposta `"ok"` mantida, `"k"` descartada.
  - `importStyleExport` (banco de teste): grava upload e exemplos sem nenhum telefone; outra empresa não vê os exemplos.
- [ ] **Step 2:** rodar `pnpm --filter @dynamo/chatbot test -- style`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar de novo. Expected: PASS.
- [ ] **Step 5:** Commit `feat(chatbot): leitura de conversas exportadas e exemplos de estilo`.

### Task 5: Planilhas — sincronização e busca

**Files:**
- Create: `packages/chatbot/src/sheets/fetcher.ts`, `sync.ts`, `search.ts`
- Test: `packages/chatbot/tests/sheets.test.ts`

**Interfaces:**
- Produces:
  - `type SheetFetcher = (spreadsheetId: string, tab: string) => Promise<string[][]>`
  - `createGoogleSheetFetcher(serviceAccountJson: string): SheetFetcher` (JWT da `google-auth-library`, escopo `https://www.googleapis.com/auth/spreadsheets.readonly`, GET `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{tab}`); sem teste de rede (só a montagem da URL com fetch falso)
  - `parseSpreadsheetUrl(url: string): string | null` (id entre `/d/` e a próxima `/`)
  - `syncSheet(db: Db, organizationId: string, sourceId: string, fetcher: SheetFetcher): Promise<{ rows: number }>`: 1ª linha = cabeçalho; linhas vazias puladas; substitui as linhas numa transação; em erro grava `last_error` e mantém as linhas antigas; em sucesso zera `last_error` e grava `last_synced_at`
  - `searchSheets(db: Db, organizationId: string, query: string, opts?: { sourceId?: string; limit?: number }): Promise<{ planilha: string; dados: Record<string, string> }[]>`: busca de texto `portuguese` com ordenação por `ts_rank`; se nada vier, faz `ILIKE` por palavra; limite padrão 10

- [ ] **Step 1: Testes que falham:** `parseSpreadsheetUrl` com link de edição e link inválido; `syncSheet` grava 3 linhas de uma matriz com cabeçalho e uma linha vazia; fetcher que lança mantém as linhas anteriores e grava `last_error`; `searchSheets("bacalhau")` acha a linha "Bacalhau à Gomes de Sá" e "bacalhaus" também; limite respeitado; outra empresa não vê as linhas.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Expected: PASS.
- [ ] **Step 5:** Commit `feat(chatbot): sincronização e busca em planilhas`.

### Task 6: Conversas, fila e regras

**Files:**
- Create: `packages/chatbot/src/conversations.ts`, `queue.ts`, `rules.ts`, `config.ts`
- Test: `packages/chatbot/tests/{conversations,queue,rules}.test.ts`

**Interfaces:**
- Produces:
  - `getConfig(db, organizationId): Promise<BotConfig>` (cria a linha com os padrões se não existir); `updateConfig(db, organizationId, patch: Partial<BotConfigInput>): Promise<BotConfig>` (valida com zod: URL do n8n `https`, telefone só dígitos com DDI, teto ≥ 0)
  - `findNumber(db, phoneNumberId): Promise<{ organizationId: string; number: WhatsappNumber } | null>`
  - `recordIncoming(db, organizationId, msg: IncomingMessage, channel?: "whatsapp" | "simulador"): Promise<{ conversationId: string; duplicate: boolean }>` (upsert da conversa, atualiza `last_customer_at` e nome; `wamid` repetido → `duplicate: true`, nada gravado)
  - `recordOutgoing(db, organizationId, conversationId, m: { author: "bot" | "humano"; text: string; wamid?: string; usage?: …; costUsd?: number; toolCalls?: unknown }): Promise<void>`
  - `history(db, organizationId, conversationId, limit = 20): Promise<Message[]>` (ordem cronológica)
  - `scheduleReply(db, organizationId, conversationId, debounceSeconds): Promise<void>` (upsert no índice parcial: `run_after = now() + debounce`)
  - `enqueue(db, job: { organizationId; kind; payload; conversationId?; runAfter? }): Promise<string>`
  - `claimJob(db): Promise<BotJob | null>` (um `UPDATE … WHERE id = (SELECT … WHERE status='pending' AND run_after <= now() AND (conversation_id IS NULL OR NOT EXISTS (running da mesma conversa)) ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, incrementa `attempts`)
  - `completeJob(db, id)`; `failJob(db, id, error: string): Promise<"retry" | "failed">` (volta a `pending` com espera 5 s / 30 s / 120 s até 3 tentativas)
  - `rules.ts`: `isHumanMode(conv, now): boolean` (humano com `handoff_until` no futuro; vencido → bot); `canReplyManually(conv, now): boolean` (≤ 24 h desde `last_customer_at`); `monthSpendBrl(db, organizationId, now, usdBrl): Promise<number>` (soma `cost_usd` do mês em `America/Sao_Paulo`); `overCap(spendBrl, capBrl): boolean`; `setHumanMode(db, organizationId, conversationId, hours)`, `releaseToBot(db, organizationId, conversationId)`

- [ ] **Step 1: Testes que falham:**
  - `recordIncoming` com o mesmo `wamid` duas vezes → segunda `duplicate: true`, 1 mensagem.
  - **Rajada (Review Focus 4):** `scheduleReply` 3× seguidas → 1 job pendente com o `run_after` da última; com um job `running` da conversa, `scheduleReply` cria um novo pendente e `claimJob` não o pega até o `running` terminar; depois de `completeJob`, pega.
  - `claimJob` não pega job com `run_after` no futuro; jobs de conversas diferentes saem em ordem de `run_after`.
  - `failJob` na 1ª e 2ª tentativa → `retry` com `run_after` +5 s e +30 s; na 3ª → `failed`.
  - `isHumanMode` com prazo futuro/vencido; `canReplyManually` a 23h59 e 24h01.
  - `monthSpendBrl` soma só o mês corrente em São Paulo (mensagem às 02:00 UTC do dia 1 conta no mês anterior) × cotação; outra empresa não entra.
  - `updateConfig` recusa URL `http://` e telefone com letras.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Expected: PASS.
- [ ] **Step 5:** Commit `feat(chatbot): conversas, fila com debounce e regras`.

### Task 7: Ferramentas

**Files:**
- Create: `packages/chatbot/src/tools/index.ts`, um arquivo por ferramenta (`buscar-planilha.ts`, `registrar-lead.ts`, `passar-humano.ts`, `avisar-responsavel.ts`, `enviar-n8n.ts`)
- Test: `packages/chatbot/tests/tools.test.ts`

**Interfaces:**
- Consumes: `searchSheets` (T5), `setHumanMode` (T6), `ensureStages` (T1), cliente do WhatsApp (T3)
- Produces:
  - `type ToolContext = { db: Db; organizationId: string; conversationId: string; waId: string; contactName: string | null; config: BotConfig; testMode: boolean; notify: (to: string, text: string) => Promise<void>; fetch: typeof fetch }`
  - `type BotTool = { name: string; definition: Anthropic.Tool; run(input: unknown, ctx: ToolContext): Promise<string> }` (cada definição com `strict: true`, `additionalProperties: false`; `run` valida a entrada com zod e lança `ToolInputError` se inválida)
  - `toolsFor(config: BotConfig): BotTool[]`: `buscar_planilha` sempre; as outras só se ligadas em `config.actions` (`registrar_lead`, `passar_humano`, `avisar_responsavel`, `enviar_n8n`); `enviar_n8n` exige `n8n_webhook_url`; `avisar_responsavel` exige `owner_phone`
  - Entradas: `buscar_planilha {consulta: string, planilha?: string}`; `registrar_lead {nome: string, interesse: string}`; `passar_humano {motivo: string}`; `avisar_responsavel {mensagem: string}`; `enviar_n8n {evento: string, dados: object}`
  - Em `testMode` nenhuma ferramenta com efeito executa: devolve `"[teste] registraria lead: …"` etc. (`buscar_planilha` roda de verdade, só lê)
  - `registrar_lead`: upsert em `lead` com `source: "whatsapp"`, `externalId: waId`, `phone: waId`, `notes: interesse`, 1ª etapa; grava `lead_event` `criado` só na criação; liga `conversation.lead_id`
  - `passar_humano`: `setHumanMode(…, config.handoff_hours)` + avisa `owner_phone` (se houver) com `"Conversa com {nome ou waId} passou para humano: {motivo}"`
  - `enviar_n8n`: POST JSON `{organizationId, conversationId, waId, evento, dados}`, timeout 10 s; status ≥ 400 → lança

- [ ] **Step 1: Testes que falham:** `toolsFor` com ações desligadas oferece só `buscar_planilha`; sem URL do n8n não oferece `enviar_n8n`; `registrar_lead` cria o lead na 1ª etapa e, chamado de novo, atualiza sem duplicar; `passar_humano` muda o modo e chama `notify`; `testMode` não cria lead nem chama `fetch`; entrada inválida → `ToolInputError`; n8n com 500 lança; ferramentas nunca tocam dados de outra empresa.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Expected: PASS.
- [ ] **Step 5:** Commit `feat(chatbot): ferramentas do bot`.

### Task 8: Cérebro — contexto, laço com o Claude e guia de estilo

**Files:**
- Create: `packages/chatbot/src/brain/prompt.ts`, `respond.ts`, `style-guide.ts`, `llm.ts`
- Test: `packages/chatbot/tests/brain.test.ts`, `packages/chatbot/tests/helpers/fake-llm.ts`

**Interfaces:**
- Consumes: T3 (`costUsd`), T4 (exemplos), T6 (`history`, config), T7 (`toolsFor`)
- Produces:
  - `type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>`; `anthropicCreateMessage(client: Anthropic): CreateMessage`
  - `buildSystem(org: { name: string }, config: BotConfig): Anthropic.TextBlockParam[]`: bloco 1 = `BASE_INSTRUCTIONS` (constante, sem data nem ids); bloco 2 = nome da empresa + guia de estilo + regras extras, com `cache_control: { type: "ephemeral" }`
  - `BASE_INSTRUCTIONS` deve dizer, em português: você é o assistente virtual da empresa no WhatsApp; na primeira resposta da conversa, apresente-se como assistente virtual da empresa; responda só sobre o negócio e recuse com educação outros assuntos; preço, estoque, horário, endereço e qualquer dado do negócio só podem vir de `buscar_planilha` — se não encontrar, diga que vai confirmar e chame `passar_humano` (quando disponível); mensagens curtas, no tom do guia; nunca invente políticas; peça para falar com humano → `passar_humano`.
  - `buildMessages(history: Message[], examples: StyleExample[]): Anthropic.MessageParam[]`: `cliente` → `user`, `bot`/`humano` → `assistant`; descarta mensagens `assistant` iniciais; o último `user` recebe antes do texto um bloco `"Exemplos de como o atendente responde situações parecidas:\n…"` (até 8 pares)
  - `findExamples(db, organizationId, text: string, limit = 8)`: busca de texto nos `style_example`
  - `respond(deps: { db: Db; createMessage: CreateMessage; organizationId: string; conversationId: string; testMode: boolean; notify: ToolContext["notify"]; fetch: typeof fetch }): Promise<Reply>` com `Reply = { text: string | null; handoff: boolean; usage: {input,cached,cacheWrite,output}; costUsd: number; toolCalls: { name: string; input: unknown; ok: boolean }[] }`
    - modelo = `config.model`, `max_tokens: 16000`, `output_config: { effort: "low" }`, `tools` = definições de `toolsFor` em ordem fixa
    - laço: enquanto `stop_reason === "tool_use"` e voltas < 6: executa as ferramentas, devolve **todos** os `tool_result` numa única mensagem `user` (erro → `is_error: true` com a mensagem; nome desconhecido → `is_error: true`); acrescenta `response.content` inteiro ao histórico
    - soma `usage` e custo de todas as voltas
    - `stop_reason === "refusal"` ou 6 voltas esgotadas → executa `passar_humano` (se ligado) e `text = MSG_JA_RESPONDO`, `handoff: true`
    - texto final = junção dos blocos `text` da última resposta; vazio → `null`
  - `generateStyleGuide(deps: { db; createMessage; organizationId }): Promise<string>`: amostra de até 60 exemplos (os mais recentes por upload), modelo `claude-sonnet-5-5`, `output_config: { effort: "medium" }`, pede um guia em tópicos (tom, tamanho, emojis, expressões típicas, como cumprimenta, como fecha, o que evita), devolve o texto e grava o custo numa linha `message` (`author: "bot"`) da conversa técnica `channel = "sistema"`, `wa_id = "guia-de-estilo"`, para entrar no gasto do mês

- [ ] **Step 1: Testes que falham** (com `fake-llm`, que devolve `Anthropic.Message` roteirizadas e registra os parâmetros recebidos):
  - `buildSystem`: dois blocos; o 2º com `cache_control`; nenhum contém data (chamar duas vezes em momentos diferentes → idêntico).
  - `buildMessages`: começa por `user`; exemplos entram só no último `user`.
  - `respond` simples: 1 resposta de texto → `text`, custo = `costUsd` do `usage` roteirizado.
  - `respond` com ferramenta: roteiro `tool_use(buscar_planilha)` → `text`; a 2ª chamada recebeu o `content` inteiro da 1ª e um único `user` com o `tool_result`; custo soma as duas voltas.
  - **Review Focus 5:** duas `tool_use` paralelas → um único `user` com 2 `tool_result`; ferramenta desconhecida e entrada inválida → `is_error: true` e o laço segue; `stop_reason: "refusal"` → `handoff: true`, `text === MSG_JA_RESPONDO`, conversa em modo humano; 7 voltas de `tool_use` → para na 6ª com handoff.
  - Parâmetros enviados: `model: "claude-haiku-5-5"`, `output_config.effort: "low"`, sem `temperature`, sem `thinking`, sem `tool_choice`.
  - `generateStyleGuide`: usa `claude-sonnet-5-5`, envia no máximo 60 exemplos, grava o custo na conversa `sistema`.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Expected: PASS. Rodar também a suíte inteira do pacote.
- [ ] **Step 5:** Commit `feat(chatbot): cérebro com Claude, ferramentas e guia de estilo`.

### Task 9: `apps/bot` — webhook, worker, tarefas periódicas e deploy

**Files:**
- Create: `apps/bot/package.json` (`bot`; deps `@dynamo/chatbot`, `@dynamo/db`, `@anthropic-ai/sdk`; dev `esbuild`, `tsx`, `vitest`, `typescript`; scripts `dev: tsx watch src/main.ts`, `build: node build.mjs`, `test: vitest run`, `typecheck: tsc --noEmit`), `apps/bot/build.mjs` (esbuild: `platform: node`, `format: esm`, `bundle: true`, saída `dist/server.mjs`, banner com `createRequire`), `apps/bot/src/main.ts`, `src/http.ts`, `src/worker.ts`, `src/periodic.ts`, `src/process-job.ts`
- Create: `Dockerfile.bot`, `deploy/bot/README.md`
- Modify: `Dockerfile.crm` (copiar `packages/chatbot` como no T1), raiz `package.json` (`dev:bot`, `test:bot`)
- Test: `apps/bot/tests/{http,process-job}.test.ts`

**Interfaces:**
- Consumes: tudo do núcleo
- Produces:
  - `createHandler(deps: { db: Db; appSecret: string; verifyToken: string; now?: () => Date }): (req: IncomingMessage, res: ServerResponse) => void`
    - `GET /webhook`: `hub.mode=subscribe` e `hub.verify_token` certo → 200 com `hub.challenge`; senão 403
    - `POST /webhook`: lê o corpo bruto (limite 1 MB); assinatura inválida → 401; para cada mensagem: número desconhecido ou `desligado` → ignora; `recordIncoming`; duplicada → ignora; bot desligado → só grava; senão `scheduleReply`. Sempre 200 depois de gravar (corpo inválido → 200 sem efeito)
    - `GET /health` → 200 `{ ok: true }` após `select 1`
  - `processJob(job, deps: { db; createMessage; whatsapp; fetchSheet; usdBrl; now; fetch }): Promise<void>`
    - `responder`: carrega conversa e config; modo humano → nada; última mensagem do cliente não é texto → `non_text_policy` (`pedir_texto` envia `MSG_NAO_TEXTO`; `humano` chama `setHumanMode` e avisa); gasto ≥ teto → `setHumanMode` + avisa `owner_phone` (uma vez por mês, controlado por `bot_config.cap_notified_month`) e não responde; senão `respond()` → envia, `markRead` na última mensagem do cliente, `recordOutgoing` com usage, custo e ferramentas
    - `WhatsAppAuthError` → número `com_problema`, job `failed` sem novas tentativas; `WhatsAppTemporaryError` e erros da Anthropic 429/5xx/conexão → `failJob` (nova tentativa); na falha definitiva de `responder`, tenta enviar `MSG_JA_RESPONDO` e `passar_humano`
    - `sync_planilha` → `syncSheet`; `gerar_guia` → `generateStyleGuide` e grava em `bot_config.style_guide_draft` (o painel mostra a proposta e o dono escolhe aplicar, sem apagar edições sem confirmação)
  - `startWorker(deps, { concurrency: 4, idleMs: 1000 })` e `startPeriodic(deps)`: a cada 5 min enfileira `sync_planilha` de cada `sheet_source`; 1× por dia apaga `message` mais antigas que `retention_months` de cada empresa
  - `main.ts`: lê e valida as variáveis de ambiente (falta de uma obrigatória → encerra com mensagem clara), sobe HTTP na `PORT`, worker e periódicas; `SIGTERM` para de pegar jobs e espera os em andamento (até 20 s)
- `Dockerfile.bot`: builder `node:22-alpine` + corepack, `pnpm install --frozen-lockfile --filter bot...`, `pnpm --filter bot build`; runner só com `dist/server.mjs`, usuário não root, `EXPOSE 3001`, `CMD ["node","server.mjs"]`. As migrações continuam aplicadas pelo CRM: o README manda implantar o CRM antes do bot.
- `deploy/bot/README.md`: passo a passo da seção 10 da spec (app na Meta, usuário do sistema e token permanente, número, inscrição do webhook `https://bot.dynamo.business/webhook` com o campo `messages`, chave da Anthropic, conta de serviço do Google, `A bot`, serviço no Easypanel com as variáveis de ambiente, como gerar `CHATBOT_ENC_KEY` com `openssl rand -base64 32`), e o mesmo valor de `CHATBOT_ENC_KEY` no CRM.

- [ ] **Step 1: Testes que falham:**
  - http: verificação GET certa e errada; **Review Focus 3**: POST com assinatura errada → 401; só `statuses` → 200 e nenhum job; número desconhecido → 200 e nada gravado; número `desligado` → 200 e nada; bot desligado → grava mensagem e nenhum job; mensagem válida → mensagem + 1 job; mesma mensagem 2× → 1 mensagem; corpo não JSON assinado → 200; corpo > 1 MB → 413.
  - process-job (fakes de LLM, WhatsApp e fetch): resposta enviada e gravada com custo; modo humano não envia; imagem com `pedir_texto` envia `MSG_NAO_TEXTO`; teto atingido → humano, aviso único no mês, nada enviado ao cliente; `WhatsAppAuthError` → número `com_problema` e job `failed`; erro temporário → `retry`; falha definitiva → `MSG_JA_RESPONDO` + humano.
- [ ] **Step 2:** `pnpm --filter bot test`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm --filter bot test && pnpm --filter bot typecheck && pnpm --filter bot build`. Expected: PASS, sem erros, `dist/server.mjs` gerado.
- [ ] **Step 5:** `docker build -f Dockerfile.bot -t dynamo-bot-test .` e `docker build -f Dockerfile.crm -t dynamo-crm-test .`. Rodar o bot contra um Postgres local em Docker com as migrações aplicadas e as variáveis falsas; `curl localhost:3001/health` → `{"ok":true}`; `curl "localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=42"` → `42`.
- [ ] **Step 6:** Commit `feat(bot): serviço do webhook, worker e deploy`.

### Task 10: CRM — seção Chatbot

**Files:**
- Create em `apps/crm/src/app/(painel)/chatbot/`: `layout.tsx` (abas: Visão geral, Conversas, Estilo, Planilhas, Automações, Simulador; só `owner`/`admin`, senão redireciona para `/`), `page.tsx`, `conversas/page.tsx`, `conversas/[id]/page.tsx`, `estilo/page.tsx`, `planilhas/page.tsx`, `automacoes/page.tsx`, `simulador/page.tsx`, `actions.ts`
- Create: `apps/crm/src/lib/chatbot.ts` (server-only: `whatsapp` real, `createMessage` real, `fetchSheet` real, `usdBrl` a partir das variáveis de ambiente)
- Modify: `(painel)/layout.tsx` (item "Chatbot" no menu só para `owner`/`admin`), `next.config.ts` (`transpilePackages` + `"@dynamo/chatbot"`; `experimental.serverActions.bodySizeLimit: "10mb"` para os uploads), `package.json` (dep `@dynamo/chatbot`)
- Test: `packages/chatbot/tests/panel.test.ts` (as consultas do painel ficam no núcleo, em `packages/chatbot/src/panel.ts`)

**Interfaces:**
- Produces em `packages/chatbot/src/panel.ts` (todas recebem `db` e `organizationId`):
  - `overview(db, orgId, now, usdBrl): Promise<{ enabled: boolean; numberStatus: string | null; conversationsToday: number; leadsThisMonth: number; spendBrl: number; capBrl: number }>`
  - `listConversations(db, orgId, opts: { mode?: "bot" | "humano"; limit?: number }): Promise<ConversationRow[]>` (só `channel = "whatsapp"`, mais recentes primeiro)
  - `getConversation(db, orgId, id)` (com mensagens) → `null` se for de outra empresa
  - `sendManualReply(db, orgId, conversationId, text, whatsapp, now)`: recusa fora das 24 h (`ManualReplyWindowError`); envia e grava `author: "humano"`
  - `simulate(deps, orgId, userId, text): Promise<{ reply: Reply; transcript: Message[] }>`: conversa `channel = "simulador"`, `wa_id = "sim:" + userId`, `respond` com `testMode: true`; `resetSimulation(db, orgId, userId)`
  - `listSheetSources`, `addSheetSource(db, orgId, { url, tab, label })` (valida o link com `parseSpreadsheetUrl` e enfileira `sync_planilha`), `removeSheetSource`, `requestSync`
  - `listExamples`, `removeExample`, `requestStyleGuide` (enfileira `gerar_guia`), `applyStyleGuideDraft`
- Telas: textos em português no padrão visual atual (`PageHeader`, `Card`, `Stat`, `CtaButton`, `GhostButton`, `EmptyState`). Estilo: upload → lista de autores (de `listAuthors`) → escolher o atendente → importar. Simulador: chat simples com o "[teste] …" das ferramentas visível.

- [ ] **Step 1: Testes que falham** (`panel.test.ts`, banco de teste): `overview` conta só hoje em São Paulo e só a empresa; `getConversation` de outra empresa → `null`; `sendManualReply` a 25 h → `ManualReplyWindowError`; `simulate` não cria lead mesmo com `registrar_lead` ligado e não aparece em `listConversations`; `addSheetSource` com link inválido lança e com link válido cria a fonte e 1 job.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar `panel.ts`, depois as telas e actions (cada action começa com `getOrgContext()` e confere o papel).
- [ ] **Step 4:** `pnpm --filter @dynamo/chatbot test && pnpm --filter crm typecheck && pnpm --filter crm build`. Expected: PASS e build OK.
- [ ] **Step 5:** Verificação manual com o CRM em dev contra o Postgres local: criar empresa demo (`pnpm --filter crm novo-cliente`), abrir cada aba, subir a fixture `android.txt`, ver os exemplos, abrir o simulador e mandar uma mensagem com `ANTHROPIC_API_KEY` ausente → a tela mostra um erro claro (sem chave, o simulador não chama nada e diz "Configure ANTHROPIC_API_KEY").
- [ ] **Step 6:** Commit `feat(crm): seção Chatbot no painel`.

### Task 11: CRM — ligar número, exclusão por titular e fechamento

**Files:**
- Modify: `apps/crm/src/app/admin/page.tsx`, `apps/crm/src/app/admin/actions.ts`; Create: `apps/crm/src/app/admin/whatsapp-form.tsx`, `apps/crm/src/app/admin/titular-form.tsx`
- Create em `packages/chatbot/src/admin.ts`: `linkNumber`, `setNumberStatus`, `deleteContactData`
- Modify: `docs/ARQUITETURA.md` (bot no diagrama e na tabela de decisões; fase 4 atualizada), raiz `README.md` (comandos do bot)
- Test: `packages/chatbot/tests/admin.test.ts`

**Interfaces:**
- Produces:
  - `linkNumber(db, { organizationSlug: string; phoneNumberId: string; wabaId: string; displayPhone: string; accessToken: string }, encKey: string): Promise<{ organizationId: string }>`: empresa inexistente → `AdminError`; `phoneNumberId` já ligado a outra empresa → `AdminError`; grava o token cifrado; mesmo número na mesma empresa → atualiza o token
  - `setNumberStatus(db, phoneNumberId, status)`
  - `deleteContactData(db, organizationSlug, phone: string): Promise<{ conversations: number; messages: number }>`: normaliza o telefone para só dígitos; apaga conversas (e mensagens em cascata) desse `wa_id` na empresa; o lead do CRM continua (é dado do CRM, com fluxo próprio)
- Formulários protegidos pelo `ADMIN_TOKEN` com a mesma checagem e as mesmas mensagens de diagnóstico de `novoClienteAction`.

- [ ] **Step 1: Testes que falham:** `linkNumber` grava token que `decrypt` devolve igual e que não aparece em texto puro no banco; número de outra empresa → erro; `deleteContactData("+55 (27) 99876-5432")` apaga só aquela conversa daquela empresa.
- [ ] **Step 2:** Rodar. Expected: FAIL.
- [ ] **Step 3:** Implementar o núcleo, os formulários e a documentação.
- [ ] **Step 4:** Suíte completa: `pnpm --filter @dynamo/db test && pnpm --filter @dynamo/chatbot test && pnpm --filter bot test && pnpm --filter crm typecheck && pnpm --filter crm build && pnpm --filter site test`. Expected: tudo verde (o site não pode quebrar com o `pnpm install` novo).
- [ ] **Step 5:** `docker build` dos três Dockerfiles (`Dockerfile.site` com os `--build-arg` de produção do README do site). Expected: as três imagens geradas.
- [ ] **Step 6:** Commit `feat(crm): ligar número de WhatsApp e excluir dados por titular`.
