---
id: '9.11.4'
phase: '9'
epic: '9.11'
status: in_progress
sync_state: local
last_reviewed: 2026-09-21
status_note: 'Reconciling exact production evidence for v0.1.4 before final docs-inclusive promotion and immutable release publication.'
roles:
  - DEVOPS
  - QA
  - SECURITY
  - DOCS
depends_on:
  - '9.8.7'
  - '9.9.14'
estimated_hours: '2-3'
tags:
  - release
  - production
  - evidence
  - documentation
---

# Task 9.11.4: production evidence и публикация v0.1.4

## Цель

Свести проверенные production-факты в единый непротиворечивый статус, провести docs-inclusive revision через `main` и `prod` и опубликовать неизменяемый релиз `v0.1.4` на фактически работающем SHA.

## Контекст

Bundle-based deploy, deterministic release identity, polling fallback и explicit rollback реализованы отдельными SDD-задачами. До публикации релиза требуется перепроверить критерии связанных карточек, сохранить неподтверждённые внешние gate открытыми и доказать совпадение GitHub, VPS и health identity после финального деплоя.

## Что должно быть сделано

1. Перепроверить acceptance criteria production-карточек и закрыть только полностью подтверждённые.
2. Обновить release/status/changelog/runbook без секретов и устаревших утверждений.
3. Зафиксировать tested candidate, workflow, backup/restore и rollback/redeploy evidence.
4. Провести полный repository gate и CI документационного PR.
5. Продвинуть финальный `main` в `prod` и доказать exact-SHA parity во всех runtime surfaces.
6. Создать annotated tag и GitHub Release `v0.1.4` только на финальном production SHA.

## Критерии приёмки

- [x] Каждая изменённая task-карточка сопоставлена с её полным acceptance и датированным evidence.
- [x] Manual Telegram QA, Sentry/UptimeRobot, S3 и недельный MVP gate не объявлены выполненными без фактического подтверждения.
- [x] Release notes содержат tested candidate SHA, workflow URL, rollback/redeploy, backup/restore и явные исключения.
- [x] Current state, release plan, changelog и deploy runbook согласованы с bundle/local-build как активным production path.
- [ ] Полные локальные gates и GitHub CI проходят.
- [ ] GitHub `main`, GitHub `prod`, VPS HEAD, web health и bot health совпадают по полному финальному SHA.
- [ ] `v0.1.4` опубликован как неизменяемый annotated tag и GitHub Release на финальном production SHA.
- [ ] Финальный аудит подтверждает здоровый runtime, валидный release backup, наличие требуемых secret names и отсутствие временных release-артефактов.

## Prepared evidence — 2026-09-21

- Tested code candidate: `c8648c25ce2e1955806cb051af5365089945d2ca`.
- Candidate workflow `35513044804`, controlled rollback to `v0.1.3` and redeploy workflow `35566144557` passed; exact Git/web/bot identity and polling mode were independently read back.
- Latest audited release backup: `volleytime_20260921_055333.sql.gz`, mode `0600`, SHA-256 `7238f784a7743910ad2bdb8f9879ebc89ca4747531ffde09f6357c779d584e23`, valid gzip; no restore container remained.
- Required GitHub Secret names and `PRODUCTION_BOT_MODE=polling` were read back without exposing secret values.
- Local gates: format passed; lint passed with 0 errors and 24 existing warnings; typecheck 6/6; test 75 files / 411 tests; build 2/2 packages. GitHub CI, final promotion, immutable tag and post-deploy audit remain post-merge operations.

## Не делать

- Не включать значения секретов, токены, приватные ключи или secret webhook paths.
- Не закрывать критерии на основании одних repository-тестов.
- Не переписывать существующие release tags.
- Не объявлять весь R0/MVP принятым до недели реальной эксплуатации.
