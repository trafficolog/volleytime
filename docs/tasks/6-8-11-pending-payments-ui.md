---
id: '6.8.11'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · Визуал «Ожидают оплаты»'
priority: P2
roles:
  - BACK
  - FE
depends_on:
  - '6.8.1'
  - '6.8.4'
estimated_hours: '2'
tags:
  - payments
  - ui
  - review-fix
---

# Task 6.8.11: «Ожидают оплаты»: имена, событие, дата, способ, давность, итог, ошибки

## Цель

Организатор понимает, кто и за что должен, по дизайну OrgPayments.

## Контекст

«Платёж #123 · pending», ошибки подтверждения не показывались, `window.confirm`.

## Что должно быть сделано

1. `listPending` отдаёт `user` (публичные поля), `event {title, startsAt}` или `plan {name}`, `method`, `createdAt`.
2. UI: итог «ожидается N BYN», карточки с аватаром, событием/планом, чипом способа, «2 ч назад», кнопки «Подтвердить»/«Отклонить» (confirm Telegram), ошибки.

## Критерии приёмки

- ✅ Нет «Платёж #N»
- ✅ Ошибка 409 показывается

## Подсказки

-

## Не делать

-
