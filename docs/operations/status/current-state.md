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

Формальный SDD-аудит выявил status drift: среди task cards фаз 3/4/5/6/8/9 **119 карточек не имеют `status: done`**. Из них 110 помечены как «реализовано, открытые находки ревью», 7 старых `todo` ссылаются на fix-эпики, одна карточка — реальный Telegram QA, одна — текущий release-readiness task. По правилам `docs/DEVELOPMENT_PROCESS.md` это блокирует утверждение «все SDD задачи MVP закрыты», пока карточки не reconciled с кодом/ревью или явно не descoped.

Дополнительно канонический `trafficolog/volleytime` сейчас public, хотя `docs/GITHUB_SETUP.md` описывает private repository. Это policy/config drift, требующий осознанного решения перед полной публикацией.

До создания `v0.1.3` должны быть получены свежие доказательства:

- [ ] форматирование (`pnpm format:check`);
- [ ] lint (`pnpm lint`);
- [ ] typecheck (`pnpm typecheck`);
- [ ] unit + integration tests (`pnpm test` с PostgreSQL);
- [ ] production build (`pnpm build`);
- [ ] release-readiness review без открытого repository-level blocker.

Локальный sandbox не имеет доступа к npm registry, поэтому окончательным воспроизводимым gate служит GitHub Actions после публикации release-candidate branch.

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

1. Завершить Task 9.11.1 и получить зелёный GitHub CI.
2. Выполнить реальный Telegram QA.
3. Выполнить первый production deploy + smoke/rollback readiness.
4. Обкатать продукт на одной реальной группе.
5. После данных эксплуатации переходить к следующей фазе по `docs/RELEASES.md`, не расширяя текущий patch release.
