---
id: '9.8.9'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Bounded 30-minute local-build deploy/rollback timeouts are deployed; a 15m44s production deployment completed under GitHub Actions control and passed smoke.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.8.8'
estimated_hours: '1'
tags:
  - cicd
  - production
  - incident
  - timeout
---

# Task 9.8.9: bounded production deployment timeout

## Дефект

Повторный automatic bundle deploy успешно прошёл source gate и начал Docker build на VPS, но `appleboy/ssh-action` оборвал шаг через стандартные 10 минут. На пилотном сервере с 2 GiB RAM Nuxt production build всё ещё выполнялся; прежняя версия приложения оставалась healthy, а удалённый deploy-процесс продолжил работу без контроля GitHub Actions.

## Критерии приёмки

- [x] Долгие production deploy и rollback SSH-шаги задают явный ограниченный `command_timeout`, достаточный для локальной Docker-сборки на пилотном VPS.
- [x] Короткие подготовительные SSH-шаги не получают необоснованно большого timeout.
- [x] Contract test фиксирует timeout для local-build deploy и rollback.
- [x] Runbook документирует ожидаемое время и необходимость проверки серверного процесса после timeout.
- [x] Focused test проходит после наблюдаемого RED.
- [x] Все пять repository gates и shell syntax проходят.
- [x] Failed production run и причина отражены в последующей release evidence.

## Не делать

- Не отключать timeout полностью.
- Не повышать ресурсы VPS и не менять application build в рамках incident-fix.
- Не запускать повторный deploy, пока оставшийся удалённый процесс не завершён и состояние production не проверено.

## Production evidence — 2026-09-21

- Failed run `35464753256` recorded the default 10-minute timeout while the remote build continued. Redeploy workflow `35566144557` completed its VPS job in 15m44s within the explicit bound and passed smoke; no orphan deployment remained.
