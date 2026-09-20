---
id: '9.9.14'
phase: '9'
epic: '9.9'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Live preflight found that one-step rollback metadata points to an intermediate deploy rather than immutable v0.1.3; implementing an explicit ancestor-target rollback with legacy-Compose identity compatibility.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.8.7'
estimated_hours: '2-3'
tags:
  - deployment
  - observability
  - rollback
  - production
---

# Task 9.9.14: детерминированная release identity и rollback manifest

## Цель

Связать каждый production-контейнер и health-ответ с полным Git SHA, а rollback — с сохранённым manifest предыдущего релиза.

## Контекст

Текущий Compose выводит имя образа вместо точного release SHA. Local-build использует плавающие `latest`-теги и не управляет `.env.images`, поэтому smoke и rollback не могут доказать идентичность фактически запущенного релиза.

## Что должно быть сделано

1. Передавать `RELEASE_VERSION` как полный SHA независимо от пути деплоя.
2. Для local-build создавать SHA-тегированные web, bot и migrator images через `.env.images`.
3. Сохранять предыдущий manifest до установки нового, не затирая его при повторном деплое того же SHA.
4. При rollback восстанавливать Git SHA и предыдущий manifest до rebuild/restart.
5. Проверять ожидаемый SHA в production smoke.
6. Для controlled release acceptance принимать явный target SHA, только если он существует локально и является ancestor текущего production revision.
7. При rollback на старый Compose принудительно передавать точный `RELEASE_VERSION` и текущий allowlisted `BOT_MODE`, не полагаясь на legacy image-name fallback или hardcoded webhook.

## Критерии приёмки

- [x] Web и bot получают `RELEASE_VERSION` из явного manifest, а не из имени image.
- [x] Local-build image tags и `RELEASE_VERSION` равны полному ожидаемому SHA.
- [x] GHCR manifest также содержит полный `RELEASE_VERSION`.
- [x] `.env.images.previous` сохраняется до замены текущего manifest.
- [x] Same-SHA redeploy не заменяет previous manifest идентичным текущим manifest.
- [x] Rollback восстанавливает previous Git SHA и manifest до build/up.
- [x] Explicit rollback отклоняет malformed, missing, current и non-ancestor target SHA до изменения Git/manifest/runtime state.
- [x] Explicit rollback на legacy revision создаёт SHA-tagged target manifest и запускает web/bot через compatibility override с точным `RELEASE_VERSION` и текущим `BOT_MODE`.
- [x] Smoke отклоняет health с release, отличным от `EXPECTED_RELEASE`.
- [x] Focused contracts, shell syntax и полный repository gate проходят.

## Не делать

- Не выводить production secrets или содержимое `.env` в logs.
- Не откатывать database migrations автоматически.
- Не использовать сокращённый SHA или mutable `latest` как release identity.
- Не объявлять live rollback проверенным до отдельной production-задачи.

## Evidence до production rollback

- Live preflight: production `HEAD=e5e0c9e`, а `.deploy/previous-git-sha` и `.env.images.previous` указывали на промежуточный `debd91f`, поэтому старый one-step rollback не мог выполнить acceptance к immutable `v0.1.3=91f6bff`.
- RED: behavioral test временного Git-репозитория завершился exit 2, потому что `rollback-to` отсутствовал.
- GREEN: release identity + deploy focused contracts — 23/23; отдельный rollback contract — 6/6, включая legacy Compose и отказ unsafe targets до Docker вызовов.
- Shell syntax passed. Полные gates: format passed; lint — 0 errors (24 существующих warnings); typecheck — 6/6; test — 75 файлов, 411 тестов; build — 2/2 пакета.
