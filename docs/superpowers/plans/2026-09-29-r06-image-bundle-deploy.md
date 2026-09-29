# R0.6 Image Bundle Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Доставить полный кандидат R0.6 на VPS из проверенных GitHub Actions образов, без сборки/реестра на сервере и без потери отката при повторе.

**Architecture:** GitHub Actions собирает три SHA-tagged `linux/amd64` Docker-образа, архив и Git bundle одного `prod` SHA, затем передаёт их по существующему CI SSH. Сервер проверяет payload, загружает образы, определяет предыдущий релиз по запущенному runtime, создаёт backup, fast-forward'ит bundle, применяет миграцию и запускает web/bot без сборки. Controlled failure возвращает уже существующие предыдущие образы; неопределённое состояние блокирует повтор.

**Tech Stack:** GitHub Actions YAML, Bash/Git/Docker Compose, Node 22/pnpm/Vitest, PostgreSQL 16, существующие `scripts/smoke.mjs` и CI SSH-key.

**Spec:** [2026-09-29-r06-image-bundle-deploy-design.md](../specs/2026-09-29-r06-image-bundle-deploy-design.md)

## Global Constraints

- Одна SDD-карточка `9.8.10`, отдельная ветка/PR от GitHub `main`; conventional commits с `Task: 9.8.10`, `Release: v0.1.6`. Код не начинается до карточки.
- GitHub `main` — integration, `prod` — единственный production source; только reviewed fast-forward main→prod. Никаких server-side GitHub/GHCR/npm обращений.
- Web, bot, migrator: SHA-tagged `linux/amd64` images с OCI revision label, без production secrets; bundle и архив должны отвечать одному `${{ github.sha }}`.
- Backup БД до Git advancement/миграции; миграции forward-only и совместимы с прежним приложением. Не восстанавливать БД и не удалять старые образы/backup автоматически.
- Сохранить restricted CI SSH-key и обычный/recovery SSH-доступ. Не менять опубликованные теги. Реальный Telegram QA только после успешного production smoke; synthetic smoke не равен клиентскому QA.
- Исходный partial state: checkout/`.env.images` = `a16eb2a`, запущенный runtime = `67bbfe8`, previous manifest/pointer = `67bbfe8`; тестировать его явно.

## Review Focus

1. Неполный/повреждённый upload: hash/size failure до `docker load` и до backup (Task 3).
2. Мало места после upload: fail closed без удаления старого образа, БД или backup (Task 3).
3. Разные SHA у live web/bot или runtime/manifest: не выбирать ложный rollback target (Task 4).
4. Два параллельных/оборванных запуска: lock или неопределённое состояние не должны давать ложный success (Tasks 4–5).
5. Повтор same-SHA после частичного и после успешного deploy: прежний target не перезаписывается новым checkout (Task 4).

## File map

- `docs/tasks/9-8-10-registry-free-image-bundle-deploy.md`: SDD acceptance/«не делать»/status.
- `scripts/package-release-images.sh`: CI build, image identity inspection, archive и metadata.
- `scripts/verify-release-images.sh`: remote archive/hash/architecture/label/disk verification и `docker load`; только staging/image store.
- `scripts/deploy-image-bundle.sh`: lock, old-runtime capture, backup, exact bundle advance, migrate, no-build activation, recovery.
- `.github/workflows/deploy.yml`: default image-bundle path, SCP, separated transfer/activation, existing GHCR manual path, smoke and failure handling.
- `apps/web/server/utils/deploy-image-bundle-contract.test.ts`: shell fixtures/stub Docker и workflow-order/failure tests; существующие `deploy-contract.test.ts`, `release-backup-contract.test.ts`, `release-identity-contract.test.ts` обновить без ослабления source/backup/rollback assertions.
- `docs/operations/runbooks/deploy.md`, `docs/operations/status/current-state.md`, `docs/RELEASES.md`: новый default и фактическая release evidence; не закрывать ручной Telegram gate преждевременно.

### Task 1: SDD-карточка и baseline

**Files:** Create `docs/tasks/9-8-10-registry-free-image-bundle-deploy.md`; read spec, workflow, existing deploy/backup tests.

