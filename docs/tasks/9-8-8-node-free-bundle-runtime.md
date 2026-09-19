---
id: '9.8.8'
phase: '9'
epic: '9.8'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Production run 35463795014 proved that the VPS has Git and Bash but no host Node.js; replacing the release gate runtime without weakening validation.'
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

- [ ] Bundle CLI запускается через Bash+Git без host Node.js.
- [ ] Exact SHA, valid bundle, branch `prod`, clean tracked checkout и fast-forward проверки сохранены.
- [ ] Невалидный/mismatched bundle, wrong branch, dirty tracked checkout и non-fast-forward остаются fail-closed.
- [ ] Workflow загружает новый runtime-файл, а deploy script не вызывает `node`.
- [ ] Focused contracts проходят на Windows через Git Bash и в Linux CI через Bash.
- [ ] Shell syntax и все пять repository gates проходят.
- [ ] Failed production run и причина отражены в последующей release evidence без заявления об успешном deploy.

## Не делать

- Не устанавливать Node.js на VPS ради release helper.
- Не ослаблять SHA или ancestry validation.
- Не обходить повторный GitHub Actions deploy вручную.
