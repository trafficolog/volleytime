---
id: "4.1"
phase: 4
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Базовая инфраструктура Phase 4. Без этого эпика остальные не запускаются."
---

# Epic 4.1: APScheduler infrastructure

**Цель.** Подключить APScheduler (AsyncIOScheduler), настроить persistent jobstore (задачи переживают рестарт), интегрировать со startup/shutdown lifecycle бота. Регистрация и снятие задач при создании/отмене тренировок.

## Контекст

APScheduler уже в `requirements.txt` (с Phase 1). Но не подключен. Phase 4 даёт ему жизнь.

Ключевая особенность: задачи должны **переживать рестарт бота**. Если за 24 часа до тренировки бот был выключен, после старта он должен либо отправить пропущенное напоминание (если прошло < 1 часа от планового времени), либо пропустить.

## Definition of Done

- `src/scheduler/scheduler.py` — модуль с инициализацией AsyncIOScheduler в `Europe/Minsk`
- SQLAlchemyJobStore настроен на ту же БД, что и доменные сущности (отдельная таблица `apscheduler_jobs`)
- Scheduler стартует в `main.py` в startup-фазе
- Scheduler корректно останавливается в shutdown
- При создании Training (Epic 1.3) автоматически регистрируются все его задачи (за 24 ч, за 2 ч, finished, TTL pending)
- При отмене тренировки (Epic 2.6.4) — все её задачи отменяются
- Catchup window: 1 час по умолчанию, через `misfire_grace_time`
- Логирование старта/остановки/выполнения задач

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [4.1.1](../tasks/4-1-1-scheduler-setup.md) | AsyncIOScheduler + SQLAlchemyJobStore | todo |
| [4.1.2](../tasks/4-1-2-register-jobs-on-training-create.md) | Регистрация задач при создании Training | todo |

## Не делать

- **Не используем cron-выражения для регулярных задач Phase 5** (типа недельный отчёт). Это будет Phase 5.
- **Не делаем UI для управления задачами**. Только программное.
- **Не делаем распределённый планировщик** (несколько инстансов). Бот в одном экземпляре.
