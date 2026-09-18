---
id: "1.3.3"
phase: 1
epic: "1.3"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
  - BOT
depends_on:
  - 1.2.1
estimated_hours: "4-6"
tags:
  - booking
  - core
---

# Task 1.3.3: BookingService и хендлеры записи

## Цель

Реализовать BookingService с распределением слотов и хендлеры записи/отмены.

## Контекст

Ядро MVP: пользователь жмёт «Записаться», получает место в main/rotation/waitlist в зависимости от заполненности.

## Что должно быть сделано

- `BookingService.propose_slot(training_id, user_id)` → `BookingProposal`
- `BookingService.create_booking(...)` с защитой от гонок
- `BookingService.cancel_booking(...)` и `promote_from_waitlist(...)`
- Доменные исключения: BookingError, AlreadyBookedError, NoSlotsError, TrainingClosedError
- Хендлеры: `training:view`, `booking:start`, `booking:cancel`

## Критерии приёмки

- Первый игрок попадает в `main`
- 13-й — в `rotation`
- 15-й — в `waitlist` с позицией
- Нельзя записаться дважды на одну тренировку
- Нельзя записаться за < 2 ч до начала
- При отмене первый из waitlist продвигается

## Не делать

- Не добавлять оплату — это Фаза 2
- Не делать автоматические напоминания — это Фаза 4
