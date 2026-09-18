ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" SET DATA TYPE "public"."member_role" USING "role_to_assign"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" SET DEFAULT 'player'::"public"."member_role";--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" SET DATA TYPE "public"."member_status_default" USING "default_member_status"::"public"."member_status_default";--> statement-breakpoint
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" SET DEFAULT 'active'::"public"."member_status_default";--> statement-breakpoint
UPDATE "organization_members" SET "invite_id" = NULL WHERE "invite_id" IS NOT NULL AND "invite_id" NOT IN (SELECT "id" FROM "invite_links");--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invite_id_invite_links_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_role_not_owner" CHECK ("invite_links"."role_to_assign" <> 'owner');--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_uses_non_negative" CHECK ("invite_links"."uses_count" >= 0);
