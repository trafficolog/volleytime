---
id: "1.1.1"
phase: 1
epic: "1.1"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - DEVOPS
  - BACK
depends_on:
  []
estimated_hours: "1-2"
tags:
  - bootstrap
  - structure
---

# Task 1.1.1: Скелет проекта

## Цель

Создать структуру каталогов и базовые файлы проекта.

## Контекст

Стартовая задача. Определяет, как будут организованы все остальные файлы.

## Что должно быть сделано

- `pyproject.toml` или `requirements.txt` с зависимостями
- `.env.example` со всеми настройками
- `.gitignore`
- `pytest.ini`
- Папки `src/`, `tests/`, `docs/`, `alembic/`

## Критерии приёмки

- `pip install -r requirements.txt` проходит без ошибок
- `python -c 'import src'` не падает

## Не делать

- Не подключать Docker (это Фаза 6)
- Не настраивать CI (это Фаза 6)