**Interfaces:** карточка фиксирует CLI и критерии Tasks 2–5; код пока отсутствует.

- [ ] Записать цель, `depends_on: ['9.8.7', '9.8.9']`, scope/acceptance/non-goals из спецификации; status `in_progress`, release `v0.1.6`.
- [ ] Проверить, что `origin/main=origin/prod=a16eb2a` на момент старта и локальная ветка основана на `main`; если это изменилось, сверить источник заново.
- [ ] Запустить baseline `pnpm exec vitest run apps/web/server/utils/deploy-contract.test.ts apps/web/server/utils/release-backup-contract.test.ts apps/web/server/utils/release-identity-contract.test.ts`; зафиксировать результат и PostgreSQL-доступ. Не менять legacy-assertions до RED нового контракта.
- [ ] Коммит только карточки: `docs(ops): specify registry-free deploy task` + trailers.

### Task 2: Сборка точных образов на runner

**Files:** Create `scripts/package-release-images.sh`; add tests in `apps/web/server/utils/deploy-image-bundle-contract.test.ts`; later wire `.github/workflows/deploy.yml` in Task 5.

**Interfaces:** `bash scripts/package-release-images.sh FULL_SHA OUTPUT_DIR` создаёт `release-images.tar.gz` и `release-images.meta` с `RELEASE_SHA`, `ARCHIVE_SHA256`, `ARCHIVE_BYTES`, `UNPACKED_BYTES`, `WEB_IMAGE`, `BOT_IMAGE`, `MIGRATOR_IMAGE`; имена — `volleytime-{web,bot,migrator}:FULL_SHA`.

- [ ] RED: тест отвергает неполный/non-hex SHA до `docker build`; fixture с fake Docker проверяет три Dockerfile, `--platform linux/amd64`, SHA-теги/labels и отсутствие env-secret аргументов.
- [ ] Запустить `pnpm exec vitest run apps/web/server/utils/deploy-image-bundle-contract.test.ts`, увидеть ожидаемый FAIL.
- [ ] GREEN: реализовать указанную CLI; inspect собранных образов до `docker save`; archive/hash/byte counts генерировать атомарно, mode без секретов. Тестами зафиксировать неверную архитектуру/label/tag и отказ экспорта.
- [ ] Повторить focused test до PASS; выполнить `bash -n scripts/package-release-images.sh` и `git diff --check`; коммит с Task/Release trailers.

### Task 3: Доставка, целостность и загрузка без активации

**Files:** Create `scripts/verify-release-images.sh`; extend `deploy-image-bundle-contract.test.ts`.

**Interfaces:** `bash scripts/verify-release-images.sh STAGING_DIR FULL_SHA` возвращает 0 только после `sha256sum`/size/disk checks, `docker load` и inspect трёх фактических tag/architecture/labels. Не вызывает backup, Git advancement, Compose up или prune.

- [ ] RED: temp fixtures проверяют truncated archive, неверные SHA/hash/tag/arch/label, недостачу disk reserve; assertion: ни `docker load` (для preflight failures), ни backup/up не вызваны и live state не меняется.
- [ ] Запустить тот же Vitest file, увидеть конкретный FAIL.
- [ ] GREEN: строго парсить allowlisted metadata; вычислять доступное место с консервативным запасом для распаковки и отдельно от уже записанного архива; проверить content/hash до `docker load`, фактически импортированные images — после него. Недостаток места останавливает deploy, не запускает prune.
- [ ] Повторить focused test до PASS; `bash -n`, `git diff --check`; коммит с trailers.

### Task 4: Безопасная активация и idempotent rollback

**Files:** Create `scripts/deploy-image-bundle.sh`; extend `deploy-image-bundle-contract.test.ts` и при необходимости `release-identity-contract.test.ts`.

**Interfaces:** `bash scripts/deploy-image-bundle.sh deploy STAGING_DIR FULL_SHA` и `... rollback FULL_SHA`; внешние `release-bundle.sh verify|advance` и `backup-local.sh` сохраняют свои контракты. Script пишет previous SHA/manifest только после согласования запущенных web/bot+health, использует `flock` и `docker compose ... up --no-build -d web bot`.

