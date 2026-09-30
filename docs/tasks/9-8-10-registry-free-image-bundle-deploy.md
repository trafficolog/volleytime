---
id: '9.8.10'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.6'
status_note: 'Deploy 36747623989 passed on64f1850 with backup/smoke but downloaded pnpm inside migrator. Offline RED/GREEN fix accepted PR #71 main=d7e775a with independent review and exact-head/main CI passed; final CLI offline packaging and local20-migration/replay smoke passed. Corrected controlled redeploy remains open; real Telegram/pilot and v0.1.6 tag/Release are separate gates.'
roles:
  - DEVOPS
  - QA
  - SECURITY
depends_on:
  - '9.8.7'
  - '9.8.9'
tags:
  - cicd
  - docker
  - production
  - rollback
---

# Task 9.8.10: доставка production-образов без реестра и сборки на VPS

## Цель

Выпустить проверенный кандидат R0.6 на пилотный VPS: собрать три образа одного точного `prod` SHA в GitHub Actions, передать их вместе с Git bundle через существующий restricted CI SSH-ключ и активировать без сборки, реестра, GitHub или npm на сервере. Сохранить возможность отката к действительно работавшему релизу без повторной сборки. `v0.1.6` остаётся кандидатом до успешного production smoke и отдельной ручной Telegram/pilot QA.

## Контекст

После неудачного workflow `36553043217` GitHub `main`/`prod` и VPS checkout находились на `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4`, а запущенные web/bot и public health — на `67bbfe89acaac04992b8128d45cb1b40f8acc75c`. `.env.images` уже указывал на кандидат; `.env.images.previous` и `.deploy/previous-git-sha` — на работающий старый релиз. Повтор старого `deploy-bundle` может неверно заменить rollback target. Этот частичный state обязателен для тестов. Снимок не доказывает текущий live state: перед выкладкой его проверяют заново.

GitHub `main` остаётся integration-веткой; production source — только reviewed fast-forward `prod` после применимых CI. Полный протокол и границы: [R0.6 image bundle design](../superpowers/specs/2026-09-29-r06-image-bundle-deploy-design.md). Задача развивает проверенный exact-SHA Git bundle из 9.8.7 и bounded timeout из 9.8.9.

## Что должно быть сделано

