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

SDD reconciliation выполнен в Task 9.11.2. Исходный drift **119 non-done cards** разобран по evidence: **101 историческая карточка закрыта**, **18 реально открытых были сохранены на момент reconciliation; Task 4.7.5 затем закрыта**. С учётом новой служебной карточки snapshot: **237 R0/review task cards, 220 done, 17 non-done**.

Открытые cards теперь имеют конкретные причины:

- repository gap: **9.8.3**;
- один manual Telegram gate, представленный двумя карточками: **8.7.2 + 8.8.11**;
- Phase 9 production/runtime/ops validation: **9.1.1, 9.1.2, 9.2.2, 9.3.1, 9.3.2, 9.4.1, 9.5.1, 9.5.2, 9.6.1, 9.6.2, 9.7.1, 9.7.2, 9.8.1, 9.8.2**. Для 9.8.2 repository implementation уже готова; остаётся только external secrets/VPS verification.

Свежий GitHub CI на PR #1 прошёл полностью: format/lint/typecheck, unit+integration tests и build. Автоматический Deploy run 35346916965 также успешно выполнил pre-deploy tests и build/push web+migrator+bot, но SSH deploy остановился до подключения с `missing server host`: `VPS_HOST`/SSH production configuration ещё не задана.

Канонический GitHub уже содержит release-candidate snapshot. Репозиторий остаётся public, тогда как `docs/GITHUB_SETUP.md` исторически описывает private repository; это отдельное policy/config decision, а не доказательство production readiness.

Подробности: [SDD reconciliation](../reviews/2026-09-18-sdd-reconciliation.md).

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

1. Закрыть repository gap 9.8.3.
2. Выполнить реальный Telegram QA (8.7.2 / 8.8.11).
3. Настроить VPS/DNS/secrets и выполнить первый production deploy + smoke/rollback.
4. Проверить реальный backup/restore + внешний monitoring.
5. Обкатать продукт на одной реальной группе и только после этого подтверждать production MVP.
