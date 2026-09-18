---
id: '4.9.8'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #8'
priority: P1
roles:
  - BACK
  - FE
depends_on:
  - '4.9.5'
  - '4.9.6'
  - '4.9.7'
estimated_hours: '3-4'
tags:
  - members
  - moderation
  - review-fix
---

# Task 4.9.8: Approve / reject / block / unblock: сервис, API, UI

## Цель

Закрыть DoD 6/7: организатор принимает и отклоняет заявки, блокирует и разблокирует участников.

## Контекст

Нет ни сервиса, ни API, ни UI для approve/reject/unblock; block — только API.

## Что должно быть сделано

1. `memberService.approve/reject/unblock` с проверкой исходного статуса (`pending`→`active`/`rejected`, `blocked`→`active`), `joinedAt` при approve; audit.
2. API: `POST members/:id/{approve,reject,block,unblock}` с `requireCanModerate` и org-scope.
3. UI состава: вкладки «Активные / Заявки / Заблокированные», действия в строке (VtSheet), подтверждение для блокировки.

## Критерии приёмки

- ✅ Переходы из неверного статуса → 409 `member.invalid_transition`
- ✅ В UI заявка принимается/отклоняется, заблокированный разблокируется

## Подсказки

- Уведомление участнику об одобрении — Phase 8 (тип добавляется в 8.8.5).

## Не делать

- ❌ Не удалять строки участников — только статусы
