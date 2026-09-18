---
id: '4.9.7'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #7'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on:
  - '4.9.6'
estimated_hours: '1-2'
tags:
  - permissions
  - members
  - review-fix
---

# Task 4.9.7: Pending-участник не работает как активный

## Цель

Участник со статусом `pending` видит только карточку организации и статус своей заявки.

## Контекст

`isOrgMember` считал `pending` активным: pending → `GET members` 200, `GET events` 200 (запись — в Phase 5, 5.13.11).

## Что должно быть сделано

1. `isOrgMember` → только `active`; новый `isOrgApplicant` (pending).
2. `GET /organizations/:id` доступен pending (карточка + `myMember.status`); остальные org-роуты — `requireOrgMember` (403 `forbidden.pending_approval`).
3. `listForUser` возвращает pending-организации с флагом `membershipStatus`.
4. Тесты политик и API.

## Критерии приёмки

- ✅ pending: `GET members` / `GET events` → 403 с кодом `forbidden.pending_approval`
- ✅ pending видит организацию в списке со статусом «Заявка на рассмотрении»

## Подсказки

- tenant middleware пропускает pending, решение принимают require-функции.

## Не делать

- ❌ Не удалять pending из tenant — иначе нельзя показать статус заявки
