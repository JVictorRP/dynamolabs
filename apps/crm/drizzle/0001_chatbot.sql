CREATE TYPE "public"."bot_conversation_mode" AS ENUM('bot', 'humano');--> statement-breakpoint
CREATE TYPE "public"."bot_job_kind" AS ENUM('responder', 'sync_planilha', 'gerar_guia');--> statement-breakpoint
CREATE TYPE "public"."bot_job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."bot_message_author" AS ENUM('cliente', 'bot', 'humano');--> statement-breakpoint
CREATE TYPE "public"."bot_message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."bot_non_text_policy" AS ENUM('pedir_texto', 'humano');--> statement-breakpoint
CREATE TYPE "public"."bot_number_status" AS ENUM('ativo', 'com_problema', 'desligado');--> statement-breakpoint
CREATE TABLE "bot_config" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"model" text DEFAULT 'claude-haiku-5-5' NOT NULL,
	"style_guide" text DEFAULT '' NOT NULL,
	"style_guide_draft" text,
	"extra_rules" text DEFAULT '' NOT NULL,
	"actions" jsonb DEFAULT '{"registrar_lead":true,"passar_humano":true,"avisar_responsavel":false,"enviar_n8n":false}'::jsonb NOT NULL,
	"n8n_webhook_url" text,
	"owner_phone" text,
	"non_text_policy" "bot_non_text_policy" DEFAULT 'pedir_texto' NOT NULL,
	"handoff_hours" integer DEFAULT 12 NOT NULL,
	"monthly_cap_brl" numeric(10, 2) DEFAULT '300' NOT NULL,
	"retention_months" integer DEFAULT 12 NOT NULL,
	"debounce_seconds" integer DEFAULT 4 NOT NULL,
	"cap_notified_month" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_job" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"conversation_id" text,
	"kind" "bot_job_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" "bot_job_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"wa_id" text NOT NULL,
	"contact_name" text,
	"mode" "bot_conversation_mode" DEFAULT 'bot' NOT NULL,
	"handoff_until" timestamp with time zone,
	"lead_id" text,
	"last_customer_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"direction" "bot_message_direction" NOT NULL,
	"author" "bot_message_author" NOT NULL,
	"wamid" text,
	"type" text DEFAULT 'text' NOT NULL,
	"text" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"tool_calls" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_wamid_unique" UNIQUE("wamid")
);
--> statement-breakpoint
CREATE TABLE "sheet_row" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source_id" text NOT NULL,
	"position" integer NOT NULL,
	"data" jsonb NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (jsonb_to_tsvector('portuguese'::regconfig, data, '["string", "numeric"]')) STORED
);
--> statement-breakpoint
CREATE TABLE "sheet_source" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"tab" text NOT NULL,
	"label" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_example" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"upload_id" text,
	"customer_text" text NOT NULL,
	"agent_text" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(customer_text, '') || ' ' || coalesce(agent_text, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_name" text NOT NULL,
	"agent_name" text NOT NULL,
	"status" text DEFAULT 'processado' NOT NULL,
	"examples" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_number" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"waba_id" text NOT NULL,
	"display_phone" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"status" "bot_number_status" DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_number_phone_number_id_unique" UNIQUE("phone_number_id")
);
--> statement-breakpoint
ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_job" ADD CONSTRAINT "bot_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_job" ADD CONSTRAINT "bot_job_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_row" ADD CONSTRAINT "sheet_row_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_row" ADD CONSTRAINT "sheet_row_source_id_sheet_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sheet_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_source" ADD CONSTRAINT "sheet_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_example" ADD CONSTRAINT "style_example_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_example" ADD CONSTRAINT "style_example_upload_id_style_upload_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."style_upload"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_upload" ADD CONSTRAINT "style_upload_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_number" ADD CONSTRAINT "whatsapp_number_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_job_pending_responder_uq" ON "bot_job" USING btree ("conversation_id") WHERE kind = 'responder' and status = 'pending';--> statement-breakpoint
CREATE INDEX "bot_job_status_run_idx" ON "bot_job" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_org_channel_wa_uq" ON "conversation" USING btree ("organization_id","channel","wa_id");--> statement-breakpoint
CREATE INDEX "conversation_org_updated_idx" ON "conversation" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "message_org_created_idx" ON "message" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "sheet_row_source_idx" ON "sheet_row" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "sheet_row_org_idx" ON "sheet_row" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sheet_row_search_idx" ON "sheet_row" USING gin ("search");--> statement-breakpoint
CREATE INDEX "sheet_source_org_idx" ON "sheet_source" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "style_example_org_idx" ON "style_example" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "style_example_search_idx" ON "style_example" USING gin ("search");--> statement-breakpoint
CREATE INDEX "style_upload_org_idx" ON "style_upload" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_number_org_idx" ON "whatsapp_number" USING btree ("organization_id");