- [ ] RED: fake Git/Docker/Compose fixture воспроизводит `checkout=a16eb2a`, live web/bot=`67bbfe8`, current manifest=a16, previous=67; проверяет, что deploy нового SHA сохраняет previous=67. Отдельные тесты: live web/bot mismatch, отсутствующий старый image, second lock holder, same-SHA retry после success.
- [ ] Запустить focused Vitest до ожидаемого FAIL.
- [ ] GREEN: реализовать capture из live image tags/health, сверку с имеющимся previous, backup до bundle advance, атомарный manifest, migrate отдельно и no-build up. Установить явные phase markers без секретов; никакого server-side GitHub/GHCR/npm.
- [ ] RED→GREEN для controlled failure: ошибка backup не двигает Git, миграции не переключают web/bot; ошибка up/smoke возвращает старые образы/manifest/Git без Docker build и без DB restore. При ambiguous timeout оставить ручной checkpoint, не выдавать success.
- [ ] Повторить focused test и `bash -n` до PASS, сравнить с task-card/non-goals; коммит с trailers.

### Task 5: Workflow и доказательство end-to-end порядка

**Files:** Modify `.github/workflows/deploy.yml`, `deploy-contract.test.ts`, `release-backup-contract.test.ts`, `release-identity-contract.test.ts`; extend new contract test.

**Interfaces:** push `prod` и manual `image-bundle` вызывают Task 2→3→4; GHCR остаётся только явной manual-альтернативой. `Smoke check` всегда сравнивает exact `${{ github.sha }}`; post-activation failure вызывает new `rollback FULL_SHA` только при определённом старом target.

- [ ] RED: workflow contract проверяет prod source gate, build/export до staging/upload, separate bounded transfer/activation, SHA binding, no-build path и rollback on deploy/smoke failure; direct main/tag dispatch и бездоказательный rerun fail-closed. Старые тесты обновить так, чтобы backup-before-migration, secret permissions и GHCR manual остались проверяемы.
- [ ] Запустить focused Vitest до ожидаемого FAIL.
- [ ] GREEN: подключить новый путь; old `local-build` выключить как production option, пока он может затереть previous pointer. Передавать образный архив без GitHub artifact publication и без secret build args; staging 0700/env0600, workflow+remote lock. Не отправлять archive/secret в публичные логи.
- [ ] Убедиться, что tool failure после `up` инициирует bounded recovery, а timeout без достоверной фазы требует read-only аудита, не blind retry. Повторить focused tests до PASS, проверить YAML/shell syntax и `git diff --check`; коммит с trailers.

### Task 6: Gates, review, PR и controlled production acceptance

**Files:** Modify runbook, task card, release/status docs; после реального запуска — production evidence в `docs/operations/qa/`.

**Interfaces:** завершённая 9.8.10 не закрывает ручные 8.7.2/8.8.11 и не создаёт тег `v0.1.6`.

- [ ] Обновить runbook для image-bundle default, partial-state recovery, exact rollback и manual GHCR; скорректировать RELEASES/status без заявления успешного deploy.
- [ ] Запустить все пять gates `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (PostgreSQL), `pnpm build`; проверить focused shell/CI contracts и independent review. Исправления снова через RED→GREEN.
- [ ] Создать PR 9.8.10 в `main`; дождаться exact-head CI и review, проверить merge tree/main CI; только затем reviewed fast-forward `prod` (без force/tag rewrite).
- [ ] Перед controlled deploy заново проверить ключи, VPS health, free disk, старые images/backup/manifest, отсутствие чужого deploy; если capacity check не проходит, остановиться без `docker prune`.
- [ ] Дождаться успешного Actions workflow; сохранить доказательства backup-before-migrate, exact server Git/image/web/bot SHA, healthy containers, HTTPS и synthetic smoke cleanup. При отказе — записать фактическую фазу, не заявлять релиз и не запускать повтор вслепую.
- [ ] Только после успешного runtime smoke открыть ручной Telegram checklist на тестовых аккаунтах/организации; `v0.1.6` tag/Release и закрытие пилотных задач — лишь после отдельного принятия пользователем.
