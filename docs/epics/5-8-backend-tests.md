---
id: '5.8'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Backend tests: flows, concurrency, edge cases. Критичны для корректности ядра.'
estimated_hours: '5-7'
depends_on: ['5.3', '5.5', '5.6', '5.7']
---

# Epic 5.8: Backend tests (flows + race)

**Цель.** Покрыть тестами всё backend-ядро Phase 5. Особое внимание concurrency (capacity, consume) и сложным flow (booking с абонемента → отмена → restore + promotion).

## Контекст

Phase 5 — самая критичная по корректности фаза. Баги здесь = неправильные списания денег/сессий, переполнение слотов, потерянные записи. Тесты — основная защита.

Переносим тестовые сценарии из Python-прототипа (там было 25 тестов на эту логику).

## Definition of Done

- **Booking flows:**
  - Запись при наличии места → confirmed
  - Запись при заполненном capacity → waitlisted
  - Повторная запись того же user → ошибка (unique)
  - Запись не-члена → отказ
  - Запись на закрытое/завершённое событие → отказ
- **Subscription flows:**
  - Запись с абонемента → atomic consume, booking confirmed
  - FIFO: при нескольких абонементах списывается с наименьшим expires_at
  - Exhausted абонемент (used=total) не используется
  - Expired абонемент не используется
- **Cancellation + waitlist:**
  - Отмена confirmed с абонемента → restore session + promotion первого waitlist
  - Отмена waitlisted → без promotion
  - Cancellation deadline: после дедлайна игрок не может отменить, owner может
  - Chain promotion: отмена → promote → этот тоже отменяет → promote следующего
- **Concurrency (race):**
  - Последний слот, N игроков одновременно → ровно 1 confirmed, остальные waitlisted
  - Атомарный consume: N параллельных списаний с абонемента total=M → ровно M успехов
  - Capacity никогда не превышается
- ≥ 30 тестов, все стабильные (не flaky)

## Задачи

| ID    | Задача                                     | Часов |
| ----- | ------------------------------------------ | ----: |
| 5.8.1 | Booking + subscription flow tests          |   2-3 |
| 5.8.2 | Cancellation + waitlist promotion tests    |   1-2 |
| 5.8.3 | Concurrency/race tests (capacity, consume) |     2 |

## Не делать

- ❌ Не делать E2E через HTTP — Phase 9
- ❌ Не делать load testing — Phase 10
- ❌ Не делать UI тесты — эпик 5.12
- ❌ Не дублировать Phase 4 тесты
