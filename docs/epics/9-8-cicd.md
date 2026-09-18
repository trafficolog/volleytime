---
id: '9.8'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'GitHub Actions deploy, миграции отдельным шагом, секреты.'
estimated_hours: '3-4'
depends_on: ['9.1', '9.2', '9.3']
---

# Epic 9.8: CI/CD (GitHub Actions, миграции, секреты)

**Цель.** Автоматический деплой: push в main → build образов → деплой на VPS. Миграции отдельным шагом. Секреты через GitHub Secrets.

## Контекст

Решения 10, 11, 12: Actions build → ghcr → SSH pull (fallback build-on-VPS из РФ), миграции отдельным шагом, секреты через GitHub Secrets. Расширяет CI из Phase 3 (3.8 — тесты).

## Definition of Done

- GitHub Actions workflow: на push в main → тесты → build образов → деплой
- Build → ghcr.io push; fallback: build на VPS (если ghcr недоступен из РФ-сети VPS)
- Деплой: SSH на VPS → pull образов (или git pull + build) → миграции → docker-compose up
- Миграции отдельным шагом (drizzle migrate) ПЕРЕД перезапуском web
- Секреты в GitHub Secrets → .env на VPS при деплое
- Rollback-стратегия (предыдущий образ/тег)
- Деплой проверен (push → автоматически на проде)

## Задачи

| ID    | Задача                                         | Часов |
| ----- | ---------------------------------------------- | ----: |
| 9.8.1 | GitHub Actions deploy workflow (build + SSH)   |     2 |
| 9.8.2 | Миграции шаг + секреты (GitHub Secrets → .env) |     1 |
| 9.8.3 | Fallback build-on-VPS + rollback + проверка    |   1-2 |

## Не делать

- ❌ Не применять миграции авто-при-старте (отдельный шаг)
- ❌ Не коммитить секреты
- ❌ Не деплоить без прохождения тестов
- ❌ Не оставлять без rollback-плана
