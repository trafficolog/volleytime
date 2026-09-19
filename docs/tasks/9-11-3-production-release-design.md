---
id: '9.11.3'
phase: '9'
epic: '9.11'
status: done
sync_state: synced
last_reviewed: 2026-09-19
status_note: 'Approved design and implementation plan define the immutable v0.1.3 baseline and the task-by-task v0.1.4 production automation release.'
roles:
  - DEVOPS
  - QA
  - SECURITY
  - DOCS
depends_on:
  - '9.7.3'
  - '9.8.5'
  - '9.9.13'
estimated_hours: '1'
tags:
  - release
  - cicd
  - documentation
---

# Task 9.11.3: дизайн production-релизов v0.1.3 и v0.1.4

## Цель

Зафиксировать проверенный production-baseline как `v0.1.3` и спроектировать отдельный patch-релиз `v0.1.4`, который автоматизирует deploy из `prod` в условиях недоступности GitHub/GHCR с VPS.

## Контекст

`main`, `prod` и production работают на `91f6bff`. Live-проверка подтвердила HTTPS, PostgreSQL, web, bot, Telegram API по IPv6 и восстановление release backup. Автоматический workflow не настроен: GitHub Secrets пусты, а VPS не разрешает `ghcr.io` и ранее нестабильно получал изменения напрямую с GitHub. Ручная сборка публикует корректный код, но `/api/health` показывает `release: dev`.

Пользователь подтвердил последовательность `v0.1.3 -> v0.1.4`, отдельный GitHub Actions deploy key и автоматический deploy через передаваемый из Actions Git bundle с локальной сборкой на VPS. Sentry, UptimeRobot и S3 остаются отдельными внешними gate.

## Что должно быть сделано

1. Описать неизменяемый baseline `v0.1.3` на коммите `91f6bff`.
2. Определить границы задач `v0.1.4`: credentials, bundle deploy, release identity, production evidence.
3. Зафиксировать security-модель отдельного CI deploy key и GitHub Secrets без вывода значений.
4. Определить TDD/CI/live acceptance и rollback-последовательность.
5. Не закрывать manual Telegram QA, Sentry/UptimeRobot и S3 без фактического evidence.

## Критерии приёмки

- [x] Письменный дизайн содержит архитектуру, data flow, security, rollback и тестирование.
- [x] `v0.1.3` привязан только к уже проверенному SHA `91f6bff`.
- [x] Каждая реализационная правка имеет отдельный будущий task/branch/PR.
- [x] Основной автоматический путь не требует исходящего GitHub/GHCR-доступа с VPS.
- [x] Текущий пользовательский и recovery-ключи не копируются в GitHub.
- [x] Необеспеченные внешние gate остаются открытыми.

## Не делать

- Не переписывать опубликованные release tags.
- Не помещать секреты в Git, логи, task-карточки или release notes.
- Не расширять scope до Phase 10+, S3 или observability без credentials.
- Не объявлять MVP полностью принятым до реального Telegram QA и недели эксплуатации.
