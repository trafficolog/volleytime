---
id: '4.1.3'
phase: '4'
epic: '4.1'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
depends_on:
  - '4.1.2'
  - '4.5.1'
estimated_hours: '1-2'
tags:
  - api
  - nuxt
  - organizations
---

# Task 4.1.3: API endpoints для organizations

## Цель

Создать Nuxt server routes для CRUD операций над organizations.

## Контекст

API — тонкая обёртка над `organizationService`. Endpoints обрабатывают: парсинг input, вызов сервиса, обработка ошибок, формирование response.

`/api/organizations/:orgId/*` routes используют tenant middleware (4.5.1) — orgId парсится, org и member прокидываются в `event.context`.

## Что должно быть сделано

1. **`apps/web/server/api/organizations/index.post.ts`** — создать org:

   ```ts
   import { organizationService } from '~/modules/organizations'
   import { requireAuth } from '~/server/utils/auth'

   export default defineEventHandler(async (event) => {
     const user = await requireAuth(event)
     const body = await readBody(event)
     const org = await organizationService.create({ userId: user.id }, body)
     return { organization: org }
   })
   ```

2. **`apps/web/server/api/organizations/index.get.ts`** — список org user'а:

   ```ts
   export default defineEventHandler(async (event) => {
     const user = await requireAuth(event)
     const orgs = await organizationService.listForUser({ userId: user.id })
     return { organizations: orgs }
   })
   ```

3. **`apps/web/server/api/organizations/[orgId]/index.get.ts`** — детали org:

   ```ts
   export default defineEventHandler(async (event) => {
     // tenant middleware (4.5.1) уже проверил access и наполнил context
     const org = event.context.organization
     const member = event.context.member
     return { organization: org, myMember: member }
   })
   ```

4. **`apps/web/server/api/organizations/[orgId]/index.patch.ts`** — обновить settings:

   ```ts
   export default defineEventHandler(async (event) => {
     const org = event.context.organization
     const user = event.context.user
     // Permission check via requireOrgRole (4.3)
     requireOrgOwner(user, event.context.member)
     const body = await readBody(event)
     const updated = await organizationService.updateSettings({ userId: user.id }, org.id, body)
     return { organization: updated }
   })
   ```

5. **`apps/web/server/api/organizations/[orgId]/archive.post.ts`** — archive:

   ```ts
   export default defineEventHandler(async (event) => {
     const org = event.context.organization
     const user = event.context.user
     requireOrgOwner(user, event.context.member)
     const archived = await organizationService.archive({ userId: user.id }, org.id)
     return { organization: archived }
   })
   ```

6. **`apps/web/server/utils/auth.ts`** — helper:

   ```ts
   import { auth } from '@volley-time/auth'

   export async function requireAuth(event: H3Event) {
     const session = await auth.api.getSession({
       headers: getHeaders(event),
     })
     if (!session?.user) {
       throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
     }
     return session.user
   }
   ```

7. **Error handler** — глобальный для красивых JSON ответов:

   ```ts
   // apps/web/server/middleware/error-handler.ts (или через nitro error hooks)
   import { OrganizationError } from '~/modules/organizations'
   import { ZodError } from 'zod'

   export default defineEventHandler((event) => {
     // обработка происходит через nitro hooks, см. nuxt docs
   })
   ```

   Простой подход через try/catch в endpoints (более явный):

   ```ts
   try {
     // ... service call
   } catch (e) {
     if (e instanceof OrganizationNotFoundError) {
       throw createError({ statusCode: 404, statusMessage: e.message, data: { code: e.code } })
     }
     if (e instanceof ZodError) {
       throw createError({
         statusCode: 422,
         statusMessage: 'Validation error',
         data: { errors: e.errors },
       })
     }
     throw e
   }
   ```

   Лучше — wrapped helper:

   ```ts
   // apps/web/server/utils/handle-errors.ts
   export function handleServiceError(e: unknown): never {
     if (e instanceof ZodError) {
       throw createError({
         statusCode: 422,
         statusMessage: 'Validation error',
         data: { errors: e.errors },
       })
     }
     if (e instanceof OrganizationError) {
       const statusMap: Record<string, number> = {
         'organization.not_found': 404,
         'organization.archived': 410,
         'organization.slug_taken': 409,
       }
       throw createError({
         statusCode: statusMap[e.code] ?? 400,
         statusMessage: e.message,
         data: { code: e.code },
       })
     }
     throw e
   }
   ```

## Критерии приёмки

- ✅ `POST /api/organizations` — создаёт org, требует auth, возвращает 201 (через createError или status code)
- ✅ `GET /api/organizations` — возвращает массив org текущего user'а
- ✅ `GET /api/organizations/:orgId` — детали org. 404 если нет, 403 если не член
- ✅ `PATCH /api/organizations/:orgId` — только owner. 403 для других ролей
- ✅ `POST /api/organizations/:orgId/archive` — только owner. Идемпотентно (повторный вызов — same result)
- ✅ Ошибки возвращаются с правильными HTTP статусами и понятными `data.code`
- ✅ Zod validation errors → 422
- ✅ Unauth → 401, forbidden → 403, not found → 404, archived → 410, conflict → 409

## Подсказки

- **`event.context.organization` и `event.context.member`** — наполняются tenant middleware (4.5.1). Если middleware не настроен, endpoints упадут с undefined.
- **`requireOrgOwner`** — функция из permissions module (4.3.1). Если ещё не реализован — временно встрой логику inline, потом отрефакторишь.
- **HTTP status codes для DDD ошибок:**
  - 404 not_found (ресурс не существует)
  - 410 gone (existed, теперь archived)
  - 409 conflict (slug taken, race condition)
  - 422 unprocessable (validation)
  - 403 forbidden (auth есть, но нет прав)

## Не делать

- ❌ Не делать GraphQL — простой REST достаточен
- ❌ Не делать pagination на listForUser — обычно у user < 10 org
- ❌ Не делать filtering / sorting на этом этапе — простые list endpoints
- ❌ Не возвращать слишком много полей — только то что нужно UI (Phase 8 оптимизация)
