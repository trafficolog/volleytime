---
id: '8.8.5'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #5'
priority: P1
roles:
  - BACK
depends_on:
  - '5.13.16'
estimated_hours: '2'
tags:
  - notifier
  - i18n
  - review-fix
---

# Task 8.8.5: Тексты уведомлений: дата в TZ организации, событие/план в платёжных, кнопка «Открыть»

## Цель

Уведомление понятно без открытия приложения и ведёт в нужный экран.

## Контекст

Дата в UTC ISO, платёжные уведомления без названия события, нет кнопки с deeplink.

## Что должно быть сделано

1. Параметры уведомлений: `eventDate` форматируется `formatEventDate(date, orgTz)`; `payment_*` содержат `eventTitle`/`planName`.
2. Шаблоны: единый стиль, суммы `formatMoneyRu`.
3. Payload → бот: `button: { text, url: <WEB_URL>/m/?startapp=event_<id> }` → `InlineKeyboard.webApp`.
4. Тесты шаблонов.

## Критерии приёмки

- ✅ «Тренировка · 18 сентября, 19:00» вместо ISO
- ✅ У уведомления есть кнопка

## Подсказки

-

## Не делать

- ❌ Не отправлять ПДн других игроков
