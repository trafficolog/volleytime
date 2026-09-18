---
id: '5.12'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Финальные integration tests Phase 5: full lifecycle + UI smoke.'
estimated_hours: '3-4'
depends_on: ['5.9', '5.10', '5.11']
---

# Epic 5.12: Финальные integration tests

**Цель.** End-to-end проверка полного цикла Phase 5 через UI-слой и API. Smoke-тесты ключевых страниц. Регрессия Phase 4 не сломана.

## Контекст

Backend-тесты (5.8) покрыли сервисную логику. Этот эпик — финальная проверка что всё работает вместе: от создания события организатором до записи игрока и отметки посещаемости. Плюс sanity UI-компонентов.

Vue Test Utils отложен с Phase 3 (3.7 был sanity-уровень). В Phase 5 — sanity UI smoke (компоненты рендерятся без ошибок) + API-level full lifecycle (через сервисы, имитируя действия из UI).

## Definition of Done

- Full lifecycle test: создать событие → купить абонемент → записаться → отметить посещаемость → отменить → восстановление+промоушн (через сервисы, как делал бы UI)
- Проверка что computed-поля (confirmedCount/availableSpots) корректны после операций
- Smoke: ключевые страницы/компоненты импортируются и рендерятся (EventCapacityBar, BookingSheet, EventForm)
- Регрессия: Phase 4 тесты зелёные, Phase 5 backend тесты зелёные
- Все инварианты держатся

## Задачи

| ID     | Задача                                              | Часов |
| ------ | --------------------------------------------------- | ----: |
| 5.12.1 | Full lifecycle integration test (UI-flow через API) |     2 |
| 5.12.2 | UI smoke + регрессия                                |   1-2 |

## Не делать

- ❌ Не делать E2E через браузер (Playwright) — Phase 9
- ❌ Не делать визуальное тестирование
- ❌ Не делать нагрузочное — Phase 10
