---
id: '9.9.14'
phase: '9'
epic: '9.9'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Implementing full-SHA release identity and manifest-safe local-build rollback for v0.1.4.'
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

## Критерии приёмки

- [ ] Web и bot получают `RELEASE_VERSION` из явного manifest, а не из имени image.
- [ ] Local-build image tags и `RELEASE_VERSION` равны полному ожидаемому SHA.
- [ ] GHCR manifest также содержит полный `RELEASE_VERSION`.
- [ ] `.env.images.previous` сохраняется до замены текущего manifest.
- [ ] Same-SHA redeploy не заменяет previous manifest идентичным текущим manifest.
- [ ] Rollback восстанавливает previous Git SHA и manifest до build/up.
- [ ] Smoke отклоняет health с release, отличным от `EXPECTED_RELEASE`.
- [ ] Focused contracts, shell syntax и полный repository gate проходят.

## Не делать

- Не выводить production secrets или содержимое `.env` в logs.
- Не откатывать database migrations автоматически.
- Не использовать сокращённый SHA или mutable `latest` как release identity.
- Не объявлять live rollback проверенным до отдельной production-задачи.
