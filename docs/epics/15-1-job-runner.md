---
id: '15.1'
phase: '15'
status: superseded
sync_state: drifted
last_reviewed: 2026-10-12
status_note: 'Поглощён задачей 20.3.1 (референс v3).'
estimated_hours: '3-4'
depends_on: ['9']
superseded_by: '20.3.1'
---

# Epic 15.1: Job runner setup (pg-boss в bot)

**Цель.** Настроить pg-boss (очередь задач на PostgreSQL) внутри bot-процесса. Регистрация обработчиков, типобезопасная обёртка для постановки/обработки задач, graceful start/stop.

## Контекст

Решения 1, 2: pg-boss (без Redis), worker в bot-процессе. pg-boss держит очередь в схеме `pgboss` той же БД (Phase 9), переживает рестарт. Bot уже постоянный процесс с Telegram API — логичное место для worker.

## Definition of Done

- pg-boss подключён к Postgres (та же БД, схема pgboss)
- Запуск worker в bot-процессе (рядом с webhook/internal listeners)
- Типобезопасная обёртка: defineJob (тип + handler), schedule (отложенная), enqueue (немедленная)
- Graceful shutdown (pg-boss.stop при остановке bot)
- Обработчики регистрируются при старте
- Job types enum (event.reminder_24h, event.reminder_2h, event.auto_finish, booking.pending_ttl, waitlist.offer_ttl, notify.deliver)

## Задачи

| ID     | Задача                                                         | Часов |
| ------ | -------------------------------------------------------------- | ----: |
| 15.1.1 | pg-boss подключение + обёртка (defineJob, schedule, enqueue)   |     2 |
| 15.1.2 | Запуск worker в bot + регистрация обработчиков + graceful stop |   1-2 |

## Не делать

- ❌ Не использовать Redis/BullMQ (pg-boss достаточно)
- ❌ Не делать отдельный worker-контейнер (в bot)
- ❌ Не терять задачи при рестарте (persistent в БД)
