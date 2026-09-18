---
id: '5.4.2'
phase: '5'
epic: '5.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
depends_on:
  - '5.4.1'
  - '4.5.1'
estimated_hours: '1'
tags:
  - api
  - subscription-plans
---

# Task 5.4.2: Subscription plan API endpoints + permissions

## Цель

REST endpoints под `/api/organizations/:orgId/subscription-plans`. Чтение — любой member (игроки видят что можно купить), мутации — owner/organizer.

## Контекст

Тонкие обёртки. Игроки должны видеть планы (чтобы «купить»), поэтому GET доступен всем member. Управление — owner/organizer.

## Что должно быть сделано

1. **`subscription-plans/index.get.ts`** — список (requireOrgMember):

   ```ts
   requireOrgMember(event.context.member)
   const ctx = createServiceContextFromEvent(event)
   const plans = await subscriptionPlanService.list(ctx, event.context.organization!.id)
   return { plans }
   ```

2. **`subscription-plans/index.post.ts`** — создать (requireCanManageContent).

3. **`subscription-plans/[planId]/index.patch.ts`** — обновить (requireCanManageContent, org ownership check).

4. **`subscription-plans/[planId]/index.delete.ts`** — archive (requireCanManageContent, org ownership check).

5. **handle-errors** — PlanError: `plan.not_found` → 404.

## Критерии приёмки

- ✅ GET plans — любой active member
- ✅ POST/PATCH/DELETE — owner/organizer (403 для player)
- ✅ Cross-org: plan чужой org → 404
- ✅ DELETE = archive
- ✅ Ошибки маппятся

## Подсказки

- **Игроки видят планы** — это намеренно. Player GET нужен для UI «купить абонемент» (5.11).
- **canManageContent** переиспользуется (определена в 5.1.2).

## Не делать

- ❌ Не делать UI — 5.11
- ❌ Не делать pagination (планов мало)
