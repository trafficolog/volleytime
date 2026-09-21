---
id: '9.8.8'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Bash+Git bundle validation is deployed without host Node.js; later exact-SHA production deploys passed all release and fail-closed gates.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.8.7'
estimated_hours: '1-2'
tags:
  - cicd
  - production
  - incident
  - git
---

# Task 9.8.8: host-Node-free Git bundle release gate

## Дефект

Первый automatic bundle deploy остановился до checkout advancement с `node: command not found`. Production VPS намеренно запускает Node только внутри application containers и не обязан иметь host Node.js.

## Критерии приёмки

- [x] Bundle CLI запускается через Bash+Git без host Node.js.
- [x] Exact SHA, valid bundle, branch `prod`, clean tracked checkout и fast-forward проверки сохранены.
- [x] Невалидный/mismatched bundle, wrong branch, dirty tracked checkout и non-fast-forward остаются fail-closed.
- [x] Workflow загружает новый runtime-файл, а deploy script не вызывает `node`.
- [x] Focused contracts проходят на Windows через Git Bash и в Linux CI через Bash.
- [x] Shell syntax и все пять repository gates проходят.
- [x] Failed production run и причина отражены в последующей release evidence без заявления об успешном deploy.

## Не делать

- Не устанавливать Node.js на VPS ради release helper.
- Не ослаблять SHA или ancestry validation.
- Не обходить повторный GitHub Actions deploy вручную.

## Production evidence — 2026-09-21

- The original failed run `35463795014` established the missing host-Node cause. Subsequent workflows `35513044804` and `35566144557` completed exact-SHA bundle validation and deployment on the same Node-free host.
