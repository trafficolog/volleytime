---
id: '10.1.1'
phase: '10'
epic: '10.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
  - DB
depends_on:
  - '4.1'
estimated_hours: '1-2'
tags:
  - beta
  - access-control
  - allowlist
---

# Task 10.1.1: Allowlist schema/механизм + проверка при создании org

## Цель

Механизм allowlist: создание организации разрешено только allowlisted пользователям (по telegram_id). Проверка в organizationService.create.

## Контекст

Решение 3: контролируемый рост беты. Новые организации создают только приглашённые. Игроки (присоединение по org-invite, Phase 4) НЕ ограничены.

## Что должно быть сделано

1. **Таблица `beta_allowlist` `packages/db/src/schema/beta-allowlist.ts`:**

   ```ts
   import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core'
   import { users } from './users'

   export const betaAllowlist = pgTable('beta_allowlist', {
     id: serial('id').primaryKey(),
     telegramId: text('telegram_id').notNull().unique(), // кого пускаем создавать org
     note: text('note'), // кто это (имя организатора, для памяти)
     addedByUserId: integer('added_by_user_id').references(() => users.id),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   })

   export type BetaAllowlistEntry = typeof betaAllowlist.$inferSelect
   ```

2. **Schema index + миграция.**

3. **Beta-флаг (env):**

   ```ts
   // если BETA_ALLOWLIST_ENABLED=false — allowlist не проверяется (открытая регистрация)
   const betaEnabled = process.env.BETA_ALLOWLIST_ENABLED === 'true'
   ```

4. **Проверка в organizationService.create (Phase 4.1):**

   ```ts
   import { betaAllowlist } from '@volley-time/db'
   import { eq } from 'drizzle-orm'

   async create(ctx, input) {
     // beta gate: проверка allowlist
     if (isBetaAllowlistEnabled()) {
       const user = await db.query.users.findFirst({
         where: eq(users.id, ctx.userId), columns: { telegramId: true },
       })
       const allowed = user?.telegramId
         ? await db.query.betaAllowlist.findFirst({ where: eq(betaAllowlist.telegramId, user.telegramId) })
         : null
       if (!allowed) {
         throw new OrganizationError('organization.beta_not_allowed',
           'Создание организаций доступно по приглашению в закрытом бета-тесте')
       }
     }
     // ... обычное создание (4.1)
   }
   ```

5. **Error code** в handle-errors: `organization.beta_not_allowed` → 403.

6. **allowlist репозиторий** (для super-admin 10.3.2): add, remove, list.

7. **Тесты:**
   ```ts
   test('allowlisted user creates org', async () => {})
   test('non-allowlisted user → beta_not_allowed', async () => {})
   test('beta disabled → anyone creates org', async () => {})
   test('player joins org via invite regardless of allowlist', async () => {})
   ```

## Критерии приёмки

- ✅ Таблица beta_allowlist (telegram_id unique, note)
- ✅ organizationService.create проверяет allowlist (если beta enabled)
- ✅ Не-allowlisted → 403 beta_not_allowed (понятное сообщение)
- ✅ Allowlisted → создаёт нормально
- ✅ Beta-флаг: BETA_ALLOWLIST_ENABLED=false → проверка выключена
- ✅ Игроки (org-invite, Phase 4) НЕ ограничены
- ✅ Тесты

## Подсказки

- **Проверка ТОЛЬКО на create org** — не на join (игроки свободны по invite, Phase 4.4). Бета ограничивает рост организаций, не участников.
- **telegram_id как ключ** — организаторы приходят через Telegram (Phase 8). allowlist по telegram_id, добавляется до их первого входа.
- **Beta-флаг** — при выходе из беты ставим false, allowlist перестаёт ограничивать. Без удаления кода.
- **note поле** — «Сергей, волейбол Витебск» — чтобы помнить кто есть кто в allowlist.

## Не делать

- ❌ Не ограничивать join игроков
- ❌ Не хардкодить список (таблица)
- ❌ Не делать сложные роли беты
