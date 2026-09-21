---
id: '9.8.3'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'GHCR unavailability selected local build as the active path; end-to-end prod deploy, exact-SHA controlled rollback and redeploy are verified and documented.'
roles:
  - DEVOPS
depends_on:
  - '9.8.1'
  - '9.8.2'
estimated_hours: '1-2'
tags:
  - cicd
  - rollback
  - resilience
---

# Task 9.8.3: Fallback build-on-VPS + rollback + проверка

## Цель

Запасной путь деплоя (build на VPS, если ghcr.io недоступен из РФ-сети VPS). Rollback-стратегия. Финальная проверка всего деплой-пайплайна.

## Контекст

Решение 10: fallback build-on-VPS если ghcr недоступен из РФ. Реальный риск — ghcr.io может не открываться с российского VPS (pull образов упадёт). Нужен план Б.

## Что должно быть сделано

1. **Проверить доступность ghcr с VPS:**

   ```bash
   # на VPS:
   docker pull ghcr.io/USER/volleytime-web:latest
   # если timeout/403 — ghcr недоступен, нужен fallback
   ```

2. **Fallback: build-on-VPS** — альтернативный деплой (git pull + build на сервере):

   ```bash
   # scripts/deploy-local-build.sh (на VPS)
   cd /opt/volleytime
   git pull origin main
   docker compose -f docker-compose.prod.yml build  # build образов на VPS
   ./scripts/migrate.sh
   docker compose -f docker-compose.prod.yml up -d
   docker image prune -f
   ```

   docker-compose.prod.yml — `build:` секции вместо `image:` (или профиль). Подготовить оба варианта (9.2.1 упоминал).

3. **Actions для fallback** — если ghcr push не нужен, Actions только SSH → git pull + build на VPS:

   ```yaml
   # альтернативный deploy job (если ghcr недоступен):
   deploy-local-build:
     steps:
       - uses: appleboy/ssh-action@v1
         with:
           script: |
             cd /opt/volleytime && git pull && ./scripts/deploy-local-build.sh
   ```

   Выбрать активный путь по факту доступности ghcr (документировать оба).

4. **Rollback-стратегия:**

   ```bash
   # вариант 1 (ghcr): откат на предыдущий sha-тег
   docker compose -f docker-compose.prod.yml pull web:<prev-sha> bot:<prev-sha>
   # обновить .env/compose на prev-sha, up

   # вариант 2 (build): git checkout <prev-commit> → build → up

   # БД: миграции вперёд-совместимы (не ломать старый код); откат миграций — осторожно
   ```

   Документировать в runbook. Минимум — как быстро вернуться на предыдущую рабочую версию.

5. **Финальная проверка пайплайна:**

   ```
   [ ] push в main → Actions запускается
   [ ] тесты проходят
   [ ] образы билдятся (ghcr или VPS)
   [ ] миграции применяются
   [ ] контейнеры перезапускаются
   [ ] /health 200
   [ ] Mini App открывается, бот отвечает
   [ ] rollback проверен (откат на предыдущую версию работает)
   ```

6. **Deploy runbook** `docs/operations/runbooks/deploy.md` — оба пути, rollback, troubleshooting.

## Критерии приёмки

- ✅ Доступность ghcr с VPS проверена
- ✅ Fallback build-on-VPS готов (если ghcr недоступен)
- ✅ docker-compose поддерживает оба (image / build)
- ✅ Rollback-стратегия документирована и проверена
- ✅ Полный пайплайн проверен (push → прод)
- ✅ Deploy runbook (оба пути, rollback, troubleshooting)
- ✅ Решено какой путь активный (по факту ghcr-доступности)

## Подсказки

- **ghcr из РФ — реальный риск.** Многие registry блокируются/тормозят. Проверить ДО того как полагаться. Build-on-VPS надёжнее из РФ, но медленнее (билд на сервере) и грузит VPS.
- **Альтернативные registry:** если ghcr недоступен и build-on-VPS не устраивает — российский registry (Selectel Container Registry, Yandex). Отметить как опцию.
- **Rollback через sha-теги** (9.8.1) — быстрый откат на ghcr-пути. На build-пути — git checkout + rebuild.
- **Forward-compatible миграции** — не ломать старую схему резко (добавлять колонки nullable, удалять отдельным шагом позже). Упрощает rollback.
- **Runbook критичен** — деплой/откат под стрессом (прод лежит) требует чёткой инструкции.

## Не делать

- ❌ Не полагаться на ghcr без проверки доступности из РФ
- ❌ Не деплоить без rollback-плана
- ❌ Не делать ломающие миграции (усложняют откат)
- ❌ Не пропускать финальную проверку пайплайна

## Production evidence — 2026-09-21

- GHCR is not a viable VPS dependency; the verified Git-bundle local-build successor from Task 9.8.7 is the active automatic path and requires no server-side GitHub/GHCR egress.
- Controlled rollback from `c8648c25ce2e1955806cb051af5365089945d2ca` to immutable v0.1.3 `91f6bffbd005876f94ffd1c31cebb4bcd891a752` completed with healthy web/bot/PostgreSQL and no database reversal; workflow `35566144557` then redeployed the candidate successfully.
