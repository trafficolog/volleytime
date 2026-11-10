---
id: '27.4.7'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (BOT-03). Релиз назначает владелец.'
ref_id: ''
review_ref: 'BOT-03'
priority: P3
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, bot, notifications, reliability]
---

# Task 27.4.7: Доставка уведомлений при блокировке бота и ответе 429

## Цель

Уведомления не теряются молча и не повторяются бесконечно: ошибки Telegram обрабатываются по типу.

## Контекст

- Замечание `BOT-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Отправка — `apps/bot/src/internal-server.ts` и нотификатор core; признак «бот доступен» — `/api/internal/bot/reachable`.
- Типы ошибок Telegram: 403 (бот заблокирован), 429 (`retry_after`), 400 (чат не найден), сетевые.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Описать текущее поведение по типам ошибок (код и тесты).
2. 403 → отметить пользователя недоступным, не повторять; 429 → повтор после `retry_after`, ограниченное число раз; сетевые → ограниченный повтор.
3. Тесты на каждый тип с подменой клиента Telegram.

## Критерии приёмки

- ✅ Каждый тип ошибки обработан по правилу (тесты)
- ✅ Нет бесконечных повторов
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не вводить внешнюю очередь
