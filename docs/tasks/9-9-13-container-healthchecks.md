---
id: '9.9.13'
phase: '9'
epic: '9.9'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Live deploy serves external HTTPS successfully, but Docker marks web unhealthy because Alpine resolves localhost to ::1 while the Node process listens on IPv4 0.0.0.0.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.2.1'
estimated_hours: '0.5'
tags:
  - docker
  - healthcheck
  - production
  - ipv6
---

# Task 9.9.13: однозначные IPv4 container healthchecks

## Цель

Сделать Docker healthchecks web и bot согласованными с фактическими IPv4 listeners, чтобы healthy/unhealthy отражал состояние процесса, а не выбор `::1` для `localhost`.

## Диагноз

После первого production deploy внешний `https://volleytime.by/api/health` возвращает 200 и `db=ok`, но `vt_web` становится unhealthy. Docker health log содержит `wget: can't connect to remote host: Connection refused`; ручной запрос внутри контейнера показывает `localhost:3000 ([::1]:3000)`, тогда как Nuxt сообщает `Listening on http://0.0.0.0:3000`.

Bot использует тот же шаблон `localhost` для listener на IPv4 и подвержен той же ложной диагностике.

## Что должно быть сделано

1. Web healthcheck обращается к `http://127.0.0.1:3000/api/health`.
2. Bot healthcheck обращается к `http://127.0.0.1:3001/healthz`.
3. Контрактный тест запрещает `localhost` в production healthchecks.
4. После deploy оба контейнера переходят в healthy, restart count не растёт.

## Критерии приёмки

- [ ] Focused compose contract test проходит.
- [ ] Внутренние IPv4 health endpoints отвечают 200.
- [ ] `docker compose ps` показывает web/bot healthy.
- [ ] Внешний HTTPS health остаётся 200.

## Не делать

- Не переводить application listener на IPv6 ради healthcheck.
- Не увеличивать retries/timeout, скрывая ошибочный адрес.
- Не ослаблять содержательную проверку `/api/health` и `/healthz`.
