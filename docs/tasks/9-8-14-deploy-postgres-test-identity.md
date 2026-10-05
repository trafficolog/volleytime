---
id: '9.8.14'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'Локальный RED→GREEN workflow→consumer и реальные PostgreSQL guard/races подтверждены; минимальный deploy test-step env fix реализован. Frozen five-gate evidence фиксируется отдельным локальным report. Independent scoped review, exact-head CI, PR/main integration и exact-main CI остаются открыты.'
roles: [DEVOPS, QA]
depends_on: []
tags: [mvp, split, deployment, tests]
---

# Task 9.8.14: PostgreSQL transport identity в deploy test gate

## Цель

Устранить доказанное различие test environment между CI и Deploy без ослабления fail-closed PostgreSQL transport guard.

## Контекст

Полный кандидат `bbd6f41e518f916b14d36180d5e510cf9fadaefc` принят PR91 и exact-head/main CI. Однако [Deploy37328474440](https://github.com/trafficolog/volleytime/actions/runs/37328474440) остановился на Test before deploy: 1310 passed / 6 failed, два файла. Все шесть отказов происходят в `postgresTestConfig` на отсутствии exact `POSTGRES_TEST_CONTAINER_ID`. В ci.yml Run tests передаёт `${{ job.services.postgres.id }}`, в deploy.yml pnpm test этот env не получает. Build/Deploy jobs skipped; VPS Git, phase и public health подтверждены на прежнем `967aff312f962196e7347cc0e50f879f25f6dffa`, staging нового SHA отсутствует.

## Что должно быть сделано

1. Добавить регрессионное покрытие для test command обоих workflow: явно выбранный PostgreSQL service ID должен достигать существующего consumer `postgresTestConfig`; конфигурация другого шага или другой job не считается передачей. Получить RED для Deploy до исправления.
2. Минимально передать `POSTGRES_TEST_CONTAINER_ID: ${{ job.services.postgres.id }}` непосредственно шагу `pnpm test` Deploy по существующему CI pattern. Сохранить guards exact ID/image/endpoint/database/user/cluster, все реальные DB races и assertions. Не добавлять discovery/fallback/skip.
3. GREEN targeted contract и реальные split rollback guard/races на существующей авторизованной test DB, затем один freeze и пять отдельных gates. Зафиксировать RED/GREEN, source identity и результаты; не повторять unchanged UI/Telegram QA.
4. Синхронизировать release/status и owning release task9.8.11: failed attempt — pre-VPS, новый локальный checkpoint не означает deployment acceptance. Independent scoped spec/quality review и exact-head/main CI обязательны перед последующим reviewed FF prod.

## Критерии приёмки

### Local implementation checkpoint — 2026-10-05

- На base `bbd6f41e518f916b14d36180d5e510cf9fadaefc` focused RED: CI PASS, Deploy FAIL с `PostgreSQL transport identity is unproven`; после двухстрочного deploy env fix focused GREEN: 2 файла / 29 тестов, включая реальные PostgreSQL rollback races. Boundary regression выбирает actual test job/step, передаёт его env в существующий `postgresTestConfig` и отказывает при identity в другом шаге/job. Existing exact-ID/image/endpoint/database/user/cluster guard и race assertions сохранены.
- Единственные изменения вне документации: `.github/workflows/deploy.yml` и `split-rollback-guard.test.ts`; product business/schema/UI и dependencies byte-identical base. Локальные source freeze, пять gates, logs/cache/warnings и self-review фиксируются в `.superpowers/sdd/2026-10-01-event-split-pricing/task-9.8.14-report.md`, evidence `output/playwright/task-9.8.14/`. Original QA/output и failed Deploy evidence сохранены.
- Карточка остаётся `in_progress`: локальный checkpoint не подтверждает hosted Actions execution, review/CI/PR/main acceptance или deployment. Controlled deploy и Telegram/pilot acceptance остаются отдельными критериями 9.8.11.

- Регрессия воспроизведена до workflow fix; после него actual test-step environment обоих workflow удовлетворяет существующему transport config consumer. Missing/wrong identity остаётся отказом.
- Ровно минимальная env propagation; без production business/source/schema/UI changes, dependency additions, timeout increases и удаления проверок.
- Пять gates с PostgreSQL проходят на frozen source; ошибки/предупреждения и cache provenance раскрыты, прежний failed workflow сохранён.
- Отдельные review/CI/PR/main integration подтверждены; controlled deploy и ручная Telegram/pilot acceptance остаются отдельными критериями9.8.11, а не task9.8.14.

## Подсказки

Существующие transport helper и `split-rollback-guard.test.ts`; working `.github/workflows/ci.yml`; failed `.github/workflows/deploy.yml`. Тест проверяет передачу env на границе workflow→consumer, не только наличие строки где-либо в файле.

## Не делать

Не обходить transport identity, не reset DB, не менять production secrets/flag/runtime/data, не запускать старый workflow вслепую, не server-side pull/build, не удалять backup/images/evidence, не создавать tag/Release. Не трогать original foreground QA/output или другие worktrees.
