---
id: '5.2'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Событие — центральная сущность Phase 5. Capacity + waitlist модель.'
estimated_hours: '6-8'
depends_on: ['5.1']
---

# Epic 5.2: Events CRUD

**Цель.** Реализовать модель `Event` — центральную сущность. Создание, редактирование, отмена, листинг. Capacity + cancellation deadline.

## Контекст

Event — то, на что записываются игроки. Решения: type training/open_game (идентичны), единый capacity + waitlist, cancellation_deadline_hours настраивается организатором.

Event НЕ занимается распределением слотов сам — это делает BookingService (5.3). Event только хранит capacity и метаданные.

## Definition of Done

- Drizzle schema `events` со статусами и type enum
- EventService: create, list (с фильтрами upcoming/past), getById, update, cancel
- Поля: title, type, venue_id (опц), location_text, starts_at, ends_at, capacity, price, currency, cancellation_deadline_hours, status, description
- Event status: draft → published → closed → finished → cancelled
- API endpoints под `/api/organizations/:orgId/events`
- Permission: owner/organizer создают/редактируют
- Listing: фильтр по статусу, по датам (upcoming/past), сортировка по starts_at
- Computed поля при чтении: confirmed_count, waitlist_count, available_spots
- Все мутации в audit
- Smoke + integration тесты

## Задачи

| ID    | Задача                                      | Часов |
| ----- | ------------------------------------------- | ----: |
| 5.2.1 | Schema events + миграция                    |     1 |
| 5.2.2 | EventService (CRUD + cancel)                |   2-3 |
| 5.2.3 | Event listing с фильтрами + computed counts |     2 |
| 5.2.4 | API endpoints + permissions                 |   1-2 |

## Не делать

- ❌ Не делать recurring/RRULE — Phase 15
- ❌ Не делать main/rotation слоты — только capacity
- ❌ Не делать tournament_match логику — Phase 16
- ❌ Не делать привязку к matches/scoreboard — Phase 16
- ❌ Не делать booking логику здесь — это эпик 5.3
