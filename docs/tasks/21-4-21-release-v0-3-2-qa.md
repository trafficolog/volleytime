---
id: '21.4.21'
phase: '21'
epic: '21.4'
status: in_progress
release: 'v0.3.2'
sync_state: synced
last_reviewed: 2026-11-17
status_note: 'В работе 2026-11-17: кандидат e42f2c21 (origin/main), диапазон от prod 98b60193 — миграция 0040, workflows не меняются, env и флагов нет; read-only preflight VPS пройден. v0.3.2 готово к выкладке, не выложено: ждёт зелёный main CI на кандидате, подтверждение владельца на Promote и проверки на устройствах. Отчёт: docs/operations/qa/2026-11-17-21-4-21-release-v0-3-2.md.'
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS]
depends_on: ['21.4.13', '21.4.19', '21.4.20', '21.5.10', '21.5.9']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3, release]
---

# Task 21.4.21: Релиз v0.3.2: QA, выкладка и приёмка

## Цель

Выложить `v0.3.2` (цена за час в залах с миграцией 0040, «Оплатить» должникам, исходы передачи владения, удаление проекции `pricing`) и получить приёмку владельца.

## Контекст

- Состав: [21.4.13](21-4-13-venue-hourly-price.md), [21.4.19](21-4-19-pay-button-attended-no-show.md), [21.4.20](21-4-20-ownership-transfer-outcomes-delivery-audit.md), [21.5.10](21-5-10-event-pricing-api-fields.md), [21.5.9](21-5-9-legacy-event-pricing-projection.md) — все смёржены.
- Образец — релиз `v0.3.1` ([21.4.3](21-4-3-defects-recheck-release.md), [отчёт](../operations/qa/2026-11-16-21-4-3-release-v0-3-1.md)).
- Миграция `0040` и откат — [deploy runbook, «v0.3.2 venue hourly price»](../operations/runbooks/deploy.md#v032-venue-hourly-price-no-flag-no-guard-extension-task-21413).
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (`opus+tests`); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Диапазон Promote от `origin/prod` до кандидата: миграции, workflows, env и флаги, зелёный main CI на кандидате.
2. Read-only preflight VPS: checkout, фаза, health, диск, число миграций, guard-строки отката.
3. Promote после подтверждения владельца в чате; Deploy с backup до миграции 0040, smoke.
4. Проверки после выкладки, включая шаги владельца на устройствах; тег `v0.3.2`, записи в RELEASES и current-state.

## Критерии приёмки

- ✅ Production health `release` = SHA кандидата, фаза `smoke-passed`
- ✅ `drizzle.__drizzle_migrations` = 41, колонка `venues.hourly_price` и CHECK `venues_hourly_price_range` на месте
- ✅ Backup создан до миграции
- ✅ Шаги владельца на устройствах отмечены в отчёте QA или приняты владельцем
- ✅ Отчёт QA релиза `docs/operations/qa/2026-11-17-21-4-21-release-v0-3-2.md`

## Не делать

- ❌ Не запускать Promote, Deploy, миграции и запись на VPS без подтверждения владельца в чате
- ❌ Не менять флаги и production-настройки
- ❌ Не расширять scope релиза
