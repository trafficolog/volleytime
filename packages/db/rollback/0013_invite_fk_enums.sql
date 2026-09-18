ALTER TABLE "invite_links" DROP CONSTRAINT IF EXISTS "invite_links_uses_non_negative";
ALTER TABLE "invite_links" DROP CONSTRAINT IF EXISTS "invite_links_role_not_owner";
ALTER TABLE "organization_members" DROP CONSTRAINT IF EXISTS "organization_members_invite_id_invite_links_id_fk";
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" DROP DEFAULT;
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" SET DATA TYPE text USING "default_member_status"::text;
ALTER TABLE "invite_links" ALTER COLUMN "default_member_status" SET DEFAULT 'active';
ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" DROP DEFAULT;
ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" SET DATA TYPE text USING "role_to_assign"::text;
ALTER TABLE "invite_links" ALTER COLUMN "role_to_assign" SET DEFAULT 'player';
