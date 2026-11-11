CREATE TYPE "public"."content_event_type" AS ENUM('enviado', 'aprovado', 'ajuste_pedido', 'editado', 'arquivado', 'reaberto');--> statement-breakpoint
CREATE TYPE "public"."content_media_kind" AS ENUM('image', 'video');--> statement-breakpoint
ALTER TYPE "public"."content_status" ADD VALUE 'ajuste_pedido' BEFORE 'aprovado';--> statement-breakpoint
CREATE TABLE "content_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"post_id" text NOT NULL,
	"type" "content_event_type" NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_media" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"post_id" text NOT NULL,
	"kind" "content_media_kind" NOT NULL,
	"position" integer NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"alt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_notice" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"handle" text DEFAULT '' NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"avatar_file_key" text,
	"bio" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_share" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "content_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_event" ADD CONSTRAINT "content_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_event" ADD CONSTRAINT "content_event_post_id_content_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_post_id_content_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_notice" ADD CONSTRAINT "content_notice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_notice" ADD CONSTRAINT "content_notice_event_id_content_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."content_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_profile" ADD CONSTRAINT "content_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_share" ADD CONSTRAINT "content_share_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_event_org_idx" ON "content_event" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "content_event_post_idx" ON "content_event" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_media_post_position_uq" ON "content_media" USING btree ("post_id","position");--> statement-breakpoint
CREATE INDEX "content_media_org_idx" ON "content_media" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_media_file_idx" ON "content_media" USING btree ("file_key");--> statement-breakpoint
CREATE INDEX "content_notice_pending_idx" ON "content_notice" USING btree ("organization_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_share_active_uq" ON "content_share" USING btree ("organization_id") WHERE revoked_at is null;