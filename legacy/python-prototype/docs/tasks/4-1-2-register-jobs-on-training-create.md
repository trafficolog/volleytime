---
id: "4.1.2"
phase: 4
epic: "4.1"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - BOT
depends_on:
  - "4.1.1"
estimated_hours: "2-3"
tags:
  - scheduler
  - integration
---

# Task 4.1.2: Регистрация задач при создании Training

## Цель

Когда админ создаёт тренировку (Epic 1.3, FSM `admin:training:new`), автоматически регистрируется 4 задачи:
1. `send_24h_reminder` за 24 ч до starts_at
2. `send_2h_reminder_and_close` за 2 ч до starts_at
3. `auto_finish_training` через 30 мин после ends_at
4. (заготовка для 4.3.3) — auto-finished

При отмене тренировки (Epic 2.6.4) — все эти задачи отменяются.

## Контекст

ID задачи строится по схеме `{job_kind}_{training_id}` — `reminder_24h_42`, `reminder_2h_42`, `finish_42`. Это позволяет программно найти и снять конкретные задачи при отмене тренировки.

## Что должно быть сделано

- В `src/scheduler/jobs.py` (новый модуль):
  - `JOB_KINDS` constants: `REMINDER_24H = "reminder_24h"`, `REMINDER_2H = "reminder_2h"`, `FINISH = "finish"`
  - Функция `def job_id(kind: str, training_id: int) -> str` → `f"{kind}_{training_id}"`
  - Функции-задачи (пока пустые stub'ы — наполняются в 4.2/4.3):
    - `async def send_24h_reminder(training_id: int) -> None`
    - `async def send_2h_reminder_and_close(training_id: int) -> None`
    - `async def auto_finish_training(training_id: int) -> None`
- В `src/scheduler/scheduler.py`:
  - `register_training_jobs(scheduler, training: Training)`:
    - `scheduler.add_job(send_24h_reminder, 'date', run_date=training.starts_at - timedelta(hours=24), id=job_id(REMINDER_24H, training.id), args=[training.id], replace_existing=True)`
    - Аналогично для 2h и finish
    - Учесть: если до старта < 24 ч, не регистрируем задачу 24h
    - Учесть: если до старта < 2 ч, не регистрируем 2h
  - `cancel_training_jobs(scheduler, training_id: int)`:
    - Для каждого job_kind — `scheduler.remove_job(job_id(...), ignore_if_not_exists=True)`
- В хендлере создания тренировки (admin) — после `session.commit()` вызвать `register_training_jobs(scheduler, training)`
- В хендлере отмены (Task 2.6.4 — обновить) — вызвать `cancel_training_jobs(scheduler, training_id)`
- `scheduler` доступен через middleware/DI (как notifier)

## Критерии приёмки

- Создание тренировки → в `apscheduler_jobs` появляется 3 записи
- Отмена тренировки → они удаляются
- Создание тренировки с `starts_at = now + 1 час` → регистрируется только finish (без 24h и 2h)
- При рестарте бота задачи на месте, выполняются по плану

## Подсказки

- DI для scheduler: можно через `SchedulerMiddleware` по аналогии с `NotifierMiddleware`.
- Если в момент регистрации `run_date` уже в прошлом — APScheduler выполнит сразу или применит `misfire_grace_time`. Для напоминаний это плохо (отправить «напоминание за 24 ч» через 24+1 час бессмысленно). Решение: проверять `run_date > now` перед `add_job`.

## Не делать

- Не регистрировать задачи Phase 5 (отчёты) — они с другим триггером.
- Не делать «обновить задачу при изменении тренировки» — у нас нет UI редактирования тренировки.
- Не передавать в job сам объект Training — только `training_id`. Job сам перезагрузит из БД.
