---
id: "6.1.1"
phase: 6
epic: "6.1"
status: todo
sync_state: drifted
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
  - DB
  - DEVOPS
depends_on:
  []
estimated_hours: "2-3"
tags:
  - migrations
  - alembic
---

# Task 6.1.1: Настройка Alembic

## Цель

Переключить проект с `create_all` на Alembic-миграции.

## Контекст

В проде нельзя менять схему через create_all — нужны контролируемые миграции с возможностью отката.

## Что должно быть сделано

- `alembic init alembic`
- Настройка `alembic/env.py` под async-движок
- Скрипт `alembic upgrade head` в Dockerfile entrypoint
- Удаление init_db() из main.py

## Критерии приёмки

- `alembic upgrade head` создаёт всю схему с нуля
- `alembic downgrade -1` откатывает последнюю миграцию
- Существующая SQLite база переходит на Alembic без потери данных

## Не делать

- Не оставлять `Base.metadata.create_all` в проде
