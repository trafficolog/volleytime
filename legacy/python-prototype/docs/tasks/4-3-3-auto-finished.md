---
id: "4.3.3"
phase: 4
epic: "4.3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on:
  - "4.1.2"
estimated_hours: "1"
tags:
  - scheduler
  - training
---

# Task 4.3.3: Авто-finished для прошедших тренировок

## Цель

Через 30 минут после `Training.ends_at` автоматически перевести тренировку в `TrainingStatus.finished`. Опционально — напомнить админу: «отметьте посещаемость».

## Контекст

В Phase 2 (Task 2.6.3) есть отметка посещаемости, но только для тренировок с прошедшим временем начала. Чтобы UX был однозначным, статус Training должен явно стать `finished`.

## Что должно быть сделано

- Доработать `auto_finish_training(training_id)` в `src/scheduler/jobs.py`:
  1. Загрузить Training
  2. Если статус уже `cancelled` или `finished` — выйти
  3. Если `now < ends_at + 30 min` — это race (раннее срабатывание) — выйти
  4. `Training.status = finished`
  5. (опционально) `Notifier.send_to_admins`: «🏐 Тренировка {dt} завершена. Отметьте посещаемость в админ-меню → Тренировки.»
- Job регистрируется в 4.1.2 при создании тренировки на `run_date = training.ends_at + timedelta(minutes=30)`

## Критерии приёмки

- Тест: тренировка с ends_at = now-1h, status=closed → job → status=finished
- Тест: тренировка с status=cancelled → job → status НЕ меняется
- Тест: при тестировании сделать `freezegun` на момент после ends_at + 30 мин

## Подсказки

- Это самая простая job в Phase 4.
- Уведомление админу можно не делать в первой итерации, добавить в Phase 5 если будет нужно.

## Не делать

- Не отменять связанные брони — они уже отыграли свою роль (attended / confirmed).
- Не очищать историю бронирований из finished-тренировок (это для отчётов в Phase 5).
