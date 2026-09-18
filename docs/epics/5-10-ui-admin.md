---
id: '5.10'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'UI организатора. Mini App + Web (создание удобнее с десктопа).'
estimated_hours: '5-6'
depends_on: ['5.7']
---

# Epic 5.10: UI admin (создание событий, планы, attendance)

**Цель.** Страницы организатора: создание/редактирование событий (с venue), управление площадками, управление subscription plans, список записей события с отметкой посещаемости (bulk).

## Контекст

Решение 4: Mini App полный + Web для админских страниц (создание с десктопа удобнее). Решение 6: attendance через чекбоксы + кнопка «Сохранить» (bulk).

Owner/organizer flow. Переиспользует canManageContent permission, формы-паттерны из Phase 4 (4.7.2 create org).

## Definition of Done

- `/m/orgs/:orgId/events/new` + `/edit` — форма события (title, type, время, venue/location, capacity, price, deadline)
- Web-версии `/orgs/:orgId/events/new` (удобнее заполнять с десктопа)
- `/m/orgs/:orgId/venues` — список + создание/редактирование площадок
- `/m/orgs/:orgId/plans` (admin view) — управление subscription plans
- `/m/orgs/:orgId/events/:id/bookings` — список записей (confirmed/waitlist/pending) + attendance чекбоксы + сохранение bulk
- Permission UI: страницы доступны только owner/organizer (редирект/403 для player)

## Задачи

| ID     | Задача                                                    | Часов |
| ------ | --------------------------------------------------------- | ----: |
| 5.10.1 | Форма создания/редактирования события + venues management |   2-3 |
| 5.10.2 | Управление subscription plans (admin)                     |   1-2 |
| 5.10.3 | Список записей события + bulk attendance                  |   1-2 |

## Не делать

- ❌ Не делать recurring UI — Phase 15
- ❌ Не делать аналитику посещаемости — Phase 14
- ❌ Не делать mass refund UI — Phase 6
- ❌ Не делать Root Admin layer — после Phase 10
