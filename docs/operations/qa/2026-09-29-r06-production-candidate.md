> **Historical evidence recovered2026-10-12 (Task9.8.16).** Source8aa3056, previously unmerged docs-only branch. The build-on-VPS attempt and partial runtime described here are historical; superseded by runner image-bundle Deploy36772178900/37673966652 and [R0.7 pilot acceptance](2026-10-11-r07-pilot-acceptance.md). Do not retry these old commands, change current production or infer a current blocker from this report.

# R0.6 / v0.1.6 — контролируемая выкладка полного кандидата

Task: 9.8.7; локальная приёмка: 8.10.3. Дата: 2026-09-29.

Статус: **первый deploy завершился timeout; production остаётся на прежнем runtime; acceptance не подтверждена**. Реальный Telegram/pilot после успешной выкладки остаётся отдельной ручной проверкой. Тег v0.1.6 не создан, старые теги не изменялись.

## Проверенный источник и продвижение

- Локальная QA принята PR #68, head `75b5c38`, merge `32d7c4f`; exact-head CI `36552036320` и main CI `36552362827` success, merge/head tree совпадают. F/P/T matrix и пять gates 125/731, native 200% и local exact-SHA synthetic smoke описаны в [итоговой матрице](2026-09-28-r06-integrated-matrix.md).
- Acceptance sync PR #69, head `07a7587`, exact-head CI `36552529670` success, merge `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4`; tree обоих `6eb462f93f50eab395a7f9a22a52c0c00b52f70e`. Main CI `36552778471` success во всех трёх jobs. Независимый review обеих QA/documentation ревизий — без Critical/Important.
- Продвижение выбранного **main SHA** `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4` в prod выполнено обычным fast-forward push, без force. Старый prod `67bbfe89acaac04992b8128d45cb1b40f8acc75c` — его предок. GitHub `main`, `prod` и локальный tracking `prod` совпадают на выбранном кандидате. Текущий QA/evidence worktree тоже содержит выбранный runtime; исторические worktrees/ветки с прежними коммитами не переписаны.
- [Deploy workflow 36553043217](https://github.com/trafficolog/volleytime/actions/runs/36553043217) запущен push в prod, verified bundle / local-build. Нет server-side git pull/fetch, ручного копирования application-кода или GHCR fallback.

## Preflight и rollback boundary

- Normal `volleytime`, recovery `volleytime-recovery` и restricted CI `volleytime-github-actions` SSH credentials независимо проверены с BatchMode: вход deploy работает. Значения ключей и production Secrets не опубликованы.
- До выкладки VPS tracked checkout чистый, branch prod, SHA `67bbfe8`; web/bot/PostgreSQL healthy. Диск: 11 GiB свободно; доступная память около 1115 MiB, swap около 1600 MiB. Другой build/deploy не обнаружен.
- Единственная новая SQL-миграция — `0019`: ADD `organizations.subscriptions_enabled boolean DEFAULT true NOT NULL`. Additive/backward-compatible; application rollback не требует удаления колонки и не откатывает данные.
- Runbook/script review подтверждает verify → previous SHA → backup → advance → build → migrate → up → smoke. Новые результаты backup/runtime фиксируются ниже только после фактической проверки.
- Настроен GitHub Secret `SMOKE_TG_ID` для отдельного технического id `9808103001`; read-only SELECT до выкладки подтвердил отсутствие такого id в production. Он не вступает в организации. Workflow проверяет вход с подписанным техническим initData и затем cleanup помечает аккаунт, удаляет его сессии. Это не реальный Telegram WebView/initData от клиента и не ручной Telegram QA.

## Результаты выкладки

Source gate и Test before deploy прошли, но [workflow 36553043217](https://github.com/trafficolog/volleytime/actions/runs/36553043217) завершился **failure**: `Deploy verified bundle over SSH` оборван `Run Command Timeout` через 30 минут, в 10:35:07 UTC. Последний зарегистрированный Docker-этап — `#31 [migrate runtime 1/5] COPY --from=deps /app/node_modules ./node_modules` в 10:29:22 UTC; до миграции, `up` и Smoke check workflow не дошёл. `Smoke check` и обе автоматические rollback-стадии skipped. Новая release DB backup `backups/volleytime_20260929_100507.sql.gz` (9454 bytes) создана до смены checkout; после failure повторно проверены `gzip -t` success и mode600. Restore из этой конкретной копии не выполнялся и не заявляется.

Во время build повторные внешние health запросы не уложились в 10–15 s; новые SSH подключения периодически timeout, recovery SSH затем ответил. Uptime оставался 9 days (перезагрузка не наблюдалась), load ≈16, available RAM≈913 MiB, swap free≈1273 MiB. Пользовательский root `vmstat 1 3`: 8 blocked tasks, `wa=93–97%`, swap-in 752–888 KiB/s; SSH `/proc/pressure/io`: full avg10≈88.62, avg60≈89.61. Три Dockerfile имеют отдельные dependency-install стадии; web и bot устанавливают по полному workspace. Логи подтверждают `pnpm install` для web, bot и migrator в одном multi-target `docker compose build`, с timeout загрузок npm. Это доказательство I/O stall и совпавшей по времени задержки внешнего доступа, не доказанный OOM/ошибка диска/хостинга. Пользовательский root kernel journal по фильтру OOM/I/O/EXT4/virtio за 20 минут вернул `-- No entries --`; deploy sudo read запрещён. Причина дисковой задержки окончательно не установлена.

Повторный read-only аудит после завершения workflow: удалённых `deploy-local-build`/Compose/Buildx/pnpm-процессов нет, SHA-tagged images `a16eb2a` нет, колонка миграции `organizations.subscriptions_enabled` отсутствует. Server checkout `a16eb2a` и `.env.images` указывают на кандидата, но **запущенные web/bot и публичный HTTPS health остаются `67bbfe8`**, оба контейнера healthy/restarts0; bot health `mode=polling`, DB healthy. Указатель `.deploy/previous-git-sha` и `.env.images.previous` сохранили `67bbfe8`; tracked checkout чистый. Диск 7.8 GiB свободно, доступная RAM 939 MiB, swap 1515 MiB; I/O pressure full avg10≈3.98 после остановки сборки. GitHub `main`/`prod` остались на `a16eb2a`. Второй deploy/перезагрузка/rollback/восстановление БД не выполнялись. Слепой same-SHA rerun недопустим: скрипт до сборки перезаписал бы previous-git-sha текущим checkout `a16eb2a` при старом runtime `67bbfe8`.

Следующий способ сборки и безопасный повторный запуск требуют отдельной SDD-проработки с сохранением previous SHA и backup boundary. До успешных нового workflow, точного SHA образов/health, runtime smoke и проверки отсутствия технических сессий после cleanup публикация кандидата не заявляется.

## Оставшаяся ручная приёмка

[Telegram checklist](telegram-miniapp-checklist.md), Tasks 8.7.2/8.8.11: настоящие организатор/игрок и тестовая организация, открытие из бота/чата, реальный initData, light/dark themeChanged, системные кнопки, запись/оплаты/абонементы/отмена, deeplink и уведомления. После controlled deploy пользователь проходит доступные iOS/Android/Desktop и фиксирует фактические результаты; отсутствующая платформа не считается проверенной автоматически. При критическом дефекте остановить/откатить кандидат по runbook. До ручного Telegram и пилотной приёмки релиз остаётся кандидатом; повторяющееся наблюдение не остановлено.
