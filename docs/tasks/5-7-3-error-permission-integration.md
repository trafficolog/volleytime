---
id: '5.7.3'
phase: '5'
epic: '5.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '5.7.1'
  - '5.7.2'
estimated_hours: '1-2'
tags:
  - api
  - errors
  - permissions
---

# Task 5.7.3: Error handling + permission integration

## Цель

Финализировать `handleServiceError` со всеми Phase 5 error codes. Убедиться что permissions согласованы во всех endpoints. Единый каталог HTTP-статусов.

## Контекст

За Phase 5 накопилось много error-классов (Venue, Event, Booking, Subscription, Plan). Нужно собрать всё в один handle-errors и проверить консистентность permission-проверок.

## Что должно быть сделано

1. **Полный `apps/web/server/utils/handle-errors.ts`:**

   ```ts
   import { ZodError } from 'zod'
   import { ForbiddenError } from '~/modules/permissions'
   import { OrganizationError } from '~/modules/organizations'
   import { MemberError } from '~/modules/members'
   import { InviteError } from '~/modules/invites'
   import { VenueError } from '~/modules/venues'
   import { EventError } from '~/modules/events'
   import { BookingError } from '~/modules/bookings'
   import { SubscriptionError } from '~/modules/subscriptions'
   import { PlanError } from '~/modules/subscription-plans'

   const codeToStatus: Record<string, number> = {
     // permissions
     'permission.not_member': 403,
     'permission.not_owner': 403,
     'permission.cannot_manage_members': 403,
     'permission.cannot_manage_content': 403,
     'permission.cannot_invite': 403,
     'permission.cannot_view_audit': 403,
     'permission.org_archived': 410,
     'permission.org_suspended': 403,
     'permission.blocked': 403,
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
     // invites
     'invite.not_found': 404,
     'invite.revoked': 410,
     'invite.expired': 410,
     'invite.uses_exhausted': 410,
     'invite.already_used_by_user': 409,
     // venues
     'venue.not_found': 404,
     // events
     'event.not_found': 404,
     'event.not_published': 409,
     'event.cancelled': 410,
     'event.capacity_below_confirmed': 422,
     'event.venue_org_mismatch': 422,
     // bookings
     'booking.already_booked': 409,
     'booking.event_not_bookable': 409,
     'booking.deadline_passed': 422,
     'booking.no_active_subscription': 422,
     'booking.not_found': 404,
     'booking.cannot_cancel_others': 403,
     'booking.cannot_mark_attendance': 422,
     // subscriptions
     'subscription.not_found': 404,
     'subscription.plan_not_available': 422,
     'subscription.no_active': 422,
     // plans
     'plan.not_found': 404,
   }

   const KNOWN_ERRORS = [
     ForbiddenError,
     OrganizationError,
     MemberError,
     InviteError,
     VenueError,
     EventError,
     BookingError,
     SubscriptionError,
     PlanError,
   ]

   export function handleServiceError(e: unknown): never {
     if (e instanceof ZodError) {
       throw createError({
         statusCode: 422,
         statusMessage: 'Validation error',
         data: { errors: e.errors },
       })
     }
     // h3 errors (createError) — пробрасываем как есть
     if (e && typeof e === 'object' && 'statusCode' in e) {
       throw e
     }
     for (const ErrClass of KNOWN_ERRORS) {
       if (e instanceof ErrClass) {
         const code = (e as { code: string }).code
         throw createError({
           statusCode: codeToStatus[code] ?? 400,
           statusMessage: (e as Error).message,
           data: { code },
         })
       }
     }
     // Неизвестная ошибка — 500, логируем
     console.error('[unhandled service error]', e)
     throw createError({ statusCode: 500, statusMessage: 'Internal error' })
   }
   ```

2. **Permission матрица (проверить все endpoints):**

   | Endpoint                 | Permission                         |
   | ------------------------ | ---------------------------------- |
   | venues GET               | requireOrgMember                   |
   | venues POST/PATCH/DELETE | requireCanManageContent            |
   | events GET               | requireOrgMember                   |
   | events POST/PATCH/cancel | requireCanManageContent            |
   | events/:id/book          | requireOrgMember                   |
   | bookings/:id DELETE      | requireOrgMember (+ byAdmin logic) |
   | my/bookings GET          | requireOrgMember                   |
   | events/:id/bookings GET  | requireCanManageContent            |
   | bookings/:id/attendance  | requireCanManageContent            |
   | plans GET                | requireOrgMember                   |
   | plans POST/PATCH/DELETE  | requireCanManageContent            |
   | subscriptions POST       | requireOrgMember                   |
   | my/subscriptions GET     | requireOrgMember                   |

3. **Тест error mapping** (`__tests__/error-mapping.test.ts`):
   ```ts
   // unit: каждый error-класс → правильный HTTP статус
   test('BookingDeadlinePassedError → 422', () => {
     /* ... */
   })
   test('unknown error → 500', () => {})
   test('h3 createError passes through', () => {})
   ```

## Критерии приёмки

- ✅ handle-errors покрывает все Phase 5 error codes
- ✅ Неизвестные ошибки → 500 + лог (не утечка деталей)
- ✅ h3 createError пробрасывается без двойной обёртки
- ✅ Permission матрица соблюдена во всех endpoints
- ✅ ZodError → 422 с errors
- ✅ Тесты error mapping проходят

## Подсказки

- **h3 passthrough:** endpoints иногда сами кидают createError (404 cross-org). Не оборачивать их повторно — проверка `'statusCode' in e`.
- **Loop по KNOWN_ERRORS** — избегаем длинной цепочки if-instanceof. Расширяемо.
- **500 без деталей** — безопасность. Детали в логи (Sentry в Phase 9).

## Не делать

- ❌ Не возвращать stack traces клиенту
- ❌ Не делать i18n сообщений (Phase 8+, UI переводит по code)
