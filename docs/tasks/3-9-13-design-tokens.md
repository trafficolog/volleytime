---
id: '3.9.13'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · Визуал + Итог шаг 6'
priority: P2
roles:
  - FE
depends_on: []
estimated_hours: '3-4'
tags:
  - design-system
  - tailwind
  - ui
  - review-fix
---

# Task 3.9.13: Дизайн-токены и базовые компоненты из Claude Design (архив 2026-09-16)

## Цель

Перенести токены (`styles.css`) и атомы (`atoms.jsx`) обновлённого прототипа Claude Design в Nuxt: CSS-переменные, Tailwind-тема, базовые компоненты.

## Контекст

Реализация использует дефолтный Tailwind (`bg-blue-500`, `gray-*`), дизайн-токены проекта не перенесены. Обновлённый архив Claude Design (`Volley_Time.zip`) содержит палитру `--vt-*`, шрифты Space Grotesk / Manrope / JetBrains Mono, атомы: кнопки, карточки, чипы, аватары, поля, mini-header, tab bar.

## Что должно быть сделано

1. `app/assets/css/tokens.css` — переменные `--vt-*` (light) + `.dark`/`.vt-dark` (dark) из `styles.css` прототипа; маппинг на `--tg-theme-*` делается в 8.8.4.
2. `tailwind.config.ts`: `darkMode: 'class'`, `colors.vt.{ink,paper,bone,stroke,mute,flame,orange,amber,grass,rose}` через `var(--vt-*)`, `fontFamily.display/body/mono`.
3. Компоненты `app/components/vt/`: `VtButton` (primary/ghost/ink, sm/lg/full), `VtCard`, `VtChip` (tones), `VtAvatar` (инициалы + фото), `VtField`, `VtLabel`, `VtMiniHeader`, `VtTabBar`, `VtSheet`, `VtMoney`.
4. Логотип `public/logo.png` из `assets/logo.png`.
5. Базовые UI-компоненты (`EmptyState`, `ErrorState`, `SkeletonList`, `OfflineBanner`) перевести на токены.

## Критерии приёмки

- ✅ Цвета/шрифты страниц берутся из токенов, `bg-blue-500` в `app/` не используется
- ✅ Компоненты `Vt*` доступны автоимпортом
- ✅ Контраст текста соответствует токенам прототипа (≥4.5:1 для мелкого текста)

## Подсказки

- Шрифты через Google Fonts `<link>` с `display=swap`; в Telegram webview системный fallback.

## Не делать

- ❌ Не копировать React-код прототипа — только токены и визуальные решения
- ❌ Не подключать UI-киты
