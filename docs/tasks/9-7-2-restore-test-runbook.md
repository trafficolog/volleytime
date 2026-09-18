---
id: '9.7.2'
phase: '9'
epic: '9.7'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: restore-test script/runbook реализованы и hardened; восстановление реального production backup ещё не проверено.'
roles:
  - DEVOPS
depends_on:
  - '9.7.1'
estimated_hours: '1'
tags:
  - backup
  - restore
  - runbook
---

# Task 9.7.2: Тест восстановления + runbook

## Цель

Проверить восстановление из бэкапа (скачать из S3 → восстановить в чистую БД → проверить данные). Документировать процедуру восстановления (runbook).

## Контекст

Решение 7: тест восстановления обязателен. Непроверенный бэкап — иллюзия безопасности (формат битый, неполный дамп, не та БД — узнаёшь только при реальной аварии, когда поздно).

## Что должно быть сделано

1. **Restore-тест скрипт `scripts/restore-test.sh`:**

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   # 1. Скачать последний бэкап из S3
   LATEST=$(aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${S3_BUCKET}/backups/" | \
     sort | tail -1 | awk '{print $4}')
   aws --endpoint-url "${S3_ENDPOINT}" s3 cp "s3://${S3_BUCKET}/backups/${LATEST}" /tmp/restore-test.sql.gz

   # 2. Поднять временный postgres-контейнер
   docker run -d --name restore-test -e POSTGRES_PASSWORD=test \
     -e POSTGRES_DB=volleytime_test -e POSTGRES_USER=volley postgres:16-alpine
   sleep 5

   # 3. Восстановить
   gunzip -c /tmp/restore-test.sql.gz | \
     docker exec -i restore-test psql -U volley -d volleytime_test

   # 4. Проверить данные (sanity: таблицы есть, строки есть)
   docker exec restore-test psql -U volley -d volleytime_test -c \
     "SELECT count(*) FROM users; SELECT count(*) FROM events; SELECT count(*) FROM bookings;"

   # 5. Cleanup
   docker rm -f restore-test
   rm -f /tmp/restore-test.sql.gz
   echo "[restore-test] OK — backup ${LATEST} restored & verified"
   ```

2. **Провести тест:** запустить скрипт на реальном бэкапе, убедиться что данные восстанавливаются и таблицы/строки на месте.

3. **Runbook восстановления** `docs/operations/runbooks/disaster-recovery.md`:

   ```markdown
   # Disaster Recovery: восстановление из бэкапа

   ## Сценарий: потеря данных / БД повреждена

   1. Остановить web/bot (чтобы не писали): docker compose stop web bot
   2. Скачать нужный бэкап из S3:
      aws --endpoint-url ... s3 cp s3://.../backups/<file> ./
   3. Восстановить в postgres:
      gunzip -c <file> | docker compose exec -T postgres psql -U volley -d volleytime
      (при необходимости — пересоздать БД: dropdb/createdb)
   4. Проверить данные (counts, последние записи)
   5. Запустить web/bot: docker compose start web bot
   6. Проверить /health, Mini App, бота

   ## Сценарий: полная потеря VPS

   1. Provision новый VPS (runbook vps-provisioning.md)
   2. Развернуть стек (docker-compose, .env из GitHub Secrets)
   3. Восстановить БД из последнего S3-бэкапа (выше)
   4. Обновить DNS если IP сменился
   5. setWebhook (новый URL если нужно)

   ## RTO/RPO (ориентир MVP)

   - RPO (макс потеря данных): до 24ч (ежедневный бэкап)
   - RTO (время восстановления): ~1-2ч (provision + restore)
   ```

4. **Периодичность теста:** разово в Phase 9 + рекомендация повторять (квартально / при изменении схемы). Отметить в runbook.

## Критерии приёмки

- ✅ restore-test.sh: скачивает, восстанавливает в temp БД, проверяет
- ✅ Тест проведён на реальном бэкапе — данные восстановились
- ✅ Sanity-проверка (users/events/bookings counts > 0 если есть данные)
- ✅ Disaster recovery runbook (восстановление БД + полная потеря VPS)
- ✅ RTO/RPO ориентиры задокументированы
- ✅ Рекомендация периодичности теста

## Подсказки

- **Тест восстановления — главное в бэкапах.** Бэкап, который не восстанавливается — хуже отсутствия (ложная уверенность). Реальная проверка обязательна.
- **Temp-контейнер для теста** — не трогаем prod БД. Поднял, восстановил, проверил, удалил.
- **Runbook на случай паники** — в момент аварии нет времени думать. Пошаговая инструкция спасает.
- **RPO 24ч** — при ежедневном бэкапе теряется максимум день. Для MVP приемлемо (можно чаще при росте).
- **Повторять тест** — схема меняется (новые миграции), старый формат может не восстановиться. Квартально или при больших изменениях.

## Не делать

- ❌ Не считать бэкап рабочим без теста восстановления
- ❌ Не тестировать на prod БД (temp-контейнер)
- ❌ Не пропускать runbook (паника при аварии)
- ❌ Не забывать повторять тест после изменений схемы
