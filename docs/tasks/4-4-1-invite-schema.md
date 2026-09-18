---
id: '4.4.1'
phase: '4'
epic: '4.4'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
  - DB
depends_on:
  - '4.2.1'
estimated_hours: '1'
tags:
  - drizzle
  - schema
  - invites
---

# Task 4.4.1: Drizzle schema invite_links + миграция

## Цель

Создать таблицу `invite_links` для invite-based onboarding. Добавить FK `invite_id` в `organization_members` через ALTER миграцию.

## Контекст

В Phase 4 единственный тип — `organization_join`. Остальные типы существуют в enum для будущего (event_join — Phase 5, и т.д.).

Token — короткий URL-safe (nanoid 10 chars). Hash в БД не делаем.

## Что должно быть сделано

1. **`packages/db/src/schema/invite-links.ts`:**

   ```ts
   import {
     pgTable,
     serial,
     integer,
     text,
     timestamp,
     pgEnum,
     varchar,
     boolean,
     index,
   } from 'drizzle-orm/pg-core'
   import { users } from './users'
   import { organizations } from './organizations'

   export const inviteTypeEnum = pgEnum('invite_type', [
     'organization_join',
     'event_join',
     'subscription_invite',
     'staff_invite',
   ])

   export const inviteLinks = pgTable(
     'invite_links',
     {
       id: serial('id').primaryKey(),
       token: varchar('token', { length: 32 }).notNull().unique(),
       organizationId: integer('organization_id')
         .notNull()
         .references(() => organizations.id, { onDelete: 'cascade' }),
       eventId: integer('event_id'), // FK на events добавится в Phase 5
       type: inviteTypeEnum('type').notNull().default('organization_join'),
       createdByUserId: integer('created_by_user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'restrict' }),
       roleToAssign: text('role_to_assign').notNull().default('player'),
       defaultMemberStatus: text('default_member_status').notNull().default('active'),
       maxUses: integer('max_uses'), // null = unlimited
       usesCount: integer('uses_count').notNull().default(0),
       expiresAt: timestamp('expires_at', { withTimezone: true }), // null = no expiration
       isRevoked: boolean('is_revoked').notNull().default(false),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgIdx: index('invite_links_org_idx').on(t.organizationId),
       activeIdx: index('invite_links_active_idx').on(t.isRevoked),
     }),
   )

   export type InviteLink = typeof inviteLinks.$inferSelect
   export type NewInviteLink = typeof inviteLinks.$inferInsert
   ```

2. **Обновить `schema/index.ts`:**

   ```ts
   export * from './invite-links'
   ```

3. **Добавить FK в `organization_members.invite_id` через миграцию:**

   После генерации миграции `pnpm db:generate` появится файл вида `0003_xxx.sql`. Drizzle автоматически добавит ALTER TABLE для `invite_id` если правильно объявить FK в schema:

   Обновить `packages/db/src/schema/organization-members.ts`:

   ```ts
   import { inviteLinks } from './invite-links'

   // в pgTable:
   inviteId: integer('invite_id').references(() => inviteLinks.id, { onDelete: 'set null' }),
   ```

   Это приведёт к ALTER TABLE добавлению FK constraint в миграции.

4. **Обновить relations** (`schema/relations.ts`):

   ```ts
   import { inviteLinks } from './invite-links'

   export const inviteLinksRelations = relations(inviteLinks, ({ one, many }) => ({
     organization: one(organizations, {
       fields: [inviteLinks.organizationId],
       references: [organizations.id],
     }),
     createdBy: one(users, {
       fields: [inviteLinks.createdByUserId],
       references: [users.id],
     }),
     usedByMembers: many(organizationMembers),
   }))

   // обновить organizationsRelations:
   export const organizationsRelations = relations(organizations, ({ one, many }) => ({
     owner: one(users, {
       fields: [organizations.ownerUserId],
       references: [users.id],
       relationName: 'owner',
     }),
     members: many(organizationMembers),
     invites: many(inviteLinks),
   }))

   // обновить organizationMembersRelations:
   export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
     organization: one(organizations, {
       fields: [organizationMembers.organizationId],
       references: [organizations.id],
     }),
     user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
     invitedBy: one(users, {
       fields: [organizationMembers.invitedByUserId],
       references: [users.id],
       relationName: 'invitedBy',
     }),
     invite: one(inviteLinks, {
       fields: [organizationMembers.inviteId],
       references: [inviteLinks.id],
     }),
   }))
   ```

5. **Сгенерировать и применить миграцию:**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

## Критерии приёмки

- ✅ Таблица `invite_links` создана
- ✅ Enum `invite_type` с 4 значениями
- ✅ Unique constraint на `token`
- ✅ FK `organization_id → organizations.id` с cascade
- ✅ FK `created_by_user_id → users.id` с restrict (нельзя удалить user, который создал invites — но мы и не удаляем users)
- ✅ FK добавлен в `organization_members.invite_id → invite_links.id` с set null
- ✅ Default `type = 'organization_join'`, `is_revoked = false`, `uses_count = 0`
- ✅ Indexes на org_id и is_revoked созданы
- ✅ Relations работают: можно получить `org.invites`, `member.invite`

## Подсказки

- **token length 32:** nanoid с alphabet 64 даёт ~190 bit entropy для 32 символов. Для invite token этого более чем достаточно. Можно и меньше (10-16 chars), но 32 даёт защиту на годы.
- **`role_to_assign` как text, не enum:** связано с тем, что `member_role` enum уже есть в БД, но добавление FK constraint на enum value Drizzle делает сложно. text + валидация в service слое.
- **`event_id` без FK сейчас:** в Phase 5 добавим ALTER TABLE с FK на events. Сейчас просто integer column.

## Не делать

- ❌ Не хешировать токен — он opaque, защита через unique + revoke механизм
- ❌ Не использовать UUID — короткий nanoid лучше для URLs
- ❌ Не делать индекс на token — unique constraint уже даёт его
- ❌ Не реализовывать event_id / subscription_invite сейчас — только organization_join
