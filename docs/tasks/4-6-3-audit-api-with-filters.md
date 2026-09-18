---
id: '4.6.3'
phase: '4'
epic: '4.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '4.6.1'
  - '4.5.1'
  - '4.3.1'
estimated_hours: '1'
tags:
  - api
  - audit
---

# Task 4.6.3: API endpoint аудит-лога с фильтрами и pagination

## Цель

Endpoint `GET /api/organizations/:orgId/audit` для просмотра audit log организации. Только owner. С фильтрами: по action, user, date range. Pagination.

## Контекст

Owner должен иметь возможность посмотреть, кто что делал в его организации. Endpoint с фильтрами и pagination. Только owner (через requireCanViewAudit).

## Что должно быть сделано

1. **Repository расширить (`apps/web/modules/audit/repository.ts`):**

   ```ts
   import { auditLog, type AuditLogEntry } from '@volley-time/db'
   import { eq, and, gte, lte, inArray, desc, sql } from 'drizzle-orm'

   export interface ListAuditParams {
     organizationId: number
     actions?: string[]
     userId?: number
     dateFrom?: Date
     dateTo?: Date
     limit?: number
     offset?: number
   }

   export const auditRepository = {
     // ... existing create

     async listByOrg(
       db: DB,
       params: ListAuditParams,
     ): Promise<{ entries: AuditLogEntry[]; total: number }> {
       const conditions = [eq(auditLog.organizationId, params.organizationId)]

       if (params.actions?.length) {
         conditions.push(inArray(auditLog.action, params.actions))
       }
       if (params.userId) {
         conditions.push(eq(auditLog.userId, params.userId))
       }
       if (params.dateFrom) {
         conditions.push(gte(auditLog.createdAt, params.dateFrom))
       }
       if (params.dateTo) {
         conditions.push(lte(auditLog.createdAt, params.dateTo))
       }

       const where = and(...conditions)
       const limit = Math.min(params.limit ?? 50, 200)
       const offset = params.offset ?? 0

       const [entries, totalRows] = await Promise.all([
         db.query.auditLog.findMany({
           where,
           orderBy: [desc(auditLog.createdAt)],
           limit,
           offset,
         }),
         db
           .select({ count: sql<number>`count(*)::int` })
           .from(auditLog)
           .where(where),
       ])

       const total = totalRows[0]?.count ?? 0
       return { entries, total }
     },
   }
   ```

2. **Service метод (`apps/web/modules/audit/service.ts`):**

   ```ts
   // в auditService:
   async listByOrg(
     ctx: ServiceContext,
     orgId: number,
     filters: Omit<ListAuditParams, 'organizationId'> = {},
   ) {
     const db = getDb(ctx)
     return auditRepository.listByOrg(db, { organizationId: orgId, ...filters })
   },
   ```

3. **Endpoint `apps/web/server/api/organizations/[orgId]/audit/index.get.ts`:**

   ```ts
   import { z } from 'zod'
   import { auditService } from '~/modules/audit'
   import { requireCanViewAudit } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   const QuerySchema = z.object({
     actions: z.string().optional(),
     userId: z.coerce.number().int().positive().optional(),
     dateFrom: z.coerce.date().optional(),
     dateTo: z.coerce.date().optional(),
     limit: z.coerce.number().int().min(1).max(200).default(50),
     offset: z.coerce.number().int().min(0).default(0),
   })

   export default defineEventHandler(async (event) => {
     try {
       requireCanViewAudit(event.context.member)
       const query = QuerySchema.parse(getQuery(event))

       const ctx = createServiceContextFromEvent(event)
       const { entries, total } = await auditService.listByOrg(
         ctx,
         event.context.organization!.id,
         {
           actions: query.actions ? query.actions.split(',') : undefined,
           userId: query.userId,
           dateFrom: query.dateFrom,
           dateTo: query.dateTo,
           limit: query.limit,
           offset: query.offset,
         },
       )

       return {
         entries,
         pagination: {
           total,
           limit: query.limit,
           offset: query.offset,
           hasMore: query.offset + entries.length < total,
         },
       }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

4. **Тест:**
   ```ts
   describe('audit list with filters (integration)', () => {
     // Создать 3 различных action в БД через auditService.log
     // Запросить с фильтром по action — получить только 1 матч
     // Запросить с datRange — получить только в этом периоде
     // Pagination: limit=2 → entries.length=2, hasMore=true
   })
   ```

## Критерии приёмки

- ✅ `GET /api/organizations/:orgId/audit` — только owner (через `requireCanViewAudit`)
- ✅ Возвращает entries отсортированные desc по createdAt
- ✅ Фильтр `?actions=organization.created,member.joined` — список через запятую
- ✅ Фильтр `?userId=42` — только actions этого actor
- ✅ Фильтр `?dateFrom=2026-01-01&dateTo=2026-12-31` — range
- ✅ Pagination: `?limit=20&offset=0`. Max limit 200
- ✅ Response содержит `pagination: { total, limit, offset, hasMore }`
- ✅ Validation error → 422 с понятным сообщением

## Подсказки

- **`z.coerce.date()`** — превращает query string в Date. Поддерживает ISO 8601 формат.
- **count query** — отдельный запрос для total. Можно объединить через CTE или window function для оптимизации (но в MVP — два простых запроса OK).
- **Max limit 200** — защита от DOS (огромный запрос). Если user'у нужно больше — paginate.

## Не делать

- ❌ Не делать cursor-based pagination — для audit log offset-pagination достаточен (редко больше нескольких страниц назад)
- ❌ Не делать export to CSV — Phase 14+
- ❌ Не делать full-text search в old_value/new_value — Phase 14+
- ❌ Не отдавать данные blocked member'у — middleware (4.5.1) уже блокирует
