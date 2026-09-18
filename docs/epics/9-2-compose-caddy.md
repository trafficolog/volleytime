---
id: '9.2'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'docker-compose.prod (4 контейнера) + Caddy auto-HTTPS + внутренняя сеть.'
estimated_hours: '3-4'
depends_on: ['9.1']
---

# Epic 9.2: docker-compose.prod + Caddy (HTTPS, internal network)

**Цель.** docker-compose.prod.yml с 4 сервисами (caddy, web, bot, postgres). Caddy auto-HTTPS + reverse proxy. Внутренняя сеть для web→bot internal notify и доступа к postgres.

## Контекст

Решения 1, 4, 6: 4 контейнера, internal notify по внутренней сети, Caddy auto-HTTPS. Caddy терминирует HTTPS, проксирует volleytime.by → web и /tg/webhook → bot. Internal notify (web→bot:3001) и postgres — только внутренняя сеть.

## Definition of Done

- docker-compose.prod.yml: caddy, web, bot, postgres
- Caddyfile: volleytime.by → web:3000, /tg/webhook/* → bot:8443, auto-HTTPS
- Внутренняя сеть: web↔bot (internal notify), web/bot↔postgres
- postgres volume (персистентность)
- Caddy volume (сертификаты)
- env через .env файл (секреты)
- Healthchecks для сервисов
- Restart policies (unless-stopped)

## Задачи

| ID    | Задача                                             | Часов |
| ----- | -------------------------------------------------- | ----: |
| 9.2.1 | docker-compose.prod.yml (4 сервиса, сети, volumes) |     2 |
| 9.2.2 | Caddyfile (HTTPS, reverse proxy, webhook routing)  |   1-2 |

## Не делать

- ❌ Не выставлять postgres/internal notify наружу
- ❌ Не хранить сертификаты вне volume (потеря при пересоздании)
- ❌ Не коммитить .env
