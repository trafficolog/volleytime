---
id: '4.3.2'
phase: '4'
epic: '4.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '4.3.1'
estimated_hours: '1'
tags:
  - errors
  - security
---

# Task 4.3.2: ForbiddenError + интеграция с error handler

## Цель

Интегрировать `ForbiddenError` из permissions module в глобальный error handler. Все permission ошибки должны возвращаться как HTTP 403 с понятным JSON body.

## Контекст

В 4.3.1 создан `ForbiddenError`. Теперь нужно убедиться, что когда какой-нибудь API endpoint выбрасывает его (через requireX) — клиент получает корректный 403 response с code и message.

## Что должно быть сделано

1. **Расширить `handleServiceError` в `apps/web/server/utils/handle-errors.ts`:**

   ```ts
   import { ForbiddenError } from '~/modules/permissions'
   // ... existing imports

   const codeToStatus: Record<string, number> = {
     // organizations
     'organization.not_found': 404,
     'organization.archived': 410,
     'organization.slug_taken': 409,
     // members
     'member.already_exists': 409,
     'member.not_found': 404,
     'member.cannot_block_owner': 400,
     'member.cannot_demote_owner': 400,
     'member.owner_cannot_leave': 400,
     // permissions
     'permission.not_member': 403,
     'permission.not_owner': 403,
     'permission.cannot_manage_members': 403,
     'permission.cannot_invite': 403,
     'permission.cannot_view_audit': 403,
     'permission.org_not_found': 404,
     'permission.org_archived': 410,
     'permission.org_suspended': 403,
   }

   export function handleServiceError(e: unknown): never {
     if (e instanceof ZodError) {
       throw createError({
         statusCode: 422,
         statusMessage: 'Validation error',
         data: { errors: e.errors },
       })
     }
     if (e instanceof ForbiddenError) {
       throw createError({
         statusCode: codeToStatus[e.code] ?? 403,
         statusMessage: e.message,
         data: { code: e.code },
       })
     }
     if (e instanceof OrganizationError || e instanceof MemberError) {
       throw createError({
         statusCode: codeToStatus[e.code] ?? 400,
         statusMessage: e.message,
         data: { code: e.code },
       })
     }
     throw e
   }
   ```

2. **Альтернатива — глобальный nitro error hook** (`apps/web/server/plugins/error-handler.ts`):

   ```ts
   import { ForbiddenError } from '~/modules/permissions'
   import { OrganizationError } from '~/modules/organizations'
   import { MemberError } from '~/modules/members'
   import { ZodError } from 'zod'

   export default defineNitroPlugin((nitroApp) => {
     nitroApp.hooks.hook('error', (error, { event }) => {
       // Логирование (для observability)
       if (error instanceof ForbiddenError) {
         console.warn(`[permission denied] ${error.code}: ${error.message}`, {
           path: event?.path,
         })
       }
     })
   })
   ```

   Глобальный hook опционален — основная обработка через `handleServiceError`.

3. **Обновить endpoints, чтобы они оборачивали в try/catch:**

   Каждый endpoint из 4.1.3 и 4.2.3, который вызывает service или permission check, должен обернуть в try/catch:

   ```ts
   try {
     requireOrgOwner(event.context.member)
     // ... service call
   } catch (e) {
     return handleServiceError(e)
   }
   ```

   Или сделать утилиту-обёртку:

   ```ts
   // apps/web/server/utils/safe-handler.ts
   import { handleServiceError } from './handle-errors'

   export function safeHandler<T>(handler: (event: H3Event) => Promise<T>) {
     return defineEventHandler(async (event) => {
       try {
         return await handler(event)
       } catch (e) {
         return handleServiceError(e)
       }
     })
   }
   ```

   Использование:

   ```ts
   export default safeHandler(async (event) => {
     requireOrgOwner(event.context.member)
     // ... logic
   })
   ```

## Критерии приёмки

- ✅ `ForbiddenError` ловится в `handleServiceError`
- ✅ Возвращается HTTP 403 с JSON `{ statusCode: 403, statusMessage: '...', data: { code: 'permission.not_owner' } }`
- ✅ Каждый permission code маппится в правильный HTTP status
- ✅ В логах permission denials фиксируются (для observability)
- ✅ Endpoints не падают с непонятным 500 — все ожидаемые ошибки обрабатываются
- ✅ Тест: GET `/api/organizations/123/audit` не-owner'ом → 403 + `data.code === 'permission.cannot_view_audit'`

## Подсказки

- **Тест permissions в API:** можно написать integration-test, который имитирует роли (создать org, добавить players, попробовать запрещённые операции, проверить 403).
- **Logging:** не логируй stack trace для ForbiddenError — это ожидаемая ошибка, не баг. Только метаданные.
- **Discriminating errors by `instanceof`:** работает только если ошибки приходят из того же module instance. В monorepo это нормально, но при сложном tree-shaking может ломаться. Альтернатива — проверка по `error.name === 'ForbiddenError'`.

## Не делать

- ❌ Не возвращать stack traces клиенту — security risk
- ❌ Не делать кастомные HTTP-коды кроме стандартных (200, 400, 401, 403, 404, 409, 410, 422, 500)
- ❌ Не логировать sensitive данные (passwords, токены) даже на permission denied
