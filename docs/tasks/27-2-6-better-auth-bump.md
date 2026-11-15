---
id: '27.2.6'
phase: '27'
epic: '27.2'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-15
status_note: 'Из первого pnpm audit (PR 27.2.2): better-auth 1.7.4 содержит critical GHSA-965c-763c-88jm и high GHSA-r4xp-prcw-77qf. Релиз назначает владелец; срок исключения аудита 2026-11-29.'
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

## Не делать

- ❌ Не включать новые плагины и способы входа
- ❌ Не менять схему БД сверх требуемой обновлением
