---
id: '5.4'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Планы абонементов per-org. Могут быть бесплатными.'
estimated_hours: '3-4'
depends_on: ['4.5']
---

# Epic 5.4: Subscription plans CRUD

**Цель.** Реализовать `SubscriptionPlan` — шаблон абонемента, scoped by organization. Owner создаёт планы (например «8 тренировок за 80 BYN, действует 60 дней»).

## Контекст

Решение 8: планы scoped by org, глобальных нет. Решение 11: plan = total_sessions (обязательно) + validity_days (опционально) + price. Цена может быть 0 (бесплатные планы для госорганизаций — сервис как организационная поддержка).

Plan — это шаблон. Купленный игроком абонемент — это Subscription (эпик 5.5), создаётся на основе plan.

## Definition of Done

- Drizzle schema `subscription_plans` (org-scoped)
- Поля: name, total_sessions, validity_days (nullable), price, currency, is_active, description
- SubscriptionPlanService: create, list, getById, update, archive
- API endpoints под `/api/organizations/:orgId/subscription-plans`
- Permission: owner/organizer
- price может быть 0 (бесплатный план)
- Archived plan нельзя купить, но существующие subscriptions на его основе продолжают работать
- Audit + smoke-тесты

## Задачи

| ID    | Задача                              | Часов |
| ----- | ----------------------------------- | ----: |
| 5.4.1 | Schema subscription_plans + Service |   1-2 |
| 5.4.2 | API endpoints + permissions         |     1 |

## Не делать

- ❌ Не делать unlimited-абонементы (только session-based) — может Phase 14+
- ❌ Не делать time-based абонементы (месяц безлимит) — Phase 14+
- ❌ Не делать discounts/promo codes — Phase 14+
- ❌ Не делать автопродление — Phase 14+
