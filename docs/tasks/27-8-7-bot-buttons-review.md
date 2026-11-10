---
id: '27.8.7'
phase: '27'
epic: '27.8'
status: done
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-07). Закрыта 2026-11-10: решение AQ-13 — без кнопки «Сборы», внесено в 21.4.9.'
ref_id: ''
review_ref: 'UI-07'
priority: P3
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [PRODUCT]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '1-2'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, bot]
---

# Task 27.8.7: Кнопки бота из 21.4.9: что нужно при работающем Mini App

## Цель

Бот повторяет только те действия Mini App, которые действительно удобнее в чате.

## Контекст

- Замечание `UI-07` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- [21.4.9](21-4-9-bot-reference-buttons.md): «Буду», «Пропущу», «Мой абонемент», «Сборы», «Кто уже играет».
- Каждая кнопка — второй путь к тем же правилам и вдвое больше проверок.
- 21.4.9 входит в `v0.3.1` и получает `AQ-13` в `decisions`: решение нужно до её старта.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Для каждой кнопки: сценарий, есть ли он в Mini App, стоимость поддержки — таблица для AQ-13.
2. Обновить 21.4.9 по решению.

## Критерии приёмки

- ✅ 21.4.9 обновлена по AQ-13 до старта её реализации
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не реализовывать кнопки в этой карточке
