# 📸 Текущее состояние проекта

> **Дополнение 2026-09-26, landing-ветка:** пользовательское замечание к цветам, шрифтам и композиции оформлено в [3.11.7](../../tasks/3-11-7-landing-reference-fidelity.md). Восстановление проверено локально на четырёх ширинах с загруженными Oswald/Golos, production-сборкой и независимым review; точный CI и интеграция ожидаются. Это не закрывает общий R0.6, native zoom/фоновую вкладку, production-бот или Telegram QA и не меняет `main`, `prod` и VPS.

> **Дополнение 2026-09-24:** новый архив дизайн-референса v2 разобран в [карте MVP-экранов](../../design/2026-09-23-reference-v2.md), а визуальная миграция запланирована отдельными SDD-карточками в R0.6 `v0.1.6`. Задача 5.13.21 по опциональным абонементам организации прошла независимое ревью, локальные gates и CI; PR #39 смёржен в GitHub `main` как `dafb98b`. [Свидетельства и ограничения](../../tasks/5-13-21-organization-subscriptions-toggle.md) записаны в карточке. Это **не** подтверждает Telegram-host QA, общий визуальный QA R0.6 или production deploy. Снимок ниже исторический и требует отдельной общей сверки статуса.

> **Last generated:** 2026-09-21
> **Source:** canonical GitHub repository, production VPS and live `v0.1.5` release evidence.

## Краткая сводка

- **Имя:** Volley Time
- **Домен:** `volleytime.by`
- **Стек:** Nuxt 4 + Drizzle + PostgreSQL + better-auth + grammY
- **Runtime release target:** Node.js 22, pnpm 12.4.1
- **R0/MVP scope:** phases 3, 4, 5, 6, 8, 9
- **Реализация:** основные MVP-потоки закодированы; два code review прошли hardening до `v0.1.2`.
- **Текущая итерация:** post-release MVP acceptance после опубликованного `v0.1.4`; новые продуктовые доработки оформляются отдельными SDD-задачами по готовности референсов.
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
- automatic deploy from GitHub `prod` through a verified Git bundle and local VPS build;
- exact-SHA release identity and explicit application rollback to an immutable ancestor;
- backup/restore scripts and Sentry integration points.

## Review history

| Версия   | Результат                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `v0.1.0` | Первое полное ревью выявило 21 P0.                                                                                                   |
| `v0.1.1` | 21 P0 закрыты; 370 тестов были зелёными по отчёту ревью.                                                                             |
| `v0.1.2` | Повторное ревью подтвердило P0 и выявило 4 P1 + 5 P2; fix-эпики 3.10, 5.14, 6.9, 8.9, 9.10 смёржены.                                 |
| `v0.1.3` | Опубликованный verified production baseline `91f6bff`; manual local build и isolated restore.                                        |
| `v0.1.4` | Опубликован на `16c2fe4`: prod-only bundle deploy, exact identity, polling fallback и live rollback.                                 |
| `v0.1.5` | Исправлен bot identity drift: invite links, token и runtime config указывают на `@volleytimeby_bot`; deploy guard проверяет `getMe`. |

Отчёты: [v0.1.0 review](../reviews/2026-09-16-v0.1.0-review.md), [v0.1.1 re-review](../reviews/2026-09-18-v0.1.1-rereview.md), [v0.1.2 release-readiness](../reviews/2026-09-18-v0.1.2-release-readiness.md).

## Release state

### Repository gate

Канонический MVP gate задаётся **только** R0 release-plan: **139 исходных задач** фаз 3.1-3.8, 4.1-4.8, 5.1-5.12, 6.1-6.7, 8.1-8.7 и 9.1-9.8. Hardening/review/release-readiness эпики (`3.9+`, `4.9`, `5.13+`, `6.8+`, `8.8+`, `9.9+`) не входят в знаменатель MVP и являются evidence исправлений.

Текущий R0 snapshot: **139 tasks = 132 done + 7 in_progress**.

Открытые R0 cards:

- **8.7.2** — полный реальный Telegram Mini App QA на клиенте и двух аккаунтах;
- **9.4.1** — BotFather domain/menu, Mini App opening, deeplinks и real initData login;
- **9.5.1** — прямой Telegram webhook остаётся заблокирован внешним IPv4 ingress; production работает через polling;
- **9.6.1, 9.6.2** — Sentry event delivery и внешний UptimeRobot alert;
- **9.7.1, 9.7.2** — S3 upload/retention и S3-based restore.

После PR #3 закрыт последний продуктовый repository gap `4.7.5`. Production deploy path затем был переведён на проверяемый Git bundle: push в `prod` проходит CI, передаёт exact SHA на VPS, создаёт локальный DB backup, собирает SHA-tagged images, выполняет migration/up и smoke. GHCR сохранён только как ручная альтернатива.

**Известных repository implementation gaps в исходных 139 R0 задачах больше нет.** Оставшиеся 7 карточек требуют manual/client, monitoring, S3 или внешнего webhook evidence и не закрываются repository CI.

Ранее выполненный reconciliation по 237 R0+review cards остаётся полезным документарным аудитом, но **не является MVP denominator**.

### External / production gate

Проверено в production:

- [x] HTTPS, database/auth health и здоровые web/bot/PostgreSQL containers;
- [x] отдельные CI credentials и требуемые GitHub Secret names;
- [x] автоматический prod-only bundle/local-build deploy без VPS egress к GitHub/GHCR;
- [x] release-local backup до advancement/migration и isolated restore в PostgreSQL 16;
- [x] controlled application rollback на `v0.1.3` и успешный redeploy exact SHA;
- [x] Telegram Bot API outbound через IPv6 и обработка реальных updates в polling mode.
- [x] полный VPS hardening audit: key-only SSH/recovery, UFW, fail2ban, timezone/NTP и unattended-upgrades dry-run.
- [x] real production delivery через защищённый `web → bot internal notify → Telegram` path.

Production bot identity drift устранён: invite URL, web/bot runtime config и установленный token теперь согласованы на `volleytimeby_bot`; deploy guard блокирует повторное несовпадение до формирования или загрузки production env.

Остаются открытыми:

- [ ] [ручной Telegram QA](../qa/telegram-miniapp-checklist.md) (Task 8.8.11);
- [ ] BotFather/Mini App/deeplink/initData acceptance на реальном клиенте;
- [ ] S3 upload/retention/S3 restore и внешний Sentry/UptimeRobot monitoring;
- [ ] прямой webhook ingress до исправления IPv4-маршрута провайдера (polling остаётся рабочим fallback);
- [ ] неделя реальных тренировок только через Volley Time (R0 DoD).

Статус: **`v0.1.5` опубликован и работает в production; полный R0/MVP acceptance остаётся открытым до manual QA, monitoring/S3 и недельного pilot gate**.

## Claude Design reference

Claude Design export используется как reference интерфейсов. Он содержит как MVP, так и будущие screens (Credits, Contributions, Reports, Root Admin, Phase 10+). Release review сравнивает только элементы/flows, принадлежащие R0; будущие screens не считаются пропусками MVP.

## Следующие шаги

1. Выполнить реальный Telegram QA по R0 Task 8.7.2 (hardening-checklist 8.8.11 используется как расширенный сценарий).
2. Проверить BotFather Menu Button, Mini App initData login и event deeplink на реальном клиенте.
3. Подключить Sentry/UptimeRobot и проверить реальные alerts.
4. Перенести release backup в S3, настроить retention и провести S3-based restore test.
5. Провести неделю реальных тренировок только через Volley Time и после этого подтвердить R0 MVP.
