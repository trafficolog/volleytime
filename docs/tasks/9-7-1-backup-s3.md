---
id: '9.7.1'
phase: '9'
epic: '9.7'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 9.9.'
roles:
  - DEVOPS
depends_on:
  - '9.2.1'
estimated_hours: '1-2'
tags:
  - backup
  - postgres
  - s3
---

# Task 9.7.1: pg_dump → S3 скрипт + cron + ретенция

## Цель

Скрипт ежедневного pg_dump (gzip) → Selectel Object Storage (S3). Cron. Ретенция (удаление старше N дней).

## Контекст

Решение 7: pg_dump → S3, ретенция 14-30 дней. Данные критичны (записи, оплаты, ledger). Бэкап на отдельном хранилище (не на том же VPS — иначе потеря VPS = потеря бэкапа).

## Что должно быть сделано

1. **Backup-скрипт `scripts/backup.sh`:**

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="volleytime_${TIMESTAMP}.sql.gz"
   TMP="/tmp/${BACKUP_FILE}"

   # pg_dump из контейнера postgres
   docker compose -f /opt/volleytime/docker-compose.prod.yml exec -T postgres \
     pg_dump -U volley volleytime | gzip > "${TMP}"

   # Upload в S3 (Selectel Object Storage, S3-совместимый)
   # через aws-cli или s3cmd, креды из env
   aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${TMP}" "s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

   rm -f "${TMP}"
   echo "[backup] uploaded ${BACKUP_FILE}"

   # Ретенция: удалить старше RETENTION_DAYS
   RETENTION_DAYS=${RETENTION_DAYS:-21}
   CUTOFF=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d)
   aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${S3_BUCKET}/backups/" | \
     awk '{print $4}' | while read -r f; do
       FILE_DATE=$(echo "$f" | grep -oP '\d{8}' | head -1)
       if [[ -n "$FILE_DATE" && "$FILE_DATE" < "$CUTOFF" ]]; then
         aws --endpoint-url "${S3_ENDPOINT}" s3 rm "s3://${S3_BUCKET}/backups/${f}"
         echo "[backup] pruned ${f}"
       fi
     done
   ```

2. **S3 креды и endpoint через env** (Selectel Object Storage S3-совместимый):

   ```
   S3_ENDPOINT=https://s3.ru-1.storage.selcloud.ru  # пример Selectel
   S3_BUCKET=volleytime-backups
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   RETENTION_DAYS=21
   ```

3. **Cron** (host crontab под deploy):

   ```cron
   # ежедневно в 04:00 (Москва, низкая нагрузка)
   0 4 * * * /opt/volleytime/scripts/backup.sh >> /var/log/volleytime-backup.log 2>&1
   ```

   Альтернатива — cron-контейнер в compose, но host cron проще для MVP.

4. **aws-cli или s3cmd** на VPS (для upload). Установить в provisioning.

5. **Логирование:** вывод в лог, проверка успеха. Опц: alert при сбое бэкапа (Sentry/cron-monitor).

## Критерии приёмки

- ✅ backup.sh: pg_dump (gzip) → S3
- ✅ S3 креды/endpoint через env (Selectel)
- ✅ Cron ежедневно (04:00 МСК)
- ✅ Ретенция: удаление старше RETENTION_DAYS (21)
- ✅ Лог бэкапов
- ✅ Бэкап на отдельном хранилище (S3, не VPS)
- ✅ Тест: запустить скрипт → бэкап в S3

## Подсказки

- **pg_dump через docker exec -T** — без TTY (для cron/скрипта). Дамп из контейнера postgres.
- **S3 на отдельном хранилище** — критично. Бэкап на том же VPS бесполезен при потере VPS. Selectel Object Storage отдельно.
- **gzip** — дампы хорошо сжимаются (текст). Экономит хранилище/трафик.
- **Ретенция** — баланс: 21 день покрывает «заметить проблему поздно», не раздувает хранилище.
- **04:00 МСК** — низкая нагрузка (волейбол вечером/утром, не ночью).
- **Тест восстановления — отдельная задача (9.7.2)**, без него бэкап не считается готовым.

## Не делать

- ❌ Не хранить бэкап только на VPS
- ❌ Не коммитить S3 креды
- ❌ Не считать бэкап готовым без теста восстановления (9.7.2)
- ❌ Не делать бэкап в пиковые часы
