---
id: "6"
status: todo
sync_state: drifted
last_reviewed: 2026-05-24
status_note: "Финальная фаза. Деплой 24/7, бэкапы, мониторинг."
---

# Phase 6: Деплой в прод

**Цель.** Бот работает 24/7 с бэкапами и мониторингом.

## Definition of Done

- Бот работает 24/7 на собственном домене
- Бэкап восстановим за < 10 минут
- При исключении в коде приходит alert в Sentry
- Деплой через `git push`
- Uptime > 99% за первый месяц после деплоя

## Эпики

| ID | Эпик | Статус |
|----|------|--------|
| [6.1](../epics/6-1-migrations.md) | Миграции БД (Alembic) | todo |
| [6.2](../epics/6-2-containerization.md) | Контейнеризация | todo |
| [6.3](../epics/6-3-hosting.md) | Хостинг | todo |
| [6.4](../epics/6-4-operations.md) | Эксплуатация | todo |
| [6.5](../epics/6-5-ci-cd.md) | CI/CD | todo |

## Связанные документы

- [DEPLOY.md](../DEPLOY.md) — варианты хостинга, Dockerfile, docker-compose
- [OPERATIONS.md](../OPERATIONS.md) — что делать после деплоя
