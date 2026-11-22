CREATE TABLE "feature_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"feature" varchar(16) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_events_feature_chk" CHECK ("feature_events"."feature" IN ('cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped')),
	CONSTRAINT "feature_events_kind_chk" CHECK ("feature_events"."kind" IN ('open', 'use'))
);
--> statement-breakpoint
ALTER TABLE "feature_events" ADD CONSTRAINT "feature_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_events_user_feature_kind_day_uq" ON "feature_events" USING btree ("user_id","feature","kind","day");--> statement-breakpoint
CREATE INDEX "feature_events_feature_created_idx" ON "feature_events" USING btree ("feature","created_at");--> statement-breakpoint
CREATE INDEX "feature_events_created_idx" ON "feature_events" USING btree ("created_at");