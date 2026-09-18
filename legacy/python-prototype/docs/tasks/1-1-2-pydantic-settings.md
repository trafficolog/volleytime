---
id: "1.1.2"
phase: 1
epic: "1.1"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BACK
depends_on:
  - 1.1.1
estimated_hours: "1"
tags:
  - config
---

# Task 1.1.2: Конфигурация (Pydantic Settings)

## Цель

Настроить чтение конфигурации из `.env` через Pydantic Settings.

## Контекст

Все параметры (BOT_TOKEN, DATABASE_URL, лимиты слотов и т.п.) должны читаться из переменных окружения. Это упрощает деплой и тесты.

## Что должно быть сделано

- `src/config.py` с классом `Settings(BaseSettings)`
- Парсер `admin_telegram_ids` из строки `1,2,3`
- Свойство `tz` → `ZoneInfo('Europe/Minsk')`
- `bot_token` опционален при импорте (для тестов), но обязателен при запуске

## Критерии приёмки

- При отсутствии `.env` тесты импортируются
- При запуске бота без `BOT_TOKEN` — внятная ошибка
- `settings.admin_telegram_ids` всегда `list[int]`

## Не делать

- Не хранить секреты в коде
- Не использовать `os.getenv` напрямую
