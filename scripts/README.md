# scripts/

Индекс скриптов. Деплой, откат и восстановление выполняются только по [deploy runbook](../docs/operations/runbooks/deploy.md) и [disaster-recovery](../docs/operations/runbooks/disaster-recovery.md): скрипты из разделов «Деплой и откат» и «Production-сервер» не запускаются вручную вне runbook.

## Разработка и проверка

| Скрипт                                                        | Назначение                                                                                                  | Кто вызывает                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `setup.sh`                                                    | первичная настройка dev-окружения: compose, ожидание БД, миграции dev и test                                | `pnpm setup`                                         |
| `wait-for-db.sh`                                              | ждёт готовности Postgres                                                                                    | `setup.sh`                                           |
| `verify-build.sh`                                             | проверка prod-сборки web: сборка, запуск `.output`, ключевые эндпоинты                                      | вручную                                              |
| `smoke.mjs`                                                   | smoke после деплоя: health, сессия, вход через Telegram, маршрут webhook                                    | `pnpm smoke`, `verify-build.sh`, workflow deploy     |
| `qa/visual-reference.mjs`                                     | харнесс визуальной сверки с референсом ([runbook](../docs/operations/runbooks/visual-reference-harness.md)) | `pnpm qa:visual`                                     |
| `qa/visual-reference-lib.mjs`, `qa/visual-reference-map.json` | библиотека и карта экранов харнесса; тест `qa/visual-reference-lib.test.ts`                                 | `qa/visual-reference.mjs`, vitest                    |
| `qa/*.pwcode`                                                 | сценарии ручной браузерной проверки для QA-сессий                                                           | вручную                                              |
| `generate-github-issues.py`                                   | GitHub Issues из task-карточек (раздел ниже)                                                                | вручную                                              |
| `github/apply-branch-protection.sh`                           | защита веток `main`/`prod` (по умолчанию печатает план, `--apply` меняет настройки)                         | вручную, см. [GITHUB_SETUP](../docs/GITHUB_SETUP.md) |
| `validate-runner-images.sh`                                   | проверка образов runner до production                                                                       | workflow ci                                          |

## Деплой и откат (по runbook)

| Скрипт                             | Назначение                                                   | Кто вызывает                             |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `require-prod-ref.mjs`             | требует `refs/heads/prod` для production-выкладки            | workflow deploy                          |
| `render-production-env.mjs`        | рендер production-окружения из переменных репозитория        | workflow deploy                          |
| `verify-telegram-bot-identity.mjs` | сверка идентичности Telegram-бота                            | workflow deploy                          |
| `package-release-images.sh`        | сборка и упаковка образов релиза                             | workflow deploy                          |
| `verify-release-images.sh`         | проверка архива образов перед импортом                       | workflow deploy                          |
| `release-bundle.sh`                | проверка и продвижение релизного бандла                      | workflow deploy, `deploy-local-build.sh` |
| `deploy-image-bundle.sh`           | активация релиза из бандла образов                           | workflow deploy                          |
| `compose-images-only.yml`          | compose-override без build-определений (нет образа — отказ)  | `deploy-image-bundle.sh`                 |
| `deploy-ghcr-manual.sh`            | ручной деплой образов из GHCR                                | workflow deploy                          |
| `deploy-local-build.sh`            | деплой локальной сборкой                                     | вручную на сервере, по runbook           |
| `verify-ghcr-deploy-state.sh`      | проверка состояния после ручного GHCR-деплоя                 | workflow deploy                          |
| `verify-live-rollback-env.sh`      | проверка окружения предыдущего релиза для отката             | workflow deploy                          |
| `verify-split-rollback.sh`         | проверка совместимости данных и образа перед откатом         | workflow deploy                          |
| `capture-split-writer-network.py`  | фиксирует сетевые идентичности writer-контейнеров для отката | workflow deploy                          |

## Production-сервер: бэкапы и диск

| Скрипт            | Назначение                                                     | Кто вызывает                                                                          |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `backup.sh`       | ежедневный бэкап Postgres в S3 (cron), опциональное шифрование | cron на сервере ([vps-provisioning](../docs/operations/runbooks/vps-provisioning.md)) |
| `backup-local.sh` | локальный бэкап перед активацией релиза                        | workflow deploy, `deploy-local-build.sh`                                              |
| `restore-test.sh` | тест восстановления бэкапа во временную БД                     | вручную по [disaster-recovery](../docs/operations/runbooks/disaster-recovery.md)      |
| `disk-status.sh`  | оценка свободного места на VPS по выводу `df -Pk`              | workflow deploy, workflow vps-disk-monitor                                            |

## generate-github-issues.py

Генерирует GitHub Issues из task-карточек (`docs/tasks/*.md`).

```bash
# CSV для просмотра (все задачи MVP)
python scripts/generate-github-issues.py --format csv --release v0.1.0

# готовый bash-скрипт с gh issue create (MVP)
python scripts/generate-github-issues.py --format gh --release v0.1.0
bash issues.sh          # выполнить (нужен gh CLI + созданные milestones/labels)

# JSONL всех задач (для своих скриптов/API)
python scripts/generate-github-issues.py --format jsonl
```

Опции: `--format {jsonl,csv,gh}`, `--release vX.Y.Z` (фильтр), `--out FILE`.

Перед `bash issues.sh`: создать milestones и labels (см. `docs/GITHUB_SETUP.md`).