1. Зафиксировать source gate: только `refs/heads/prod` и полный `${{ github.sha }}` после CI; создать Git bundle ровно этого коммита. Task branch, `main`, tag и произвольный SHA не активируют production.
2. Реализовать `bash scripts/package-release-images.sh FULL_SHA OUTPUT_DIR`: собрать `web`, `bot`, `migrator` из одного checkout для `linux/amd64` с тегами `volleytime-{web,bot,migrator}:FULL_SHA` и OCI revision label `FULL_SHA`; проверить inspect и атомарно создать `release-images.tar.gz` и несекретный `release-images.meta` с `RELEASE_SHA`, `ARCHIVE_SHA256`, `ARCHIVE_BYTES`, `UNPACKED_BYTES`, `WEB_IMAGE`, `BOT_IMAGE`, `MIGRATOR_IMAGE`. Production secrets не передаются сборке и не попадают в образы/архив/metadata/log.
3. Реализовать `bash scripts/verify-release-images.sh STAGING_DIR FULL_SHA`: до backup, Git advancement и миграции проверить allowlisted metadata, размер и SHA-256 архива, заявленные теги/архитектуру/labels и свободное место с запасом под staging и распакованные слои. После preflight выполнить `docker load` без активации и проверить фактически загруженные SHA-теги, архитектуру и revision labels. При ошибке остановиться без изменения live containers, DB или `.env.images`; ничего автоматически не очищать.
4. Реализовать `bash scripts/deploy-image-bundle.sh deploy STAGING_DIR FULL_SHA` и `bash scripts/deploy-image-bundle.sh rollback FULL_SHA`. До backup/checkout/migration проверить Git bundle/expected SHA/fast-forward/clean tracked checkout через существующий `release-bundle.sh verify`; выполнить image preflight/load до activation. Серверный `flock` защищает staging/activation независимо от Actions concurrency. Запущенные web/bot и exact health определяют предыдущий SHA; Git checkout или уже переписанный `.env.images` сами по себе не являются rollback target. Требовать согласованности runtime и доступности старых образов. В описанном partial state сохранить `67bbfe8` как previous при следующем SHA; при повторе уже работающего same-SHA не менять previous pointer.
5. После проверенного `docker load` и runtime capture: создать и проверить локальный `pg_dump`/gzip с закрытыми правами; затем fast-forward'ить Git bundle либо подтвердить уже достигнутый exact SHA, атомарно установить SHA manifest, отдельно выполнить миграцию и `docker compose ... up --no-build -d web bot`. Проверить web/bot, БД, public HTTPS `/api/health` и exact release SHA. Не пересоздавать Caddy/PostgreSQL без причины. Писать несекретные метки `verified → loaded → backed-up → migrated → activated → smoke-passed`.
6. Перевести push `prod` и ручной `image-bundle` workflow на runner build/export → bounded SSH transfer в закрытый `/opt/volleytime/.deploy/incoming/<SHA>/` (`.env.production` mode `0600`) → отдельную bounded activation → exact-SHA synthetic smoke с forged-signature и cleanup технических сессий. GHCR оставить только явным manual-вариантом; небезопасный старый `local-build` убрать из production options. Обычный и recovery SSH-доступ сохраняются независимо от CI-ключа.
7. При контролируемом отказе backup не продвигать Git; при ошибке миграции не переключать web/bot; при ошибке activation/smoke вернуть предыдущие Git SHA/manifest и локально доступные старые образы через Compose `--no-build`, затем проверить старый health. Миграция остаётся backward-compatible; DB не восстанавливается автоматически. Timeout, разрыв связи или неоднозначное состояние требуют read-only проверки PID/lock/образов/контейнеров/schema/health и явного manual recovery checkpoint, без слепого повторного запуска.
8. Обновить deploy runbook и release/status evidence. После пяти локальных gates, PostgreSQL integration tests, shell syntax, focused contracts, независимого review и exact-head/main CI продвигать reviewed `main` в `prod` только fast-forward. Production acceptance фиксирует успешный workflow, проверенный backup до миграции, точный Git/image/runtime/public-health SHA, healthy web/bot/DB и synthetic cleanup; после этого проводится отдельная ручная Telegram QA.

## Критерии приёмки

Whole-branch fix acceptance (2026-09-30): supported Compose migration CLI must prohibit pulls/builds; a completed healthy release A can advance to exact FF release B while preserving A for rollback; interrupted operations (124/137/143/255) retain a manual checkpoint without a second Compose action. Manual GHCR uploads use isolated immutable SHA staging, and a healthy GHCR runtime can be preserved and restored by a later image-bundle deployment using its exact local image references. PR/main CI must build/export/import the exact checked-out SHA on a runner and record capacity before production promotion; capacity failures stop without pruning. External synthetic smoke uses a five-minute timeout plus a 15-second prewait.

Cross-mode continuity also covers accepted image-bundle X → GHCR activated A → image-bundle B. An old completed image marker is explainable only by exact GHCR activated phase/current checkout/manifest/healthy runtime A and X→A→B ancestry; unfinished/mismatched histories remain blocked. Replaying X after the GHCR handoff must fail rather than report success for a SHA no longer running. The new CI image job runs without deployment secrets/VPS/publication. Promotion requires recorded successful exact-main CI image-job/capacity evidence; Deploy does not query past CI or configure branch protection. Local fixtures and Compose CLI checks do not establish real runner or production acceptance.

