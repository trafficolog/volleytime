---
id: '9.8.2'
phase: '9'
epic: '9.8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: отдельная migrator-stage реализована, но workflow предполагает уже существующий /opt/volleytime/.env; production GitHub Secrets/VPS env не настроены и secret materialization из карточки не реализован.'
roles:
  - DEVOPS
  - BACK
depends_on:
  - '9.8.1'
  - '3.2'
estimated_hours: '1'
tags:
  - cicd
  - migrations
  - secrets
---

# Task 9.8.2: Миграции шаг + секреты (GitHub Secrets → .env)

## Цель

Миграции БД отдельным шагом деплоя (drizzle migrate перед перезапуском web). Секреты через GitHub Secrets → .env на VPS.

## Контекст

Решения 11, 12: миграции отдельным шагом (контроль, видимость ошибок), секреты через GitHub Secrets. Авто-миграции при старте рискованны (гонки при репликах).

## Что должно быть сделано

1. **Migrate-скрипт `scripts/migrate.sh`** (на VPS):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   cd /opt/volleytime

   # Запустить миграции через одноразовый контейнер web (drizzle migrate)
   # web образ содержит drizzle config + миграции
   docker compose -f docker-compose.prod.yml run --rm web node packages/db/migrate.js
   # или: drizzle-kit migrate с DATABASE_URL
   echo "[migrate] migrations applied"
   ```

   Точная команда зависит от того, как Phase 3 (3.2) настроил drizzle migrate (скрипт миграций в packages/db).

2. **Порядок в деплое (9.8.1):** pull → **migrate** → up. Миграции применяются ДО перезапуска web (новый код ожидает новую схему).

3. **Секреты — GitHub Secrets:**
   Список (Settings → Secrets):

   ```
   VPS_HOST, VPS_SSH_KEY
   DB_PASSWORD
   BOT_TOKEN
   BOT_INTERNAL_SECRET
   WEBHOOK_SECRET_TOKEN, WEBHOOK_SECRET_PATH
   SENTRY_DSN_WEB, SENTRY_DSN_BOT
   S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
   ```

4. **Формирование .env на VPS** — деплой генерирует/обновляет /opt/volleytime/.env из секретов:

   ```yaml
   # в deploy job, перед up:
   - uses: appleboy/ssh-action@v1
     with:
       script: |
         cat > /opt/volleytime/.env <<EOF
         DB_PASSWORD=${{ secrets.DB_PASSWORD }}
         BOT_TOKEN=${{ secrets.BOT_TOKEN }}
         ... (все секреты)
         EOF
         chmod 600 /opt/volleytime/.env
   ```

   ВАЖНО: .env права 600 (только deploy читает).

5. **Альтернатива** — .env создаётся вручную при первом provision, деплой не трогает (проще, но ручное обновление). Для MVP — гибрид: критичные через Actions, или единожды вручную. Выбрать: автоматизация через Secrets чище.

## Критерии приёмки

- ✅ migrate.sh применяет миграции (drizzle)
- ✅ Миграции в деплое: после pull, ДО up (web)
- ✅ Ошибка миграции → деплой останавливается (не запускать web на старой схеме)
- ✅ Все секреты в GitHub Secrets
- ✅ .env на VPS генерируется из секретов (права 600)
- ✅ Секреты не в логах Actions (маскируются)

## Подсказки

- **Миграции ДО up web** — новый код ожидает новую схему. Если up до migrate — web упадёт на отсутствующих колонках.
- **set -e в migrate.sh** — падение миграции останавливает скрипт → деплой не продолжается (не запускаем сломанное).
- **.env права 600** — секреты, только deploy-юзер. chmod обязателен.
- **GitHub Secrets маскируются** в логах Actions автоматически (***), но не выводить их echo'ом явно.
- **Одна реплика MVP** — миграции просты. При репликах (будущее) — отдельный migrate job до rollout.

## Не делать

- ❌ Не применять миграции после старта web
- ❌ Не авто-мигрировать при старте контейнера (гонки)
- ❌ Не коммитить .env / секреты
- ❌ Не оставлять .env с правами для всех
