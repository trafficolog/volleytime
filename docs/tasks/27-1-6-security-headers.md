---
id: '27.1.6'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-05). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-05'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, FE]
depends_on: ['27.4.8']
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, infra, csp]
---

# Task 27.1.6: Заголовки безопасности: недостающие директивы CSP, HSTS и Permissions-Policy

## Цель

Заголовки закрывают известные пробелы, а отказ от `unsafe-inline` оценён отдельно.

## Контекст

- Замечание `INF-05` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `Caddyfile` — HSTS `max-age=31536000` без `includeSubDomains`; CSP с `script-src 'self' 'unsafe-inline' https://telegram.org` и `style-src 'unsafe-inline'`; нет `Permissions-Policy` и явного `object-src 'none'`; `base-uri 'self'` и `form-action 'self'` уже заданы.
- После [27.4.8](27-4-8-telegram-script-scope.md) скрипт Telegram нужен только на `/m/**`: CSP можно разделить по путям.
- Mini App открывается во фрейме Telegram: `frame-ancestors` не сужать без проверки в Telegram Web.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Добавить `object-src 'none'` и `Permissions-Policy` (камера, микрофон, геолокация и т. п. выключены).
2. HSTS `includeSubDomains` — только если все поддомены на HTTPS (проверить DNS); иначе записать причину.
3. Отдельная CSP для `/m/**` (с telegram.org) и для остального сайта (без него).
4. Оценить переход на nonce/hash для скриптов Nuxt: что ломается, объём работ; результат — отдельной карточкой или записью «не делаем» с причиной.
5. Проверка заголовков в smoke (или тест Caddyfile) и Chrome QA: лендинг, вход, кабинет, Mini App, публичная страница события.

## Критерии приёмки

- ✅ Новые директивы присутствуют; консоль браузера без нарушений CSP на основных маршрутах
- ✅ Mini App работает в Telegram Web (отметка владельца или отложено в релизную QA)
- ✅ Решение по `unsafe-inline` записано
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не убирать `unsafe-inline` в этой карточке
- ❌ Не менять `frame-ancestors`
