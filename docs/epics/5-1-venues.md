---
id: '5.1'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Площадки. Опциональная сущность — event может ссылаться или иметь просто текст.'
estimated_hours: '2-3'
depends_on: ['4.5']
---

# Epic 5.1: Venues CRUD

**Цель.** Реализовать сущность `Venue` (площадка) — опциональная, scoped by organization. Event может ссылаться на venue_id ИЛИ иметь просто location_text.

## Контекст

Решение 16: venue опционально. Организатор, который проводит тренировки всегда в одном зале, создаёт venue один раз и переиспользует. Кто проводит в разных местах — просто пишет текстовый адрес в событии.

Venue — лёгкая сущность. Не блокирует создание событий.

## Definition of Done

- Drizzle schema `venues` (scoped by organization_id)
- VenueService: create, list, getById, update, archive (soft)
- API endpoints под `/api/organizations/:orgId/venues`
- Permission: только owner/organizer создают/редактируют venue
- Venue содержит: name, address, capacity_hint (подсказка вместимости), notes
- Soft-delete (status archived) — venue с историей событий не удаляется физически
- Smoke-тесты

## Задачи

| ID    | Задача                       | Часов |
| ----- | ---------------------------- | ----: |
| 5.1.1 | Schema venues + VenueService |   1-2 |
| 5.1.2 | API endpoints + permissions  |     1 |

## Не делать

- ❌ Не делать карты/геолокацию — Phase 14+
- ❌ Не делать фото площадки — Phase 14+
- ❌ Не делать расписание занятости venue (booking конфликты) — Phase 15+
- ❌ Не делать обязательную привязку event → venue (текст достаточен)
