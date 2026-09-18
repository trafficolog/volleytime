---
id: '4.2'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Many-to-many user × organization. Роли и статусы.'
estimated_hours: '5-7'
depends_on: ['4.1']
---

# Epic 4.2: OrganizationMembers management

**Цель.** Реализовать модель `OrganizationMember` (many-to-many user × org), сервис для управления составом, API для admin-операций.

## Контекст

`OrganizationMember` — это связь user → organization с ролью и статусом. Один user может быть в нескольких организациях (multi-org).

Роли (enum): `owner`, `organizer`, `assistant`, `player`. В Phase 4 используем только `owner` и `player`. `organizer`/`assistant` существуют в enum, но прав не дают (это задел на Phase 5+).

Статусы: `pending` (требуется подтверждение), `active` (полноценный), `guest` (один раз для event — Phase 5), `blocked`, `left`, `rejected`.

## Definition of Done

- Drizzle schema `organization_members` с unique (organization_id, user_id)
- `MemberService` с методами: `addMember`, `listByOrg`, `getMember`, `changeRole`, `blockMember`, `unblockMember`, `leaveOrg`
- API endpoints:
  - `GET /api/organizations/:orgId/members` — список (требует membership)
  - `GET /api/organizations/:orgId/members/:memberId` — карточка
  - `PATCH /api/organizations/:orgId/members/:memberId` — изменить role / status (только owner)
  - `DELETE /api/organizations/:orgId/members/:memberId` — leave (если self) или kick (если owner)
- При создании org — auto создание owner member для creator
- При invite-принятии — auto создание member (через invite service)
- Block: status → `blocked`, в логах + уведомление
- Owner не может разжаловать сам себя
- Owner не может покинуть организацию (нужно transfer ownership — Phase 11+, либо archive org)
- Smoke + integration тесты: full lifecycle (add → block → unblock → leave)

## Задачи

| ID                                            | Задача                                         | Часов |
| --------------------------------------------- | ---------------------------------------------- | ----: |
| [4.2.1](../tasks/4-2-1-member-schema.md)      | Drizzle schema organization_members + миграция |     1 |
| [4.2.2](../tasks/4-2-2-member-service.md)     | MemberService (CRUD + role management)         |   2-3 |
| [4.2.3](../tasks/4-2-3-member-api.md)         | API endpoints                                  |   1-2 |
| [4.2.4](../tasks/4-2-4-leave-organization.md) | Leave organization (self) + edge cases         |     1 |

## Не делать

- ❌ Не реализовывать `guest` status — он для Phase 5 (event-only members)
- ❌ Не делать UI для bulk-операций ("заблокировать всех") — Phase 14+
- ❌ Не делать assistant permissions — Phase 5+ (когда появятся события)
- ❌ Не делать transfer ownership — Phase 11+
- ❌ Не отправлять email-уведомления о изменении роли — Phase 8+ (через Telegram-бот, не email)
