---
id: '4.5.2'
phase: '4'
epic: '4.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '4.5.1'
estimated_hours: '1-2'
tags:
  - typescript
  - service
  - patterns
---

# Task 4.5.2: ServiceContext type + utility

## Цель

Унифицировать тип `ServiceContext` для всех модулей. Создать утилиту для конструирования context из event (для endpoints) и для tests.

## Контекст

В 4.1.2 и 4.2.2 у каждого модуля свой `ServiceContext`. Нужно вытащить в общий пакет / shared location, чтобы:

1. Один источник правды
2. Easy import: `import { type ServiceContext } from '~/modules/shared/context'`
3. Утилита `createServiceContextFromEvent(event)` для endpoints

## Что должно быть сделано

1. **Создать `apps/web/modules/shared/context.ts`:**

   ```ts
   import type { Organization, OrganizationMember } from '@volley-time/db'
   import { db as defaultDb } from '@volley-time/db'
   import type { H3Event } from 'h3'

   /**
    * ServiceContext is passed to every service function.
    *
    * - `userId` — id of the authenticated user performing the action
    * - `db` — optional, defaults to global db. Override in tests or transactions.
    * - `organization` — optional, populated by tenant middleware for org-scoped operations
    * - `member` — optional, populated by tenant middleware
    */
   export interface ServiceContext {
     userId: number
     db?: typeof defaultDb
     organization?: Organization
     member?: OrganizationMember
   }

   /**
    * Construct ServiceContext from an authenticated H3 event.
    * Assumes tenant middleware has already populated context.
    *
    * Throws if user is not in context (i.e., not authenticated).
    */
   export function createServiceContextFromEvent(event: H3Event): ServiceContext {
     const user = event.context.user
     if (!user) {
       throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
     }
     return {
       userId: user.id,
       organization: event.context.organization,
       member: event.context.member,
     }
   }
   ```

2. **Обновить `apps/web/modules/organizations/service.ts`** — использовать общий тип:

   ```ts
   import type { ServiceContext } from '../shared/context'
   import { db as defaultDb } from '@volley-time/db'

   // Удалить локальный interface ServiceContext
   // Использовать импортированный
   ```

   Аналогично для `members/service.ts`, `invites/service.ts` и всех будущих модулей.

3. **Helper `getDb` для transparent default:**

   ```ts
   // apps/web/modules/shared/context.ts (продолжение)

   export function getDb(ctx: ServiceContext): typeof defaultDb {
     return ctx.db ?? defaultDb
   }
   ```

   Использование:

   ```ts
   import { getDb } from '../shared/context'

   async create(ctx: ServiceContext, input: ...) {
     const db = getDb(ctx)
     // ...
   }
   ```

4. **Refactor endpoints** для использования `createServiceContextFromEvent`:

   ```ts
   // Было:
   const org = await organizationService.create({ userId: event.context.user.id }, body)

   // Стало:
   const ctx = createServiceContextFromEvent(event)
   const org = await organizationService.create(ctx, body)
   ```

5. **Тесты** (`apps/web/modules/shared/__tests__/context.test.ts`):
   ```ts
   import { describe, test, expect } from 'vitest'
   import type { H3Event } from 'h3'
   import { createServiceContextFromEvent } from '../context'

   describe('createServiceContextFromEvent', () => {
     test('throws if no user in context', () => {
       const event = { context: {} } as H3Event
       expect(() => createServiceContextFromEvent(event)).toThrow()
     })

     test('returns context with userId', () => {
       const event = {
         context: { user: { id: 42 } },
       } as unknown as H3Event
       const ctx = createServiceContextFromEvent(event)
       expect(ctx.userId).toBe(42)
     })

     test('passes through org and member', () => {
       const event = {
         context: {
           user: { id: 1 },
           organization: { id: 100 } as any,
           member: { id: 200, role: 'owner' } as any,
         },
       } as unknown as H3Event
       const ctx = createServiceContextFromEvent(event)
       expect(ctx.organization?.id).toBe(100)
       expect(ctx.member?.id).toBe(200)
     })
   })
   ```

## Критерии приёмки

- ✅ Создан `apps/web/modules/shared/context.ts` с типом `ServiceContext`
- ✅ Все service модули используют общий тип (organizations, members, invites)
- ✅ `createServiceContextFromEvent(event)` корректно конструирует context из H3Event
- ✅ Если user не в context → throws 401
- ✅ org/member пробрасываются (могут быть undefined для non-tenant routes)
- ✅ `getDb(ctx)` возвращает ctx.db или default
- ✅ Endpoints рефакторятся для использования утилиты
- ✅ Unit-тесты проходят

## Подсказки

- **Зачем общий тип:** избегаем drift'а между модулями (один добавит поле, второй забудет).
- **`getDb(ctx)`** — синтаксическая обёртка. Можно и без неё писать `const db = ctx.db ?? defaultDb`, но `getDb(ctx)` — короче и testable (можно замокать).
- **TypeScript optional chaining:** `event.context.user?.id` лучше чем `event.context.user.id` если есть шанс что user не задан.

## Не делать

- ❌ Не делать `ServiceContext` как class — interface + утилиты простее
- ❌ Не добавлять requestId/traceId — Phase 14+ (observability)
- ❌ Не позволять mutability ctx.db в нескольких местах — это путь к багам в transactions
