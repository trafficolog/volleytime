CREATE TYPE "public"."telegram_chat_link_status" AS ENUM('active', 'invalid', 'unlinked');--> statement-breakpoint
CREATE TABLE "organization_telegram_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"chat_type" text NOT NULL,
	"title" text NOT NULL,
	"status" "telegram_chat_link_status" DEFAULT 'active' NOT NULL,
	"invalid_reason" text,
	"unlink_reason" text,
	"bot_can_post" boolean DEFAULT true NOT NULL,
	"linked_by_user_id" integer,
	"confirmed_by_telegram_id" bigint NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlinked_at" timestamp with time zone,
	"unlinked_by_user_id" integer,
	CONSTRAINT "org_telegram_chats_chat_type_chk" CHECK ("organization_telegram_chats"."chat_type" IN ('group', 'supergroup')),
	CONSTRAINT "org_telegram_chats_invalid_reason_chk" CHECK (("organization_telegram_chats"."status" = 'invalid') = ("organization_telegram_chats"."invalid_reason" IS NOT NULL)
        AND ("organization_telegram_chats"."invalid_reason" IS NULL OR "organization_telegram_chats"."invalid_reason" IN ('no_rights', 'migrated'))),
	CONSTRAINT "org_telegram_chats_unlink_reason_chk" CHECK (("organization_telegram_chats"."status" = 'unlinked') = ("organization_telegram_chats"."unlink_reason" IS NOT NULL)
        AND ("organization_telegram_chats"."unlink_reason" IS NULL OR "organization_telegram_chats"."unlink_reason" IN ('organizer', 'bot_removed')))
);
--> statement-breakpoint
CREATE TABLE "telegram_chat_link_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_telegram_chats" ADD CONSTRAINT "organization_telegram_chats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_telegram_chats" ADD CONSTRAINT "organization_telegram_chats_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_telegram_chats" ADD CONSTRAINT "organization_telegram_chats_unlinked_by_user_id_users_id_fk" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chat_link_codes" ADD CONSTRAINT "telegram_chat_link_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chat_link_codes" ADD CONSTRAINT "telegram_chat_link_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_telegram_chats_chat_uniq" ON "organization_telegram_chats" USING btree ("telegram_chat_id") WHERE "organization_telegram_chats"."status" <> 'unlinked';--> statement-breakpoint
CREATE UNIQUE INDEX "org_telegram_chats_org_uniq" ON "organization_telegram_chats" USING btree ("organization_id") WHERE "organization_telegram_chats"."status" <> 'unlinked';--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_chat_link_codes_hash_uniq" ON "telegram_chat_link_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "telegram_chat_link_codes_org_idx" ON "telegram_chat_link_codes" USING btree ("organization_id");