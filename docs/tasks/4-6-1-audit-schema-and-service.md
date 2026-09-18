---
id: '4.6.1'
phase: '4'
epic: '4.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
  - DB
depends_on:
  - '4.1.1'
estimated_hours: '1-2'
tags:
  - audit
  - schema
  - drizzle
---

# Task 4.6.1: Schema audit_log + AuditService

## Цель

Создать таблицу `audit_log` (append-only) и `AuditService.log(...)` для записи всех значимых изменений.

## Контекст

Audit log — это accountability. Решение 9 в phase-card: логируем только изменения, не просмотры. Append-only, никогда не редактируется.

## Что должно быть сделано

1. **`packages/db/src/schema/audit-log.ts`:**

   ```ts
   import { pgTable, serial, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
   import { users } from './users'
   import { organizations } from './organizations'

   export const auditLog = pgTable(
     'audit_log',
     {
       id: serial('id').primaryKey(),
       organizationId: integer('organization_id').references(() => organizations.id, {
         onDelete: 'cascade',
       }),
       userId: integer('user_id')
         .notNull()
         .references(() => users.id, { onDelete: 'set null' }), // actor
       action: text('action').notNull(), // 'organization.created', 'member.blocked', etc.
       entityType: text('entity_type').notNull(), // 'organization', 'member', 'invite'
       entityId: integer('entity_id').notNull(),
       oldValue: jsonb('old_value'),
       newValue: jsonb('new_value'),
       ipAddress: text('ip_address'),
       userAgent: text('user_agent'),
       createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     },
     (t) => ({
       orgCreatedIdx: index('audit_log_org_created_idx').on(t.organizationId, t.createdAt),
       actionIdx: index('audit_log_action_idx').on(t.action),
       entityIdx: index('audit_log_entity_idx').on(t.entityType, t.entityId),
     }),
   )

   export type AuditLogEntry = typeof auditLog.$inferSelect
   export type NewAuditLogEntry = typeof auditLog.$inferInsert
   ```

2. **Обновить `schema/index.ts`:**

   ```ts
   export * from './audit-log'
   ```

3. **Сгенерировать миграцию:**

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Создать модуль `apps/web/modules/audit/`:**

   ```
   apps/web/modules/audit/
   ├── service.ts
   ├── repository.ts
   ├── actions.ts      # каталог actions (см. 4.6.2)
   └── index.ts
   ```

5. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import { auditLog, type AuditLogEntry, type NewAuditLogEntry } from '@volley-time/db'

   export const auditRepository = {
     async create(db: DB, data: NewAuditLogEntry): Promise<AuditLogEntry> {
       const [entry] = await db.insert(auditLog).values(data).returning()
       if (!entry) throw new Error('Failed to create audit log entry')
       return entry
     },
   }
   ```

6. **`service.ts`:**

   ```ts
   import { db as defaultDb } from '@volley-time/db'
   import type { ServiceContext } from '../shared/context'
   import { getDb } from '../shared/context'
   import { auditRepository } from './repository'

   export interface AuditLogParams {
     action: string // e.g. 'organization.created'
     entityType: string
     entityId: number
     oldValue?: Record<string, unknown> | null
     newValue?: Record<string, unknown> | null
     organizationId?: number // optional for platform-level
     ipAddress?: string
     userAgent?: string
   }

   export const auditService = {
     /**
      * Записать audit-событие. Fire-and-forget pattern:
      * ошибки не блокируют основную операцию, но логируются.
      */
     async log(ctx: ServiceContext, params: AuditLogParams): Promise<void> {
       const db = getDb(ctx)
       try {
         await auditRepository.create(db, {
           organizationId: params.organizationId ?? null,
           userId: ctx.userId,
           action: params.action,
           entityType: params.entityType,
           entityId: params.entityId,
           oldValue: params.oldValue ?? null,
           newValue: params.newValue ?? null,
           ipAddress: params.ipAddress ?? null,
           userAgent: params.userAgent ?? null,
         })
       } catch (e) {
         console.error('[audit] failed to write log entry', { params, error: e })
         // НЕ выбрасываем — audit failure не должна ломать business operation
       }
     },

     /**
      * Synchronous wrapper для использования в endpoints где нужна гарантия,
      * но запись остаётся не-блокирующей через .catch.
      */
     logSync(ctx: ServiceContext, params: AuditLogParams): void {
       void this.log(ctx, params)
     },
   }
   ```

7. **`index.ts`:**
   ```ts
   export { auditService } from './service'
   export type { AuditLogParams } from './service'
   export * from './actions' // см. 4.6.2
   ```

## Критерии приёмки

- ✅ Таблица `audit_log` создана через миграцию
- ✅ FK `organization_id → organizations.id` с cascade (при archive org записи остаются, но при физ удалении — каскад)
- ✅ FK `user_id → users.id` с set null (если когда-то user удалён, audit остаётся, но actor становится null)
- ✅ Индексы на (org_id, created_at), action, (entity_type, entity_id)
- ✅ `auditService.log(ctx, params)` создаёт запись
- ✅ Fire-and-forget: если БД-ошибка — main operation не страдает
- ✅ JSONB поля `old_value`/`new_value` корректно хранят объекты

## Подсказки

- **Fire-and-forget паттерн:** в реальной системе audit failure — это серьёзная проблема (compliance). Но для MVP — better availability чем strict audit. Логируем error через `console.error`, в Phase 9+ перенаправляем в Sentry.
- **`organizationId` nullable** — для platform-level actions (например, root admin поднял organization).
- **`entityId` integer** — все entity IDs в нашей схеме — serial integers. Для будущих UUIDs можно сделать text, но в Phase 4 не нужно.

## Не делать

- ❌ Не делать DELETE на audit log — append-only, никогда не редактируется
- ❌ Не делать UPDATE на audit log — то же
- ❌ Не подключать БД-триггеры для авто-логгинга — явный вызов из service более controllable
- ❌ Не складывать sensitive данные (passwords, токены) в audit — фильтровать в `oldValue`/`newValue`
