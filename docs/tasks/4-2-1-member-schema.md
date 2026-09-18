---
id: '4.2.1'
phase: '4'
epic: '4.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
  - DB
depends_on:
  - '4.1.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - members
---

# Task 4.2.1: Drizzle schema organization_members + миграция

## Цель

Создать Drizzle schema для `organization_members` таблицы. Many-to-many user × organization с ролью и статусом.

## Контекст

Связь many-to-many user × organization. На эту таблицу будут ссылаться все последующие проверки прав и tenant resolution. Один user — много организаций.

## Что должно быть сделано

1. **`packages/db/src/schema/organization-members.ts`:**

   ```ts
   import { pgTable, serial, integer, timestamp, pgEnum, unique, index } from 'drizzle-orm/pg-core'
   import { users } from './users'
   import { organizations } from './organizations'

   export const memberRoleEnum = pgEnum('member_role', [
     'owner',
     'organizer',
     'assistant',
     'player',
   ])
   export const memberStatusEnum = pgEnum('member_status', [
     'pending',
     'active',
     'guest',
     'blocked',
     'left',
     'rejected',
   ])

   export const organizationMembers = pgTable(
     'organization_members',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'cascade' }),
       role: memberRoleEnum('role').notNull().default('player'),
       status: memberStatusEnum('status').notNull().default('active'),
       joinedAt: timestamp('joined_at', { withTimezone: true }),
       invitedByUserId: integer('invited_by_user_id').references(() => users.id, {
         onDelete: 'set null',
       }),
       inviteId: integer('invite_id'), // FK добавим в 4.4.1 (нельзя сделать сейчас — таблицы ещё нет)
       ratingInOrg: integer('rating_in_org'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
       updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       uniqueOrgUser: unique('organization_members_org_user_unique').on(t.organizationId, t.userId),
       orgIdx: index('organization_members_org_idx').on(t.organizationId),
       userIdx: index('organization_members_user_idx').on(t.userId),
       statusIdx: index('organization_members_status_idx').on(t.status),
     }),
   )

   export type OrganizationMember = typeof organizationMembers.$inferSelect
   export type NewOrganizationMember = typeof organizationMembers.$inferInsert
   ```

2. **Обновить `schema/index.ts`:**

   ```ts
   export * from './organization-members'
   ```

3. **Обновить `schema/relations.ts`:**

   ```ts
   import { organizationMembers } from './organization-members'

   export const organizationsRelations = relations(organizations, ({ one, many }) => ({
     owner: one(users, {
       fields: [organizations.ownerUserId],
       references: [users.id],
       relationName: 'owner',
     }),
     members: many(organizationMembers),
   }))

   export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
     organization: one(organizations, {
       fields: [organizationMembers.organizationId],
       references: [organizations.id],
     }),
     user: one(users, {
       fields: [organizationMembers.userId],
       references: [users.id],
     }),
     invitedBy: one(users, {
       fields: [organizationMembers.invitedByUserId],
       references: [users.id],
       relationName: 'invitedBy',
     }),
   }))

   export const usersRelations = relations(users, ({ many }) => ({
     accounts: many(accounts),
     sessions: many(sessions),
     ownedOrganizations: many(organizations, { relationName: 'owner' }),
     memberships: many(organizationMembers),
     invitations: many(organizationMembers, { relationName: 'invitedBy' }),
   }))
   ```

4. **Сгенерировать миграцию:**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица `organization_members` создана с правильными типами
- ✅ Enums `member_role` и `member_status` созданы
- ✅ Unique constraint на `(organization_id, user_id)` — нельзя добавить дубликат
- ✅ Cascade delete: при удалении org или user — каскадно удаляются связи
- ✅ FK `invited_by_user_id` — `onDelete: 'set null'` (если invitor удалён, member остаётся)
- ✅ Indexes на org_id, user_id, status — для быстрых запросов
- ✅ Relations работают: `db.query.organizations.findFirst({ with: { members: { with: { user: true } } } })`
- ✅ Миграция применяется и откатывается

## Подсказки

- **`unique` constraint** обязателен — иначе один user может появиться дважды в одной организации (race condition при invite acceptance).
- **`onDelete: 'cascade'`** на org_id и user_id — потому что при удалении organization (физическом, который мы НЕ делаем в Phase 4) — нет смысла оставлять orphaned members. Аналогично с user.
- **`invite_id`** — FK будет добавлен в 4.4.1 через ALTER TABLE миграцию. Сейчас просто int column.
- **Что такое `rating_in_org`?** Это per-organization rating игрока (отличается от глобального user.rating). Используется для balanced team generation в Phase 17. В Phase 4 — просто nullable, не используется.

## Не делать

- ❌ Не добавлять FK на `invite_links` сейчас — таблица не существует. Добавим в 4.4.1 ALTER миграции
- ❌ Не делать `softDelete` поле — используем status вместо
- ❌ Не делать поле `last_seen_at` или `joined_via` — может быть полезно, но overengineering для MVP
