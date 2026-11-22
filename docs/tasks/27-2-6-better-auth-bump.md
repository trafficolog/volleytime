---
id: '27.2.6'
phase: '27'
epic: '27.2'
status: done
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-11-16
status_note: 'Закрыта 2026-11-16 решением владельца: better-auth 1.7.4 → 1.7.25 смёржено, PR #280 (merge 67858f9f): lockfile только семейство better-auth, better-call, @better-fetch/fetch; исключения аудита better-auth удалены; `allowedAttempts: 3` задан явно с тестами. Смоук-тест входа в Mini App и в кабинете покрыт приёмкой владельца v0.3.1 2026-11-16 (21.4.3, тег v0.3.1 на 98b60193; отдельным отчётом не подтверждён). Релиз v0.3.1.'
ref_id: ''
review_ref: 'CI-02'
priority: P1
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACKEND, SECURITY]
depends_on: ['27.2.2']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, dependencies, auth]
---

# Task 27.2.6: Обновить better-auth до 1.7.7 или новее

## Цель

В production-зависимостях нет уязвимых версий better-auth; записи исключений аудита для него удалены.

## Контекст

- Первый `pnpm audit --prod --audit-level=high` в PR 27.2.2: better-auth 1.7.4 (`packages/auth`), исправлено в 1.7.7: critical `GHSA-965c-763c-88jm` (OAuth state как Magic Link), high `GHSA-r4xp-prcw-77qf` (OAuth Proxy).
- **Достижимость:** `packages/auth/src/config.ts` подключает только плагины `telegramPlugin` и `emailOTP`, `emailAndPassword` выключен, социальных провайдеров нет. Плагины OAuth Proxy и Magic Link не включены, поэтому прямой эксплуатации в текущей конфигурации нет; обновление всё равно нужно (определено только по коду конфигурации, не по рантайму).
- Модель: реализация и ревью `claude-opus-5-5` (авторизация); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md) (авторизация — Opus).

## Что должно быть сделано

1. Обновить `better-auth` в `packages/auth/package.json` и lockfile до >=1.7.7 (допустимо принять PR Dependabot).
2. Проверить миграции схемы better-auth (`packages/db`), вход через Telegram и email-OTP, интеграционные тесты `packages/auth`.
3. Удалить записи better-auth из `.github/audit-exceptions.json`.

## Критерии приёмки

- ✅ `pnpm audit --prod --audit-level=high` не показывает better-auth
- ✅ Вход через Telegram и email-OTP работает (интеграционные тесты зелёные)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ emailOTP `allowedAttempts: 3` задан явно; тест: после трёх неверных кодов (в том числе конкурентных) верный код отклоняется
- ✅ Set-cookie сессии в 1.7.4 и 1.7.25 для нашей конфигурации одинаков (`HttpOnly; SameSite=Lax; Path=/`, на https `__Secure-` и `Secure`). Smoke-тест входа в Mini App и в кабинете из release QA [21.4.3](./21-4-3-defects-recheck-release.md) покрыт приёмкой владельца 2026-11-16 (отдельным отчётом не подтверждён).

## Не делать

- ❌ Не включать новые плагины и способы входа
- ❌ Не менять схему БД сверх требуемой обновлением

## Follow-up 2026-11-20: нестабильный тест параллельных попыток

- [Deploy 44758244634](https://github.com/trafficolog/volleytime/actions/runs/44758244634) (attempt 1, `Test before deploy`, `2b4ba8ee`) упал на `allowedAttempts 3: concurrent wrong codes do not grant extra guesses`: верный код после всплеска из 6 неверных вернул 200. В main CI и PR CI на том же коде тест проходил.
- **Причина — допущение теста, не гонка продукта.** better-auth 1.7.25 (`atomicVerifyOTP`) атомарно забирает запись кода на время сравнения и возвращает её с `попыток + 1`. Параллельный запрос, пришедший в это окно, получает `INVALID_OTP` без сравнения и без списания попытки. Всплеск списывает от 1 до 3 попыток в зависимости от чередования; в упавшем прогоне списана 1, и верный код законно вошёл второй попыткой из трёх. Инвариант «сравнено не больше 3 кодов» не нарушен.
- **Воспроизведение** на одноразовом PostgreSQL 16: старый тест — 1 падение из 40 прогонов; зонд на 300 всплесков — 299 раз списано 3 попытки, 1 раз списана 1 (все 6 ответов `INVALID_OTP`, затем верный код — 200).
- **Исправление:** тест читает списанные попытки из записи (`<hash>:<n>`, без записи — сгорел), проверяет `n ≤ 3`, расходует остаток `3 − n` неверными кодами и только затем требует отказ верному коду и отсутствие session cookie. Проверка детерминирована: при любом чередовании верный код не проходит после исчерпания трёх списанных попыток. Сравнение без списания тест не наблюдает (как и прежний); его исключает атомарный consume записи в better-auth. Новый тест — 100 из 100 прогонов. Код продукта и lockfile не менялись.
- Исправление теста выходит со следующим релизом `v0.4.0` (сама задача закрыта в `v0.3.1`).
