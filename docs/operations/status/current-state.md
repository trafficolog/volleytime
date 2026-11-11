# 📸 Текущее состояние проекта

> **Production `aa8d8f9a`, 2026-11-10: сборы включены.** `COLLECTIONS_ENABLED=true` (решение владельца), [Promote 42890770428](https://github.com/trafficolog/volleytime/actions/runs/42890770428) → [Deploy 42890800801](https://github.com/trafficolog/volleytime/actions/runs/42890800801) smoke-passed, health `release=aa8d8f9a`; диапазон от v0.3.0 — только документы. Включены шесть флагов: `EVENT_SPLIT_PRICING_ENABLED`, `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED`, `COLLECTIONS_ENABLED`; `TELEGRAM_LOGIN_WIDGET_ENABLED` выключен. После первого ожидающего взноса откат приложения на v0.2.0 отказывает, пока взносы не подтверждены или отклонены. Тег `v0.3.0` остаётся на `5ebac048`. [Evidence](../qa/2026-11-10-21-3-1-release-v0-3-0.md#п-7--включение-collections_enabled-после-приёмки).
>
> **Production v0.3.0 / `5ebac048`, принят владельцем 2026-11-10:** [Deploy 42879578391](https://github.com/trafficolog/volleytime/actions/runs/42879578391) success (verified → loaded → backed-up → migrated 0032–0039 → activated → smoke-passed), health `release=5ebac048`, тег `v0.3.0`. Promote 42879445277 отказал (workflows в диапазоне, `PROMOTE_TOKEN` не задан) — ручной `git push origin 5ebac048:prod` с подтверждением владельца. Флаги: включены `EVENT_SPLIT_PRICING_ENABLED`, `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED`; выключены `COLLECTIONS_ENABLED` (включается отдельно с подтверждением) и `TELEGRAM_LOGIN_WIDGET_ENABLED`. После первого мягкого удаления группы откат приложения на `b4186e3` отказывает, пока группа не восстановлена. Приёмка владельца — в чате; матрица Telegram QA на устройствах отдельным отчётом не подтверждена ([Follow-up 21.3.1](../../tasks/21-3-1-release-v0-3-0-qa.md#follow-up-после-выпуска)). Следующий релиз — `v0.3.1` (эпики 21.4, 21.5 и 27.2.1–27.2.3). [Evidence](../qa/2026-11-10-21-3-1-release-v0-3-0.md). Записи ниже — история.
>
> **Production `b4186e3`, 2026-10-27:** флаги `EVENT_INVITE_MODE_ENABLED` (релиз `087fc14`, [Deploy 40559685328](https://github.com/trafficolog/volleytime/actions/runs/40559685328)) и `SCHEDULER_ENABLED` (`prod` на `b4186e3fc57da525d7a49df6659f0b723f0a3a79`, диапазон только документы, main CI четыре job success; [Deploy 40562856130](https://github.com/trafficolog/volleytime/actions/runs/40562856130) success, smoke-passed, health `release=b4186e3`) включены с подтверждением владельца. Включены пять флагов: `EVENT_SPLIT_PRICING_ENABLED`, `EVENT_BALANCE_ENFORCED`, `EVENT_MULTI_SEAT_ENABLED`, `EVENT_INVITE_MODE_ENABLED`, `SCHEDULER_ENABLED`; `TELEGRAM_LOGIN_WIDGET_ENABLED` выключен. В логе `[scheduler] started`, ошибок за первые 15 минут нет, `SCHEDULER_INTERVAL_MS` не задан (15000). Откат приложения на `b056806` отказывает, как только появятся такие данные (guard не перечитывался), восстановление только вперёд; пин `b056806` снимается отдельным шагом ([evidence](../qa/2026-10-27-flag-rollout-invite-scheduler.md)).
>
> **`main`, 2026-11-05 (инцидент CI, production не затронут):** PR #207 и #209 независимо добавили одни и те же ключи api-error, и `typecheck` на `main` стал красным на `3509ead` и `242a842`; исправлено [PR #212](https://github.com/trafficolog/volleytime/pull/212) (`e145c8c`). Production не менялся и не затронут (Promote принимает только SHA с зелёным main CI). Урок: перед merge PR, у которого `main` ушёл вперёд в пересекающихся файлах, обновить ветку и мержить на свежем зелёном прогоне (правило в CODING_STANDARDS).
>
> История (баннеры 2026-09-21 — 2026-10-27, R0.6/R0.7, референс v3, волна 1 фазы 19, production до `e56fee2`) — в [архиве](archive/2026-10-current-state-history.md).

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
- production deploy from GitHub `prod` through runner-built exact-SHA image bundles and a verified Git bundle, without a VPS build (9.8.10); the old local-build path is historical;
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
| `v0.1.6` | R0.6 candidate `64f1850` deployed; real Telegram/pilot acceptance and public tag/Release are still open.                             |

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
- [x] R0.6 image-bundle deploy на `64f1850` без VPS Docker build, с pre-migration backup, exact image/runtime SHA и synthetic cleanup ([evidence](../qa/2026-09-30-r06-production-candidate.md)); runtime npm dependency внутри migrator container остаётся дефектом 9.8.10;
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

Статус: **`v0.1.5` остаётся последним опубликованным tag/Release; R0.6/`v0.1.6` кандидат `64f1850` работает в production, но 9.8.10 требует offline-runtime fix/redeploy, а релиз — реального Telegram QA и пилота. Полный R0/MVP acceptance дополнительно требует monitoring/S3 и недельного pilot gate.**

## Claude Design reference

Claude Design export используется как reference интерфейсов. Он содержит как MVP, так и будущие screens (Credits, Contributions, Reports, Root Admin, Phase 10+). Release review сравнивает только элементы/flows, принадлежащие R0; будущие screens не считаются пропусками MVP.

## Следующие шаги

1. Выполнить реальный Telegram QA по R0 Task 8.7.2 (hardening-checklist 8.8.11 используется как расширенный сценарий).
2. Проверить BotFather Menu Button, Mini App initData login и event deeplink на реальном клиенте.
3. Подключить Sentry/UptimeRobot и проверить реальные alerts.
4. Перенести release backup в S3, настроить retention и провести S3-based restore test.
5. Провести неделю реальных тренировок только через Volley Time и после этого подтвердить R0 MVP.
