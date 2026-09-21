---
id: '9.8.7'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Exact-SHA Git bundle delivery is the verified active production path; automatic and manual local-build deployments pass backup, migration, smoke and rollback boundaries without VPS GitHub/GHCR egress.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.8.5'
  - '9.8.6'
estimated_hours: '2-3'
tags:
  - cicd
  - git
  - production
  - rollback
---

# Task 9.8.7: автоматический production deploy из проверенного Git bundle

## Цель

Доставлять точный коммит ветки `prod` из GitHub Actions на VPS как Git bundle и собирать его локально без исходящего доступа VPS к GitHub или GHCR.

## Контекст

`ghcr.io` не разрешается с VPS, а прямой `git fetch` с VPS ранее зависал. GitHub Actions имеет рабочий отдельный SSH-ключ и обязательные production Secrets. Bundle должен пройти строгую проверку SHA и fast-forward до любых изменений checkout; backup создаётся до продвижения checkout и миграций.

## Что должно быть сделано

1. Добавить тестируемый CLI `release-bundle.mjs` с командами `verify` и `advance`.
2. Отклонять invalid/mismatched bundle, dirty tracked checkout и non-fast-forward target.
3. Разрешать untracked runtime-файлы (`.env`, `.env.images`, `backups/`, `.deploy/`).
4. Для push в `prod` создавать bundle в Actions, передавать его на VPS и запускать local build.
5. Оставить GHCR только явным manual-dispatch вариантом.
6. Сохранять порядок verify → previous SHA → backup → advance → build → migrate → up → smoke.

## Критерии приёмки

- [x] Automatic push path не выполняет на VPS `git fetch`, `git pull` или GHCR pull.
- [x] Только точный `${{ github.sha }}` принимается из валидного bundle.
- [x] Невалидный SHA/bundle, dirty tracked checkout и non-fast-forward останавливают release до изменения checkout.
- [x] Untracked production runtime-файлы сохраняются.
- [x] Backup выполняется до bundle advancement и migrations.
- [x] Push и manual local-build используют `deploy-bundle`; manual GHCR остаётся доступным.
- [x] Focused contracts, shell syntax и полный repository gate проходят.
- [x] Runbook описывает active bundle path и его rollback boundary.

## Не делать

- Не добавлять server-side fallback к GitHub/GHCR.
- Не использовать `git reset --hard` для продвижения нового релиза.
- Не принимать task branch, tag или произвольный SHA.
- Не включать `.env`, ключи или токены в bundle.

## Production evidence — 2026-09-21

- Workflow `35513044804` delivered and deployed exact SHA `c8648c25ce2e1955806cb051af5365089945d2ca` from a verified bundle; workflow `35566144557` repeated the path after controlled rollback and passed smoke.
- VPS checkout, SHA-tagged web/bot images and both health endpoints matched the workflow SHA; untracked runtime state and the immutable v0.1.3 rollback manifest remained intact.