Additional scoped review-fix acceptance (2026-09-30, user approved): an unfinished or mismatched GHCR checkpoint blocks image-bundle deployment before success, import, backup, Git advancement, migration or activation even when checkout/manifest/healthy runtime still equal the last `smoke-passed` image SHA. Executable fixtures cover GHCR `backed-up` and `rolling-back`, same-SHA replay, absence of a GHCR marker and a valid completed GHCR handoff. Existing image A→B and image X→GHCR A→image B continuity remain required. A completed ancestral GHCR A must not block an accepted image B→C; a `rolled-back A` marker requires its old-manifest snapshot, restored history and ancestry to prove exact healthy restored state before another image release. Missing/mismatched proof remains a manual checkpoint.

Final whole-branch review-fix acceptance (2026-09-30): in the documented partial state, current `.env` may be candidate configuration while old web/bot still run. Before image import or backup, compare the rendered previous-release Compose environment, including old image defaults, with live web/bot container environments without logging secret values; only the known smoke-only `SMOKE_TG_ID` difference is ignorable. Missing or differing runtime configuration fails closed before preserving `.env` as rollback evidence. Manual GHCR deploy must reject an unfinished/malformed/mismatched image-bundle phase before backup or advancement; a completed historical image marker is accepted only with a proven current healthy GHCR handoff and ancestor relation. RED→GREEN fixtures must cover both negative paths and valid handoffs. No production change before updated PR CI and independent re-review.

Historical local fix checkpoint before PR #71 acceptance: RED tests committed before code; focused deployment/GHCR/runner contracts 6 files/144 tests and full PostgreSQL suite 128 files/849 tests passed without timeouts. All five gates passed serially (lint 0 errors/12 baseline warnings, typecheck 6/6, build 2/2), plus eight Bash syntax checks, YAML parsing/style and diff check. Independent scoped review approved the GHCR checkpoint fix without new Critical/Important findings. Exact-head/main runner evidence was still pending at this checkpoint; its accepted result is recorded below. Corrected production rollout and Telegram evidence remain open; this task stays `in_progress`.

Исторический локальный checkpoint 2026-09-30 до принятия PR #71: Tasks 1–5 реализуют package/verify/load, runtime-based previous target, backup-before-advancement, activation/rollback без сборки и default image-bundle workflow. Manual GHCR проверяет согласованный current runtime/checkout и неизменный env, восстанавливает Git/manifest/history при контролируемом отказе и требует manual checkpoint при timeout. Task 6 синхронизирует [runbook](../operations/runbooks/deploy.md) и повторяет локальные gates. На тот момент новый whole-branch review, exact-head/main CI, reviewed fast-forward prod, реальная доставка/backup/migration/smoke/cleanup и Telegram QA ещё ожидались, production evidence не было создано. Актуальная приёмка review/CI указана ниже; corrected controlled redeploy, Telegram/pilot и tag/Release `v0.1.6` остаются открытыми.

Исторический Task 6 checkpoint до принятия PR #71: локальные gates прошли — format, lint (0 errors/12 baseline warnings), typecheck 6/6 и build 2/2 (Turbo cache hits), PostgreSQL suite 127 files/795 tests, focused deploy/backup/identity contracts 5 files/90 tests, Bash syntax семи helpers, YAML parser/style и diff check. Self-review документации выполнен; independent whole-branch review на этом checkpoint ещё ожидался и впоследствии принят, как указано ниже. Это проверка локального дерева, а не Docker export/transfer/production acceptance.

