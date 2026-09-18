---
id: '4.6'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Accountability layer. Кто что сделал и когда.'
estimated_hours: '3-4'
depends_on: ['4.2']
---

# Epic 4.6: AuditLog

**Цель.** Реализовать audit log: каждое значимое изменение в системе записывается в `audit_log` таблицу с информацией кто/что/когда. Owner видит audit log своей организации.

## Контекст

Решение 9 в phase-card: только **изменения**, не просмотры. Спам от логирования просмотров — overkill.

Audit log не блокирует операции (даже если запись не удалась, основная операция должна пройти). Это **append-only журнал** — не редактируется и не удаляется.

В Phase 4 события: `organization.created/updated/archived`, `member.invited/joined/left/blocked/unblocked/role_changed`, `invite.created/revoked/used`.

## Definition of Done

- Drizzle schema `audit_log` с jsonb полями old_value/new_value
- `AuditService.log({ actor, action, entityType, entityId, oldValue, newValue, organizationId, ipAddress, userAgent })`
- Async fire-and-forget паттерн: ошибки логирования не блокируют основную операцию (catch + warn)
- Интеграция в OrganizationService, MemberService, InviteService — каждая mutation вызывает audit.log
- API endpoint: `GET /api/organizations/:orgId/audit` — пагинированный список (только owner/organizer)
- Фильтры: по action, по user, по дате
- Тесты: каждая mutation в Phase 4 модулях создаёт запись в audit_log

## Задачи

| ID                                                  | Задача                                  | Часов |
| --------------------------------------------------- | --------------------------------------- | ----: |
| [4.6.1](../tasks/4-6-1-audit-schema-and-service.md) | Schema + AuditService                   |   1-2 |
| [4.6.2](../tasks/4-6-2-audit-actions-catalog.md)    | Каталог actions + интеграция в services |   1-2 |
| [4.6.3](../tasks/4-6-3-audit-api-with-filters.md)   | API endpoint с фильтрами и pagination   |     1 |

## Не делать

- ❌ Не логировать просмотры (GET requests)
- ❌ Не логировать сами audit log API calls (зацикливание)
- ❌ Не делать UI здесь — это эпик 4.7
- ❌ Не делать export audit log в CSV — Phase 14+ (через reports)
- ❌ Не реализовывать data retention policies — Phase 14+
