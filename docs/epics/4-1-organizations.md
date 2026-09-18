---
id: '4.1'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Корневая сущность multi-tenancy. CRUD с soft-delete.'
estimated_hours: '5-6'
depends_on: ['3.2', '3.3']
---

# Epic 4.1: Organizations CRUD

**Цель.** Создать модель `Organization` в Drizzle, написать сервис и API для CRUD (create, read, update, archive). Включает slug-generation, валидацию, переключатель текущей организации.

## Контекст

`Organization` — корневая tenant сущность. Каждый user может создать неограниченное количество организаций (решение 1 в phase-card). После создания user автоматически становится owner (создаётся OrganizationMember в эпике 4.2).

Slug используется в public URLs (`/o/<slug>`) — глобально уникален.

## Definition of Done

- Drizzle schema `organizations` создана и применена через миграцию
- `organization-service.ts` с методами: `create`, `getById`, `listForUser`, `updateSettings`, `archive`
- API endpoints работают: `POST /api/organizations`, `GET /api/organizations`, `GET /api/organizations/:orgId`, `PATCH /api/organizations/:orgId`, `POST /api/organizations/:orgId/archive`
- Slug автоматически генерируется из name, проверяется uniqueness, можно переопределить вручную при создании
- При создании организации текущий user становится owner (через member service из 4.2)
- Archive — soft-delete через `status='archived'`. Archived org не показывается в `listForUser`
- Owner может изменить: name, description, city, sport_type, default_currency, default_timezone, default_member_status
- Все операции пишут в audit log (через 4.6)
- Smoke-тесты: create, listForUser, archive

## Задачи

| ID                                              | Задача                                              | Часов |
| ----------------------------------------------- | --------------------------------------------------- | ----: |
| [4.1.1](../tasks/4-1-1-organization-schema.md)  | Drizzle schema organizations + миграция             |     1 |
| [4.1.2](../tasks/4-1-2-organization-service.md) | OrganizationService (create, list, update, archive) |     2 |
| [4.1.3](../tasks/4-1-3-organization-api.md)     | API endpoints                                       |   1-2 |
| [4.1.4](../tasks/4-1-4-slug-generation.md)      | Slug generation + uniqueness                        |     1 |

## Не делать

- ❌ Не делать transfer ownership — Phase 11+
- ❌ Не делать физическое удаление — только soft-delete
- ❌ Не делать UI здесь — это эпик 4.7
- ❌ Не делать settings для разных типов sports — поле `sport_type` пока всегда `'volleyball'`
- ❌ Не делать billing / plan integration — Phase 7+
