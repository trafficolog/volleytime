# 📸 Текущее состояние проекта

> **Last generated:** 2026-09-18
> **Source:** supplied Git repository archive, `v0.1.2` + release-readiness branch for `v0.1.3`.

## Краткая сводка

- **Имя:** Volley Time
- **Домен:** `volleytime.by`
- **Стек:** Nuxt 4 + Drizzle + PostgreSQL + better-auth + grammY
- **Runtime release target:** Node.js 22, pnpm 12.4.1
- **R0/MVP scope:** phases 3, 4, 5, 6, 8, 9
- **Реализация:** основные MVP-потоки закодированы; два code review прошли hardening до `v0.1.2`.
- **Текущая итерация:** `v0.1.3` release-readiness — документация, GitHub publication, CI gate.
- **Следующие продуктовые фазы:** 10 / 7 / 15 и далее — вне текущего release scope.

## Что реализовано в R0

### Foundation / auth

- pnpm/Turborepo monorepo, TypeScript, ESLint/Prettier, Vitest;
- PostgreSQL + Drizzle migrations/rollback;
- passwordless email auth + Telegram identity/initData;
- CI, Docker development and production builds.

### Organizations

- organization CRUD, membership, invite links, moderation;
- owner/organizer/player policies;
- tenant resolution and organization-scoped API;
- audit log.

### Events / bookings / subscriptions

- venues, events, capacity and cancellation rules;
- booking, pending payment, waitlist and promotion;
- attendance;
- subscription plans, purchase, consume/restore sessions;
- event cancellation with restore/refund logic.

### Payments / ledger

- cash/transfer pending payments;
- organizer confirm/reject;
- transaction-safe state changes;
- income/expense ledger and cashbox UI.

### Telegram / Mini App

- grammY bot and deep links;
- Telegram Mini App auth, theme and navigation;
- notification flows;
- player and organizer MVP screens.

### Production infrastructure

- web, bot and migrator Docker images;
- Caddy HTTPS/webhook routing;
- production compose;
- separate migration stage;
- smoke script with auth and forged-initData checks;
- rollback to previous image set;
- backup/restore scripts and Sentry integration points.

## Review history

| Версия   | Результат                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- |
| `v0.1.0` | Первое полное ревью выявило 21 P0.                                                                   |
| `v0.1.1` | 21 P0 закрыты; 370 тестов были зелёными по отчёту ревью.                                             |
| `v0.1.2` | Повторное ревью подтвердило P0 и выявило 4 P1 + 5 P2; fix-эпики 3.10, 5.14, 6.9, 8.9, 9.10 смёржены. |
| `v0.1.3` | Текущий release-readiness: status drift, Node target, canonical GitHub + fresh CI evidence.          |

Отчёты: [v0.1.0 review](../reviews/2026-09-16-v0.1.0-review.md), [v0.1.1 re-review](../reviews/2026-09-18-v0.1.1-rereview.md), [v0.1.2 release-readiness](../reviews/2026-09-18-v0.1.2-release-readiness.md).

## Release state

### Repository gate

Канонический MVP gate задаётся **только** R0 release-plan: **139 исходных задач** фаз 3.1-3.8, 4.1-4.8, 5.1-5.12, 6.1-6.7, 8.1-8.7 и 9.1-9.8. Hardening/review/release-readiness эпики (`3.9+`, `4.9`, `5.13+`, `6.8+`, `8.8+`, `9.9+`) не входят в знаменатель MVP и являются evidence исправлений.

Текущий R0 snapshot: **139 tasks = 123 done + 16 in_progress**.

Открытые R0 cards:

- **8.7.2** — реальный Telegram manual QA;
- **9.1.1, 9.1.2, 9.2.2, 9.3.1, 9.3.2, 9.4.1, 9.5.1, 9.5.2, 9.6.1, 9.6.2, 9.7.1, 9.7.2, 9.8.1, 9.8.2, 9.8.3** — production/runtime/operations acceptance.

После PR #3 закрыт последний продуктовый repository gap `4.7.5`. PR #4 дал green CI repository implementation для `9.8.2`. PR #5 дал green CI repository implementation для `9.8.3`: GHCR остаётся дефолтным deploy path, manual `local-build` fallback и оба rollback path документированы/контрактно протестированы.

**Известных repository implementation gaps в исходных 139 R0 задачах больше нет.** Оставшиеся 16 карточек нельзя честно закрыть без Telegram/VPS/DNS/Sentry/S3/live deploy evidence.

Ранее выполненный reconciliation по 237 R0+review cards остаётся полезным документарным аудитом, но **не является MVP denominator**.

### External / production gate

Даже зелёный CI **не закрывает** следующие пункты:

- [ ] [ручной Telegram QA](../qa/telegram-miniapp-checklist.md) (Task 8.8.11);
- [ ] первый production deploy на VPS;
- [ ] production smoke после deploy;
- [ ] подтверждённый backup upload + restore test + внешний monitoring;
- [ ] неделя реальных тренировок только через Volley Time (R0 DoD).

Пока SDD reconciliation и внешние пункты не выполнены, формулировка статуса: **release candidate; release approval blocked**.

## Claude Design reference

Claude Design export используется как reference интерфейсов. Он содержит как MVP, так и будущие screens (Credits, Contributions, Reports, Root Admin, Phase 10+). Release review сравнивает только элементы/flows, принадлежащие R0; будущие screens не считаются пропусками MVP.

## Следующие шаги

1. Выполнить реальный Telegram QA по R0 Task 8.7.2 (hardening-checklist 8.8.11 используется как расширенный сценарий).
2. Настроить VPS/DNS/GitHub Secrets и выбрать active deploy path после проверки GHCR.
3. Выполнить первый production deploy + smoke + реальный rollback.
4. Проверить backup upload/restore, Sentry и внешний monitoring.
5. Провести неделю реальных тренировок только через Volley Time и после этого подтвердить R0 MVP.
