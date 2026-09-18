---
id: '9.9.8'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P1 #8'
priority: P1
roles:
  - DEVOPS
depends_on: []
estimated_hours: '0.5'
tags:
  - pnpm
  - review-fix
---

# Task 9.9.8: pnpm.overrides → pnpm-workspace.yaml

## Цель

Пины транзитивных зависимостей действительно применяются в pnpm 12.

## Контекст

pnpm 12 игнорирует `pnpm.overrides` в package.json (предупреждение при install).

## Что должно быть сделано

1. Перенести секцию в `overrides:` внутри `pnpm-workspace.yaml`, убрать из `package.json`.
2. `pnpm install` → предупреждения нет, версии зафиксированы.

## Критерии приёмки

- ✅ Нет предупреждения об игнорируемых ключах
- ✅ `pnpm why <pkg>` показывает пин

## Подсказки

-

## Не делать

-
