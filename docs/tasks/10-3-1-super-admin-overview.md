---
id: '10.3.1'
phase: '10'
epic: '10.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - FE
depends_on:
  - '5.2'
  - '6.2'
estimated_hours: '1-2'
tags:
  - beta
  - super-admin
  - overview
---

# Task 10.3.1: Super-admin auth + обзор организаций с метриками

## Цель

Super-admin доступ (по telegram_id из env, вне org-ролей). Обзор всех бета-организаций: название, организатор, дата, метрики активности (события, брони, последняя активность).

## Контекст

Решение 5: лёгкий read-only обзор для ведения беты. Super-admin отдельно от org-ролей (это владелец платформы, не организации). Минимальный, не полная админка.

## Что должно быть сделано

1. **Super-admin auth:**

   ```ts
   // modules/admin/auth.ts
   export function isSuperAdmin(telegramId: string | null): boolean {
     if (!telegramId) return false
     const admins = (process.env.SUPER_ADMIN_TELEGRAM_IDS ?? '').split(',').map((s) => s.trim())
     return admins.includes(telegramId)
   }

   export async function requireSuperAdmin(event: H3Event) {
     const session = await requireAuth(event)
     const user = await db.query.users.findFirst({
       where: eq(users.id, session.userId),
       columns: { telegramId: true },
     })
     if (!isSuperAdmin(user?.telegramId ?? null)) {
       throw createError({ statusCode: 403, statusMessage: 'Super admin only' })
     }
     return session
   }
   ```

   SUPER_ADMIN_TELEGRAM_IDS в env (твой telegram_id).

2. **Обзор endpoint `apps/web/server/api/admin/beta-overview.get.ts`:**

   ```ts
   export default defineEventHandler(async (event) => {
     await requireSuperAdmin(event)
     const orgs = await db.query.organizations.findMany({
       where: ne(organizations.status, 'archived'),
       orderBy: (o, { desc }) => [desc(o.createdAt)],
     })

     const overview = await Promise.all(
       orgs.map(async (org) => {
         const [eventsCount, bookingsCount, lastEvent, balance] = await Promise.all([
           countEvents(org.id),
           countBookings(org.id),
           lastEventDate(org.id),
           ledgerService.getBalance({ system: true }, org.id), // системный доступ
         ])
         return {
           id: org.id,
           name: org.name,
           createdAt: org.createdAt,
           eventsCount,
           bookingsCount,
           lastActivity: lastEvent,
           balance: balance.balance,
         }
       }),
     )
     return { organizations: overview }
   })
   ```

3. **Super-admin страница `pages/admin/index.vue`** (простой список):

   ```vue
   <!-- таблица бета-организаций: название, организатор, события, брони, посл. активность, баланс -->
   <!-- доступна только super-admin (редирект иначе) -->
   ```

   Минимальная вёрстка (это служебный экран, не для пользователей).

4. **Системный доступ к данным:** super-admin читает данные разных org. ServiceContext должен поддерживать «системный» режим (read-only, без org-membership проверки) ИЛИ отдельные репозиторий-методы для admin. Не нарушать tenant-изоляцию для обычных запросов — только super-admin обходит.

5. **Read-only** — super-admin наблюдает, не редактирует данные организаций (кроме allowlist 10.3.2).

## Критерии приёмки

- ✅ isSuperAdmin по telegram_id из env
- ✅ requireSuperAdmin guard (403 для не-админов)
- ✅ Обзор: список org с метриками (события, брони, посл. активность, баланс)
- ✅ Super-admin страница (список, read-only)
- ✅ Системный доступ не нарушает обычную tenant-изоляцию
- ✅ Только super-admin (обычные пользователи 403)

## Подсказки

- **Super-admin ВНЕ org-ролей** — это владелец платформы, видит все организации. Не путать с org owner (владелец одной org). По telegram_id в env.
- **Системный доступ аккуратно** — super-admin обходит tenant-изоляцию (4.5.1) для обзора. Реализовать явным admin-репозиторием или system-флагом в ServiceContext, НЕ ослабляя обычные проверки.
- **Read-only** — наблюдение, не вмешательство. Управление только allowlist (10.3.2).
- **Простая вёрстка** — служебный экран для тебя, не для пользователей. Функция > красота.

## Не делать

- ❌ Не делать полную админ-панель (только обзор беты)
- ❌ Не ослаблять tenant-изоляцию для обычных запросов
- ❌ Не давать редактирование чужих данных
- ❌ Не хардкодить super-admin id (env)
