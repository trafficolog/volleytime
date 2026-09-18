# Disaster Recovery

## Ориентиры

- **RPO** (макс. потеря данных): до 24 ч — бэкап ежедневно в 04:00 МСК
- **RTO** (время восстановления): ~1–2 ч

## Сценарий 1: повреждены/потеряны данные

1. Остановить приложения (БД не трогаем):
   ```bash
   cd /opt/volleytime && docker compose -f docker-compose.prod.yml stop web bot
   ```
2. Скачать нужный бэкап:
   ```bash
   aws --endpoint-url $S3_ENDPOINT s3 ls s3://$S3_BUCKET/backups/
   aws --endpoint-url $S3_ENDPOINT s3 cp s3://$S3_BUCKET/backups/<файл> ./restore.sql.gz
   ```
3. Восстановить:
   ```bash
   gunzip -c restore.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres \
     psql -U volley -d volleytime
   ```
4. Проверить данные (counts, последние события), запустить: `docker compose ... start web bot`
5. Проверить `/api/health`, открыть Mini App, отправить `/start` боту

## Сценарий 2: потерян весь VPS

1. Поднять новый VPS по `vps-provisioning.md`
2. Скопировать `docker-compose.prod.yml`, `Caddyfile`, `.env` в `/opt/volleytime`
3. `docker compose -f docker-compose.prod.yml up -d postgres` → дождаться healthy
4. Восстановить БД (шаги 2–3 выше)
5. Применить миграции: `pnpm db:migrate` (если бэкап старее схемы)
6. `docker compose -f docker-compose.prod.yml up -d`
7. Обновить DNS A-запись на новый IP (если сменился)
8. Перерегистрировать webhook: бот делает это сам при старте (`registerWebhook`)

## Регулярность

- Тест восстановления (`scripts/restore-test.sh`) — **обязателен** после настройки
  и далее раз в квартал / после крупных изменений схемы.
- Непроверенный бэкап не считается бэкапом.

## Шифрование бэкапов (Task 9.9.9)

Дампы шифруются `age`, если задан `BACKUP_AGE_RECIPIENT` (публичный ключ). Тогда в S3 лежит `volleytime_<ts>.sql.gz.age`.

- **Ключевая пара:** `age-keygen -o /root/volleytime-backup.key` на машине, отличной от VPS с бэкапами; публичный ключ (`age1…`) кладём в `.env` как `BACKUP_AGE_RECIPIENT`.
- **Приватный ключ не хранится рядом с дампами** — только в офлайн-хранилище (менеджер паролей/бумажная копия). Без него восстановление невозможно.
- **Восстановление:** `age -d -i <key-file> -o dump.sql.gz volleytime_<ts>.sql.gz.age`, дальше как обычно (`gunzip -c … | psql -v ON_ERROR_STOP=1`).
- `restore-test.sh` расшифровывает автоматически, если задан `BACKUP_AGE_KEY_FILE`.
- Если `BACKUP_AGE_RECIPIENT` не задан, скрипт предупреждает и продолжает — дампы уезжают в S3 без шифрования.

## Мониторинг бэкапов

`backup.sh` и `restore-test.sh` пингуют healthcheck-сервис (`HEALTHCHECK_URL`, `HEALTHCHECK_RESTORE_URL`): успех — базовый URL, ошибка — суффикс `/fail`. Отсутствие пинга = молчаливый сбой cron, healthcheck поднимает алерт.

## Технический аккаунт smoke (Task 9.10.4)

Проверка входа после деплоя (`scripts/smoke.mjs`) логинится Telegram-аккаунтом из `SMOKE_TG_ID` — заводить для него отдельный Telegram-аккаунт не нужно, достаточно зарезервированного id.

- В боевой базе он помечен: `users.name = 'Smoke check'`, `is_active = false`; в организации не состоит, поэтому в составах и уведомлениях не появляется.
- После каждой проверки smoke вызывает `POST /api/internal/smoke/cleanup` (внутренний секрет) и удаляет его сессии.
- Найти: `SELECT id, telegram_user_id, name FROM users WHERE name = 'Smoke check';`
- Полное удаление строки невозможно, если за ней числятся платежи (FK `RESTRICT`) — это ожидаемо, аккаунт ничего не оплачивает.
