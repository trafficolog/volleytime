---
id: '4.9.5'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #5'
priority: P1
roles:
  - BACK
depends_on:
  - '4.9.1'
  - '4.9.3'
estimated_hours: '2-3'
tags:
  - audit
  - review-fix
---

# Task 4.9.5: Audit log: запись всех мутаций org/members/invites в транзакции

## Цель

Закрыть DoD 10: каждое изменение организации, участника и инвайта оставляет запись в `audit_log` атомарно с изменением.

## Контекст

`auditService.log` нигде не вызывается — `GET /audit` всегда `[]`. Кроме того `log` глотал ошибки (best-effort), что в транзакции оставляет её в aborted-состоянии.

## Что должно быть сделано

1. `auditService.record(ctx, params)` — в текущем `getDb(ctx)` (tx), без try/catch (ошибка откатывает операцию); `log` оставить как алиас.
2. Вызовы: `organization.created/updated/archived`, `member.added/role_changed/blocked/unblocked/approved/rejected/left`, `invite.created/redeemed/revoked` — с `oldValue/newValue`.
3. Мутации, не обёрнутые в транзакцию (`update`, `archive`, `changeRole`, `block`, `leave`, `create invite`, `revoke`), обернуть.
4. Тест: после сценария «создание → инвайт → вступление → смена роли → блок → архив» в журнале все действия по порядку.

## Критерии приёмки

- ✅ Каждая мутация Phase 4 даёт одну audit-запись с актором
- ✅ Сбой записи audit откатывает мутацию

## Подсказки

- Каталог действий — `audit/actions.ts`, расширить `AuditEntityType`.

## Не делать

- ❌ Не писать audit после коммита (потеря записей при сбое)
