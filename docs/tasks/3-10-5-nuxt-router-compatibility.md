---
id: '3.10.5'
phase: '3'
epic: '3.10'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Windows typecheck completes with a Volar ERR_PACKAGE_PATH_NOT_EXPORTED warning because the web app directly pins vue-router 4 while Nuxt provides a compatible router version.'
roles:
  - FRONTEND
  - QA
depends_on:
  - '3.9.6'
  - '3.10.4'
estimated_hours: '1'
tags:
  - nuxt
  - vue-router
  - typecheck
---

# Task 3.10.5: совместимость Nuxt, Volar и vue-router

## Цель

Устранить предупреждение `ERR_PACKAGE_PATH_NOT_EXPORTED` из штатного typecheck без изменения маршрутизации приложения.

## Контекст

`apps/web` напрямую объявляет `vue-router` 4.6.x, хотя код приложения не импортирует пакет напрямую. Nuxt 4.5.x уже управляет совместимой версией router и Volar-интеграцией. Прямая зависимость заставляет typecheck разрешать несовместимый export `vue-router/volar/sfc-route-blocks`.

## Что должно быть сделано

1. Зафиксировать RED через штатный `pnpm typecheck` и точный текст предупреждения.
2. Удалить только избыточную прямую зависимость `vue-router` из web workspace.
3. Обновить lockfile штатным pnpm.
4. Выполнить обязательные репозиторные проверки.

## Критерии приёмки

- ✅ `pnpm typecheck` проходит без `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- ✅ В коде приложения нет прямых импортов `vue-router`, требующих отдельной зависимости.
- ✅ `pnpm format:check`, `pnpm lint`, `pnpm test` и `pnpm build` проходят.
- ✅ Изменение lockfile ограничено удалением избыточной прямой зависимости.

## Не делать

- ❌ Не закреплять внутреннюю версию router поверх версии, управляемой Nuxt.
- ❌ Не изменять маршруты или runtime-поведение приложения.
- ❌ Не обновлять остальные зависимости.
