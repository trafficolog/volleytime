CREATE TYPE "public"."player_level" AS ENUM('v1', 'v2', 'v3', 'v4', 'v4_plus');--> statement-breakpoint
CREATE TABLE "player_levels" (
	"code" "player_level" PRIMARY KEY NOT NULL,
	"sort_order" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "player_levels_sort_order_unique" UNIQUE("sort_order")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "levels" "player_level"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "level" "player_level";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "level" "player_level";--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_level_player_levels_code_fk" FOREIGN KEY ("level") REFERENCES "public"."player_levels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_level_player_levels_code_fk" FOREIGN KEY ("level") REFERENCES "public"."player_levels"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "player_levels" ("code", "sort_order", "title", "description") VALUES
	('v1', 1, 'В1', 'Полупрофи: играют в турнирах и лигах, уверенно владеют всеми элементами и тактикой, тренируются регулярно.'),
	('v2', 2, 'В2', 'Сильный любительский: стабильная подача и приём, атака со второго темпа, понимание позиций и взаимодействий.'),
	('v3', 3, 'В3', 'Средний любительский: уверенно играют в командной игре, осваивают атаку и блок, иногда допускают ошибки в приёме.'),
	('v4', 4, 'В4', 'Продолжающие любители: знают правила и базовую технику, играют в удовольствие, совершенствуют подачу и приём.'),
	('v4_plus', 5, 'В4+', 'Начинающие: только знакомятся с игрой, осваивают базовые элементы и правила.')
ON CONFLICT ("code") DO NOTHING;
