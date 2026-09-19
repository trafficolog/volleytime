---
id: '9.8.9'
phase: '9'
epic: '9.8'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Production run 35464753256 reached the VPS build but exceeded the ssh-action default 10-minute command timeout on the 2 GiB host.'
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

- [ ] Долгие production deploy и rollback SSH-шаги задают явный ограниченный `command_timeout`, достаточный для локальной Docker-сборки на пилотном VPS.
- [ ] Короткие подготовительные SSH-шаги не получают необоснованно большого timeout.
- [ ] Contract test фиксирует timeout для local-build deploy и rollback.
- [ ] Runbook документирует ожидаемое время и необходимость проверки серверного процесса после timeout.
- [ ] Focused test проходит после наблюдаемого RED.
- [ ] Все пять repository gates и shell syntax проходят.
- [ ] Failed production run и причина отражены в последующей release evidence.

## Не делать

- Не отключать timeout полностью.
- Не повышать ресурсы VPS и не менять application build в рамках incident-fix.
- Не запускать повторный deploy, пока оставшийся удалённый процесс не завершён и состояние production не проверено.
