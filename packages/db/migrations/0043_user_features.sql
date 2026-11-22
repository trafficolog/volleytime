CREATE TABLE "user_features" (
	"user_id" integer NOT NULL,
	"feature" varchar(16) NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_features_user_id_feature_pk" PRIMARY KEY("user_id","feature"),
	CONSTRAINT "user_features_feature_chk" CHECK ("user_features"."feature" IN ('cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped'))
);
--> statement-breakpoint
ALTER TABLE "user_features" ADD CONSTRAINT "user_features_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;