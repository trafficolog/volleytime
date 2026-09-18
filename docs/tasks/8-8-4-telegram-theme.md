---
id: '8.8.4'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #4'
priority: P1
roles:
  - FE
depends_on:
  - '3.9.13'
  - '8.8.1'
estimated_hours: '1-2'
tags:
  - telegram
  - theme
  - review-fix
---

# Task 8.8.4: Тема Telegram → токены --vt-*, тёмный режим, themeChanged

## Цель

Mini App выглядит нативно в светлой и тёмной теме Telegram.

## Контекст

`applyTheme` писал `--tg-*`, которые не использовались; тёмная тема не включалась.

## Что должно быть сделано

1. `applyTheme`: `colorScheme === 'dark'` → класс `dark` на `<html>`; `bg_color/secondary_bg_color/text_color/hint_color/button_color/button_text_color` → `--vt-paper/--vt-bone/--vt-ink/--vt-mute/--vt-flame/--vt-on-accent`.
2. `onEvent('themeChanged', applyTheme)`; `setHeaderColor/setBackgroundColor`.
3. Юнит-тест маппинга.

## Критерии приёмки

- ✅ Тёмная тема Telegram → тёмные токены

## Подсказки

-

## Не делать

- ❌ Не переопределять акцентные чипы (grass/rose/amber)
