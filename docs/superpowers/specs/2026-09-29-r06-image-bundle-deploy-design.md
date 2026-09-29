# R0.6: сборка образов в GitHub Actions и доставка без реестра

**Предлагаемая SDD-задача:** 9.8.10 (отдельная ветка/PR). **Релиз:** кандидат `v0.1.6`. **Направление согласовано:** 2026-09-29; эта спецификация ожидает отдельного просмотра перед планом и кодом.

## Цель и границы

Завершить выпуск уже проверенного R0.6 на пилотный VPS, убрав тяжёлую Docker-сборку с двухгигабайтного сервера. GitHub `main` остаётся веткой разработки, `prod` — единственным источником production. Сервер не обращается к GitHub, GHCR или npm во время выкладки. Архив образов — способ доставки точного SHA, а не новый публичный реестр. До успешного runtime smoke и ручного Telegram/pilot QA `v0.1.6` остаётся кандидатом без тега.

Исходное состояние после [неудачного workflow 36553043217](https://github.com/trafficolog/volleytime/actions/runs/36553043217): GitHub `main`/`prod` и VPS checkout — `a16eb2a2f821e5e8f46fd8749f12d571d7aeadf4`; реально запущенные web/bot и public health — `67bbfe89acaac04992b8128d45cb1b40f8acc75c`. `.env.images` указывает на кандидат, `.env.images.previous` и `.deploy/previous-git-sha` — на работающий старый релиз. Backup до миграции проверен; новые образы, миграция и smoke отсутствуют. Повтор нынешнего `deploy-bundle` мог бы затереть previous-git-sha. Это состояние — обязательный acceptance case нового механизма.

Успех: проверенные source/образы доходят до VPS, перед миграцией создана и проверена локальная копия БД, приложение/бот/health показывают точный новый SHA, Actions smoke проходит с cleanup технического аккаунта, а откат к реально работавшему релизу не требует повторной сборки. Затем проходит отдельная ручная Telegram QA, которая не подменяется synthetic smoke.

## Выбранный подход и альтернативы

Выбран прямой перенос образов из GitHub Actions по существующему restricted CI SSH-ключу. Сборочная нагрузка переносится с пилотного VPS на runner; достаточность ресурсов runner и размер архива проверяются во время реализации и тестового прогона. Серверу нужны только Docker/Compose и место для временного архива/новых слоёв. Это сохраняет уже работающий Git bundle и не зависит от недоступного на VPS GHCR.

Альтернатива — последовательная сборка на VPS с увеличенным timeout: меньшая смена pipeline, но I/O stall/неустойчивость SSH остаются риском; одного повышения timeout недостаточно. Повышение тарифа VPS также не даёт проверенного исправления и требует отдельного решения пользователя. Эти варианты не входят в задачу 9.8.10.

## Производственный поток и границы ответственности

1. **Source gate.** Только `refs/heads/prod`, после применимых CI и review main→fast-forward prod. GitHub Actions фиксирует полный `${{ github.sha }}` и создаёт Git bundle ровно этого коммита. Прямой task-branch/tag deploy отвергается.
2. **Build на runner.** Из одного checkout для `linux/amd64` собираются `web`, `bot`, `migrator`, тегированные полным SHA и с OCI revision label того же SHA. Build не получает production secrets. Runner проверяет архитектуру/теги/label, экспортирует все три образа в архив и создаёт несекретный manifest: ожидаемый SHA, имена образов, размер и SHA-256 архива. GHCR push/pull не требуется.
3. **Передача и preflight.** CI передаёт bundle, manifest, архив, deploy helpers и mode-0600 `.env.production` в закрытый staging `/opt/volleytime/.deploy/incoming/<SHA>/` через выделенный restricted SSH-ключ. Длительная передача отделена от короткого activation; ограниченные timeout и отсутствие параллельных deploy контролируются и в Actions, и серверной блокировкой. Сервер до backup/checkout/migration проверяет bundle/expected SHA/fast-forward/clean tracked checkout, `sha256sum` архива, заявленные в manifest теги/архитектуру, неизменность работающего runtime и достаточное свободное место с запасом под staging и распакованные слои. Недостаток места останавливает выпуск; автоматически не удаляются старые образы, backup или тома.
4. **Загрузка образов без запуска.** Только после preflight `docker load` импортирует архив. Затем фактически загруженные три SHA-тега, архитектура и revision labels сверяются с manifest и ожидаемым SHA до backup/activation. Это меняет локальное хранилище образов, но не живые контейнеры, DB или `.env.images`. При ошибке старый runtime остаётся доступен, workflow сообщает failure.
5. **Предыдущий релиз и backup.** До перезаписи release manifest предыдущий SHA определяется по **запущенным** web/bot контейнерам и exact health, а не по checkout или уже изменённому `.env.images`. Их идентичность должна совпадать; соответствующие старые образы должны быть локально доступны. Если checkout уже на candidate SHA, а runtime ещё старый, предыдущий Git SHA/manifest сохраняются из подтверждённого работающего релиза. Если candidate уже реально работает, повтор того же SHA не меняет указатели отката. Если состояние неоднозначно, переход запрещён. Затем `pg_dump` → gzip validation/permissions до Git advancement и миграции.
6. **Activation.** Проверенный bundle fast-forward'ит server `prod` либо подтверждает уже достигнутый exact SHA; без server-side GitHub fetch/pull. Атомарно устанавливается SHA-tagged manifest, отдельно запускается миграция, затем Compose `up --no-build` для приложения. Post-start health обоих сервисов, public HTTPS `/api/health`, DB и release SHA проверяются. Caddy/PostgreSQL не пересоздаются без причины. Образы предыдущего релиза и backup сохраняются до завершения acceptance.
7. **Smoke и rollback.** Actions выполняет существующий synthetic-initData/forged-signature/cleanup smoke на exact SHA, включая проверку отсутствия активных технических сессий. Ошибка миграции, запуска или smoke не объявляется релизом: восстанавливаются предыдущий Git SHA/manifest и **уже существующие** старые образы через Compose `--no-build`; health старого SHA проверяется. DB migration не откатывается автоматически и должна оставаться backward-compatible. Если ошибка/timeout не даёт достоверно определить состояние, pipeline останавливается с явным ручным recovery checkpoint вместо слепого rerun/reboot.
8. **После успешного workflow.** Фиксируются точный GitHub `main`/`prod` SHA, серверный checkout, image tags/labels, здоровые контейнеры, backup и external health/smoke. Лишь затем начинаются реальные Telegram WebView/двухаккаунтные проверки по существующему checklist. Тег/Release создаётся только после принятия пилота; никакие опубликованные теги не переписываются.

## Повторяемость и отказные состояния

- Серверный lock защищает staging/activation от второго запуска вне GitHub concurrency. Выход по timeout не доказывает остановку удалённого процесса: сначала проверяются PID, lock, текущие образы/контейнеры/schema и health.
- Указатель предыдущего релиза нельзя вычислять как `git rev-parse HEAD` в частично продвинутом состоянии. Он фиксируется на основании действующих согласованных web/bot/health и не перезаписывается кандидатом при повторе same-SHA.
- Стадии имеют явные метки состояния `verified → loaded → backed-up → migrated → activated → smoke-passed`; журнал не содержит секретов. После разрыва связи метки — подсказка, но окончательное решение принимает read-only проверка фактического состояния.
- До activation любая ошибка оставляет старые контейнеры живыми; после начала activation запуск старых локально доступных образов — ограниченный recovery. Если предыдущие образы отсутствуют или несовместимы с уже применённой миграцией, stop/manual review; не делать разрушительное восстановление БД автоматически.
- Staging очищается только после проверки результата и сохранения доказательств; старые rollback-образы и release backup не затрагиваются обычной уборкой. При недостатке диска не делать `docker system prune` без отдельной диагностики и выбора точных безопасных целей.

## Проверки и приёмка

SDD-карточка 9.8.10 до кода закрепит следующие проверяемые критерии. Инфраструктурные изменения используют RED contract/shell-workflow tests → GREEN → refactor и smoke, а не только статический review:

- ref≠`prod`, невалидный SHA/bundle/архив/hash/tag/architecture/label, dirty checkout, non-FF, недостаточный диск и отсутствующий старый образ останавливают до backup/migration/переключения;
- порядок проверяем по вызовам: source gate → runner build/export → transfer → remote verify/load → previous-runtime capture → backup → advance → migrate → `up --no-build` → exact-SHA smoke;
- сценарий настоящего частичного состояния `checkout=a16eb2a`, active=`67bbfe8`, candidate manifest уже записан сохраняет прежний rollback target при следующем SHA; same-SHA retry не затирает его;
- повторы в состояниях «до load», «после load», «после backup», «после миграции» и «после up» не дают ложный success или разные previous targets;
- rollback при контролируемом отказе smoke восстанавливает старые image/health без сборки; ошибка миграции не переключает web/bot; аварийная неопределённость требует ручной read-only audit;
- секреты остаются только в GitHub Secrets/закрытом env staging, не попадают в image/archive/manifest/log; обычный и recovery SSH-ключи работают независимо от CI;
- локальные пять gates (`format:check`, `lint`, `typecheck`, `test` с PostgreSQL, `build`), shell syntax, focused contracts, независимое review и exact-head/main CI проходят до fast-forward prod;
- production acceptance требует успешного workflow, проверенной DB backup до миграции, точного SHA Git/образов/public health, healthy web/bot/DB, synthetic cleanup, runtime smoke и затем отдельного ручного Telegram/pilot evidence.

## Не входит

Новый реестр, S3, платное расширение VPS, починка внешнего GHCR/Telegram IPv4, изменение продукта R0.6, автоматический откат БД, реальные пользовательские Telegram-сессии в CI, публикация финального `v0.1.6` до пилотной приёмки. Не меняются существующие `main`/`prod`-роли или immutable release tags.
