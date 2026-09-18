---
id: '10.1.2'
phase: '10'
epic: '10.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '10.1.1'
estimated_hours: '1'
tags:
  - beta
  - allowlist
  - admin
---

# Task 10.1.2: Управление allowlist + beta-флаг

## Цель

API/механизм управления allowlist (добавить/убрать организатора). Интеграция с super-admin (10.3). Документация beta-флага.

## Контекст

Allowlist нужно пополнять при онбординге нового организатора. Управление — через super-admin (10.3.2) или CLI/seed для MVP. Beta-флаг переключает режим.

## Что должно быть сделано

1. **allowlistService** (modules/beta/ или в organizations):

   ```ts
   export const allowlistService = {
     async add(ctx, telegramId: string, note?: string) {
       return db
         .insert(betaAllowlist)
         .values({ telegramId, note, addedByUserId: ctx.userId })
         .returning()
     },
     async remove(ctx, telegramId: string) {
       return db.delete(betaAllowlist).where(eq(betaAllowlist.telegramId, telegramId))
     },
     async list(ctx) {
       return db.query.betaAllowlist.findMany({ orderBy: (a, { desc }) => [desc(a.createdAt)] })
     },
     async isAllowed(telegramId: string): Promise<boolean> {
       const e = await db.query.betaAllowlist.findFirst({
         where: eq(betaAllowlist.telegramId, telegramId),
       })
       return !!e
     },
   }
   ```

2. **Super-admin endpoints (используются в 10.3.2):**

   ```
   POST /api/admin/allowlist  { telegramId, note }
   DELETE /api/admin/allowlist/:telegramId
   GET /api/admin/allowlist
   ```

   Защита super-admin (10.3.1).

3. **CLI/seed fallback** — для первого организатора (когда super-admin UI ещё нет):

   ```ts
   // scripts/add-to-allowlist.ts — добавить telegram_id вручную
   // или seed в миграции для первых бета-участников
   ```

4. **Документация beta-флага** в DEPLOY.md / runbook:

   ```
   BETA_ALLOWLIST_ENABLED=true  — закрытая бета (allowlist проверяется)
   BETA_ALLOWLIST_ENABLED=false — открытая регистрация (после беты)
   ```

5. **Как узнать telegram_id организатора:** организатор пишет боту → в логах/super-admin видно telegram_id, или организатор сообщает username → резолв. Документировать процесс onboarding (10.5.1).

## Критерии приёмки

- ✅ allowlistService: add, remove, list, isAllowed
- ✅ Super-admin endpoints (защищены 10.3.1)
- ✅ CLI/seed для первого организатора (bootstrap)
- ✅ Beta-флаг документирован
- ✅ Процесс получения telegram_id организатора описан

## Подсказки

- **Bootstrap-проблема:** первого организатора в allowlist некому добавить через UI (super-admin сам должен быть). Решение: seed/CLI для первых, потом через super-admin.
- **telegram_id организатора** — узнаётся когда он пишет боту (logs/super-admin). Или по username (резолв через Telegram API). Onboarding-чеклист (10.5.1) опишет.
- **add до первого входа** — можно добавить telegram_id заранее (организатор сообщил), при первом входе создаст org.

## Не делать

- ❌ Не делать сложный UI (super-admin обзор 10.3 достаточно)
- ❌ Не забыть bootstrap (первый организатор)
- ❌ Не хардкодить telegram_id в коде
