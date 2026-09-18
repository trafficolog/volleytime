---
id: "4.1.1"
phase: 4
epic: "4.1"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - DEVOPS
depends_on: []
estimated_hours: "2-3"
tags:
  - scheduler
  - infrastructure
---

# Task 4.1.1: AsyncIOScheduler + SQLAlchemyJobStore

## Цель

Подключить APScheduler (AsyncIOScheduler) с SQLAlchemyJobStore. Задачи должны переживать рестарт бота.

## Контекст

APScheduler 3.10.4 уже в `requirements.txt`. Phase 4 — первая фаза, которая его реально использует.

Ключевой выбор — **persistent jobstore**. Используем тот же SQLite/PostgreSQL, что и для доменных данных. APScheduler создаст свою таблицу `apscheduler_jobs`.

## Что должно быть сделано

- Новый модуль `src/scheduler/scheduler.py`:
  - `create_scheduler() -> AsyncIOScheduler` — фабрика
  - Использует `SQLAlchemyJobStore(url=settings.database_url_sync)` — APScheduler требует sync-url
  - Timezone — `settings.tz` (Europe/Minsk)
  - `misfire_grace_time = 3600` (1 час) на все задачи по умолчанию
  - Coalesce = True (при пропуске нескольких срабатываний — выполнить одно)
- В `src/bot/main.py` интегрировать lifecycle:
  - При старте: `scheduler = create_scheduler()`, `scheduler.start()`
  - В `dp.startup.register` — лог `event="scheduler_started"`, перечисление активных задач
  - При `dp.shutdown.register` — `scheduler.shutdown(wait=True)`, лог `event="scheduler_stopped"`
- Sync URL для APScheduler:
  - В settings добавить computed property `database_url_sync` — преобразует `sqlite+aiosqlite://` → `sqlite://`, `postgresql+asyncpg://` → `postgresql://`
  - APScheduler не умеет в async-driver, только sync. Это OK, потому что он сам управляет своими транзакциями.

## Критерии приёмки

- При старте бота создаётся таблица `apscheduler_jobs` (SQLAlchemyJobStore делает это сам)
- Тестовая задача `scheduler.add_job(some_func, 'date', run_date=now+10s)` — после рестарта бота через < 1 час всё ещё в БД и выполняется
- `pytest` для smoke-теста: scheduler стартует, добавляется задача, шатдаун
- В логах при старте видно количество загруженных pending-задач

## Подсказки

- APScheduler async-документация: https://apscheduler.readthedocs.io/en/3.x/userguide.html#integrating-with-asyncio
- Импорт: `from apscheduler.schedulers.asyncio import AsyncIOScheduler`, `from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore`
- `database_url_sync`: можно через `re.sub(r"\+aiosqlite", "", url)` или явный map.

## Не делать

- Не делать distributed scheduler (несколько инстансов через Redis). Один бот = один процесс.
- Не использовать ThreadPoolExecutor — все наши задачи async.
- Не складывать задачи Phase 5 (отчёты, экспорт) — пока только инфраструктура.