- [x] RED → GREEN contract/shell-workflow tests доказывают порядок source gate → runner build/export → transfer → remote verify/load → previous-runtime capture → backup → advance → migrate → `up --no-build` → exact-SHA smoke. Existing deploy/backup/identity assertions сохраняют проверку source, backup и rollback boundaries при обновлении.
- [x] Ref не `prod`, неполный/невалидный SHA или Git bundle, dirty tracked checkout, non-FF, truncated archive, hash/size/tag/architecture/label mismatch, недостаточный диск и отсутствующий старый образ останавливают путь до backup/migration/переключения. Preflight failures не вызывают `docker load`.
- [x] Реальный partial-state fixture (`checkout=a16eb2a`, live web/bot=`67bbfe8`, candidate `.env.images=a16eb2a`, previous=`67bbfe8`) сохраняет прежний rollback target; same-SHA retry после успеха не затирает его. Повторы до load, после load, после backup, после migration и после up не дают ложный success или новый previous target.
- [x] Mismatch live web/bot/health, недоступный предыдущий образ, второй lock holder и недоказанное состояние после timeout блокируют переход с понятным manual checkpoint. До activation прежние контейнеры остаются доступны.
- [x] Контролируемые backup/migration/activation/smoke failures соблюдают указанные recovery boundaries. Откат после activation использует старые локальные образы, `--no-build` и exact old health; не выполняет Docker build, prune или автоматический DB restore.
- [x] Секреты остаются в GitHub Secrets и закрытом env staging; archive/metadata/images/log их не содержат. CI restricted SSH и обычный/recovery SSH работают независимо.
- [x] Локально проходят `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` с PostgreSQL, `pnpm build`, shell syntax и focused contracts; независимое review и exact-head/main CI проходят до fast-forward `prod`.
- [x] [Production evidence](../operations/qa/2026-09-30-r06-production-candidate.md) подтверждает successful workflow, проверенный DB backup до migration, exact SHA Git/трёх образов/запущенных web/bot/public health, healthy DB, runtime smoke и synthetic-session cleanup. Ручная Telegram/pilot QA записывается отдельно; до её принятия не публикуется `v0.1.6` tag/Release.
- [ ] Runtime-образ мигратора запускает поставленный вместе с образом `tsx` без Corepack/pnpm/npm registry на VPS. RED-тест фиксирует обнаруженное в Deploy `36747623989` скачивание `pnpm@12.4.1` из контейнера; GREEN требует исполнения final image с заблокированной сетью для проверки CLI и повторного controlled deploy без runtime download.

Offline-runtime local checkpoint (2026-09-30): RED commits `ee8d752`/`33fd8c0` precede the fix. The migrator invokes the copied `tsx` CLI directly through Node; packaging checks that CLI with `--network none` before `docker save`, refusing export on failure. Real final image `volleytime-migrator:offline-qa` reported `tsx v4.23.13` / Node `v22.23.3` without networking. Its default CMD applied all 20 migrations to a fresh isolated PostgreSQL 16 database on a Docker `--internal` network; a second run succeeded with the journal still at 20. A registry fetch from the same image/network failed, confirming blocked outbound npm access. This local smoke does not establish runner CI or a corrected production rollout.

Fresh offline-fix gates passed: format, lint (0 errors/12 baseline warnings), typecheck 6/6, PostgreSQL suite 130 files/884 tests (418.12 seconds), build 2/2, changed helper Bash syntax and diff check. Earlier focused contracts passed 101/101. Self-review found no new blocker. Accepted via [PR #71](https://github.com/trafficolog/volleytime/pull/71): head `d655109`, merge `d7e775a`, independent review approved; [exact-head CI 36754840764](https://github.com/trafficolog/volleytime/actions/runs/36754840764) and [exact-main CI 36755609169](https://github.com/trafficolog/volleytime/actions/runs/36755609169) passed all four jobs each. The corrected controlled offline-runtime production rollout remains open, as do real Telegram/pilot acceptance and the `v0.1.6` tag/Release.

## Не делать

- Не добавлять новый реестр/S3, платный VPS, автоматический DB restore, реальные пользовательские Telegram-сессии в CI или продуктовые функции вне R0.6.
- Не чинить в этой задаче внешний GHCR/Telegram IPv4; не менять роли `main`/`prod`, published tags или production secrets.
- Не делать server-side GitHub/GHCR/npm fallback, `docker system prune`, удаление старых образов/backup/volumes или blind rerun после timeout.
- Не объявлять repository tests доказательством production deploy, восстановления DB, реальной Telegram QA или пилотной приёмки.
