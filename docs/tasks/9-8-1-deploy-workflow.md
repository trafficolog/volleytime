---
id: '9.8.1'
phase: '9'
epic: '9.8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: deploy workflow tests и build/push images прошли в run 35346916965; Deploy to VPS остановился на missing server host, push→prod не подтверждён."
roles:
  - DEVOPS
depends_on:
  - '9.1.1'
  - '9.1.2'
  - '9.3.2'
  - '3.8'
estimated_hours: '2'
tags:
  - cicd
  - github-actions
  - deploy
---

# Task 9.8.1: GitHub Actions deploy workflow (build + SSH)

## Цель

GitHub Actions workflow: push в main → тесты → build образов (web, bot) → push в ghcr.io → SSH на VPS → pull + docker-compose up.

## Контекст

Решение 10: Actions build → ghcr → SSH pull. Расширяет CI Phase 3 (3.8 — тесты). Fallback build-on-VPS (9.8.3) если ghcr недоступен из РФ.

## Что должно быть сделано

1. **`.github/workflows/deploy.yml`:**

   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: pnpm }
         - run: pnpm install --frozen-lockfile
         - run: pnpm test
         - run: pnpm lint

     build-and-push:
       needs: test
       runs-on: ubuntu-latest
       permissions:
         contents: read
         packages: write
       steps:
         - uses: actions/checkout@v4
         - uses: docker/login-action@v3
           with:
             registry: ghcr.io
             username: ${{ github.actor }}
             password: ${{ secrets.GITHUB_TOKEN }}
         - uses: docker/build-push-action@v6
           with:
             context: .
             file: apps/web/Dockerfile
             push: true
             tags: ghcr.io/${{ github.repository_owner }}/volleytime-web:latest,ghcr.io/${{ github.repository_owner }}/volleytime-web:${{ github.sha }}
         - uses: docker/build-push-action@v6
           with:
             context: .
             file: apps/bot/Dockerfile
             push: true
             tags: ghcr.io/${{ github.repository_owner }}/volleytime-bot:latest,ghcr.io/${{ github.repository_owner }}/volleytime-bot:${{ github.sha }}

     deploy:
       needs: build-and-push
       runs-on: ubuntu-latest
       steps:
         - uses: appleboy/ssh-action@v1
           with:
             host: ${{ secrets.VPS_HOST }}
             username: deploy
             key: ${{ secrets.VPS_SSH_KEY }}
             script: |
               cd /opt/volleytime
               docker compose -f docker-compose.prod.yml pull
               # миграции — отдельный шаг (9.8.2)
               ./scripts/migrate.sh
               docker compose -f docker-compose.prod.yml up -d
               docker image prune -f
   ```

2. **Тегирование образов:** latest + sha (для rollback на конкретный коммит).

3. **SSH деплой** через appleboy/ssh-action (или ручной ssh). Под deploy-юзером (9.3.2).

4. **Порядок деплоя:** pull образы → миграции (9.8.2) → up → prune старых образов.

5. **GITHUB_TOKEN** для ghcr (встроенный, packages: write permission).

## Критерии приёмки

- ✅ Workflow на push в main
- ✅ Тесты + lint перед build (не деплоить сломанное)
- ✅ Build web + bot образов, push в ghcr (latest + sha теги)
- ✅ SSH деплой: pull → migrate → up → prune
- ✅ Под deploy-юзером (не root)
- ✅ Деплой проверен (push → автоматически на проде)
- ✅ sha-теги для rollback

## Подсказки

- **test → build → deploy последовательно** (needs). Сломанные тесты не доходят до прода.
- **sha-тег** — для rollback (9.8.3): откатиться на ghcr.io/.../web:<предыдущий-sha>.
- **ghcr из РФ** — может быть недоступен с VPS (pull). Если так — fallback build-on-VPS (9.8.3). Эта задача — основной путь (ghcr), 9.8.3 — запасной.
- **docker image prune** после up — чистит старые образы, не забивает диск.
- **appleboy/ssh-action** — популярный, надёжный для SSH-деплоя из Actions.

## Не делать

- ❌ Не деплоить без прохождения тестов
- ❌ Не деплоить под root
- ❌ Не применять миграции внутри up (отдельный шаг 9.8.2)
- ❌ Не забывать sha-теги (rollback)
