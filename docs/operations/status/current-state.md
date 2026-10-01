# 📸 Текущее состояние проекта

> **R0.7, Task 6 локально проверена, 2026-10-01:** Tasks 1–3 приняты в main: PR #80/#81/#82. Уведомления 8.11.1 приняты через [PR #82](https://github.com/trafficolog/volleytime/pull/82), [CI 36836542260](https://github.com/trafficolog/volleytime/actions/runs/36836542260) success на `26ae4b25ff601fc1a09b95c9150acd206d060eaf`, merge/base `73e18757db0a7055f8bfcb5dc0055fb9c835b1a1`. Денежные гонки 6.11.2 — in_progress: final-source characterization 3×37/37 GREEN, пять gates PASS (143 files / 1031 tests, lint 0 errors / 12 baseline warnings, typecheck 6/6, build 2/2). Production-дефект не выявлен; production-код не менялся, review/CI/merge ещё открыты. По решению controller Task 6 выполняется перед UI Tasks 4/5: зависимости только 6.11.1 и 8.11.1 закрыты. UI Tasks 4/5 и release Task 7 остаются todo. Production, capability, Telegram/pilot acceptance R0.6/R0.7 этой работой не меняются; нижние checkpoints исторические.

> **R0.7, реализация задач 1–3, 2026-10-01:** задачи 5.16.1 и 6.11.1 приняты в main после RED→GREEN, пяти gates и independent review: [PR #80](https://github.com/trafficolog/volleytime/pull/80), финальный [CI 36828093886](https://github.com/trafficolog/volleytime/actions/runs/36828093886); [PR #81](https://github.com/trafficolog/volleytime/pull/81), финальный [CI 36831883906](https://github.com/trafficolog/volleytime/actions/runs/36831883906), `main=548eb77`. Аддитивная миграция, fixed/split validation, неоплаченные split reservations и атомарный settlement с immutable allocation реализованы. Уведомления 8.11.1 локально реализуются: focused RED 7 → GREEN 21, статус in_progress до independent review/CI/merge; задачи 4–7 остаются todo. Production по последнему подтверждённому deploy остаётся `967aff3`, capability split не включалась. Ни реальная Telegram доставка split-уведомлений, ни pilot acceptance R0.6/R0.7 этой работой не подтверждаются. Нижние записи о todo/не начатой реализации сохранены как исторические checkpoints.

> **R0.7, утверждение плана и docs review corrections, 2026-10-01:** пользователь утвердил и [финансовую спецификацию](../../superpowers/specs/2026-10-01-event-split-pricing-design.md), и [письменный план семи задач](../../superpowers/plans/2026-10-01-event-split-pricing.md). Синхронизированы D1–D3: rollback quiescence всех web/bot writers под deploy lock до authoritative guard и old activation, Task 7 merge после local/review/exact-head CI со статусом in_progress до deployment/manual evidence, manager-only pricingPermissions и API-to-form cancelled-only/waitlist-only checks. Карточки остаются todo, реализация не начата; продуктовый код, миграции и production не менялись. Ниже сохранены исторические ожидания review, они больше не блокируют утверждённый план. [R0.7 scope](../../RELEASES.md#r07--mvp-режим-оплаты-события-v017-спецификация-и-план-утверждены); R0.6 Telegram/pilot acceptance остаётся отдельно открытой.

> **R0.7, подтверждение 2026-10-01:** пользователь утвердил финансовую спецификацию fixed/split. [План реализации семи задач](../../superpowers/plans/2026-10-01-event-split-pricing.md) подготовлен для review с сохранением выбранного Subagent-driven и отдельной проверки каждой задачи. Карточки остаются todo; продуктовый код, миграции и production не менялись. Предыдущая запись о предложениях финансовых правил ниже — историческая, не текущий блокер спецификации. R0.6 Telegram/pilot acceptance остаётся отдельным открытым пунктом.

> **R0.7 подготовка, 2026-10-01:** пользователь подтвердил реализацию fixed/split. [Спецификация](../../superpowers/specs/2026-10-01-event-split-pricing-design.md) и семь task cards 5.16.1–2, 6.11.1–2, 8.11.1–2, 9.8.11 подготовлены для review, статус todo. Правила округления/ручного закрытия/отмен выделены как предложения; продуктовый код и БД ещё не изменены. [Релиз-план](../../RELEASES.md#r07--mvp-режим-оплаты-события-v017-спецификация-и-план-утверждены) фиксирует отдельный v0.1.7. R0.6 Telegram/pilot acceptance остаётся открытой. Документация исправленной выкладки принята PR #78 после review и CI36774382114; GitHub main2c85171 содержит только последующий docs-коммит, prod/VPS по последнему доказанному deploy967aff3.

> **Исправленный кандидат опубликован, 2026-09-30:** [Deploy 36772178900](https://github.com/trafficolog/volleytime/actions/runs/36772178900) завершился успешно после exact-head/main CI и reviewed fast-forward. GitHub `main`/`prod`, локальная `prod` и clean VPS `prod` на момент выкладки совпали: `967aff312f962196e7347cc0e50f879f25f6dffa`. Все пять pilot UI fixes опубликованы; 9.8.10 закрыта, мигратор работает через bundled Node CLI. Новый backup проверен до миграции; health/db/auth, образы, healthy web/bot/PostgreSQL и synthetic smoke/cleanup подтверждены. [Точные доказательства](../qa/2026-09-30-r06-production-candidate.md#corrected-rollout-and-pilot-ui-fixes). Историческая локальная `main` с отдельной ancestry сохранена без переписывания. Остались real Telegram regression, двухаккаунтная matrix и pilot acceptance; tag/Release `v0.1.6` отсутствуют. Прежние pending checkpoint ниже исторические.

> **Итоговый pilot-fix local gate, 2026-09-30:** общий прогон на frozen runtime-source6cb214a прошёл format/lint(0errors/12baseline warnings)/typecheck6/6/test135/907/build2/2. Whole-branch review не нашёл Critical/Important; docs-only fixc9019f0 прошёл scoped re-review, один будущий test-maintenance Minor явно отложен. Controller повторил ключевые Chrome matrices и read-only VPS preflight; всё остаётся локальным/диагностическим evidence. [Отчёт](../qa/2026-09-30-r06-pilot-ui-fixes.md) отделяет завершённые проверки от ещё необходимых selected-head/main CI, controlled redeploy и реального Telegram regression/pilot. Prod остаётся64f1850.

> **Pilot UI fixes в main, 2026-09-30:** все пять замечаний пользователя приняты отдельными PR #72–76 с RED→GREEN, browser QA, собственными пятью gates и независимым review. Итоговый runtime-source `main=575ca06576e40a40e99340081b81b559243057a1`; последнее локальное покрытие —135 файлов/907 тестов. [QA evidence](../qa/2026-09-30-r06-pilot-ui-fixes.md) фиксирует точные SHA/CI и ограничения. Offline migrator принят PR #71 с exact-head/main CI. Общие финальные gates/review и controlled redeploy ещё открыты. Проверка HTTPS health в19:28UTC подтверждала прежний `prod=64f1850`, status/db/auth ok; сервер этими PR не менялся. Telegram screenshots — частичная полевая проверка, не принятие всей matrix; tag/Release `v0.1.6` не публикуются.

> **9.8.10 offline-runtime local fix, 2026-09-30:** RED commits `ee8d752`/`33fd8c0` precede direct Node/bundled-tsx execution and the offline CLI gate before image export. A real final image applied all 20 migrations twice to isolated PostgreSQL 16 on an internal Docker network while outbound npm access was blocked. Updated CI/review and a corrected controlled deploy remain open; production still runs candidate `64f1850` and this local check makes no production or Telegram acceptance claim.

> **R0.6 production candidate, 2026-09-30:** [Task 9.8.10 production evidence](../qa/2026-09-30-r06-production-candidate.md) records merged PR #70 (`main=64f18506b03081bc7b9c065c8371cd3e62f10b30`), successful exact-head/main CI, reviewed fast-forward `prod` and successful [Deploy 36747623989](https://github.com/trafficolog/volleytime/actions/runs/36747623989). VPS tracked `prod`, three amd64 image revision labels, healthy web/bot/PostgreSQL, bot polling health and public HTTPS health all identify that SHA. A mode-0600 gzip-validated DB backup preceded migration; exact-SHA synthetic auth/forgery/cleanup smoke and `smoke-passed` completed. The previous live `67bbfe8` remains the rollback pointer. **Offline-VPS acceptance remains open:** the migrator downloaded pnpm from npm registry inside its container during activation. Real Telegram Mini App/two-account pilot QA is also not done, and no `v0.1.6` tag or GitHub Release has been published. Historical local-only entries below are retained as checkpoints, not current production state.

> **Additional 9.8.10 local review fix, 2026-09-30:** image-bundle deployment now checks GHCR checkpoints before same-SHA success or mutation, including when accepted image checkout/manifest/runtime still agree. Unfinished/mismatched histories stop at a manual checkpoint; completed ancestral handoffs and proven restored rollbacks preserve subsequent image releases. RED tests were committed before code; focused contracts 144/144 and PostgreSQL suite 128 files/849 tests passed without timeouts. Five serial gates, eight Bash syntax checks, YAML and diff checks passed. Independent scoped review and external CI/production/Telegram gates remain open; this records no production or Telegram acceptance.

> **PR #70 final recovery fix, local checkpoint 2026-09-30:** the partial-state image path now compares the old release's rendered Compose and image-default environment with running web/bot before image import or backup, reporting only mismatch categories; only smoke-only `SMOKE_TG_ID` may differ. Manual GHCR now rejects unfinished/malformed/mismatched image-bundle checkpoints before backup/pull. RED commit `61b5ad0` reproduced 30 expected failures; GREEN full PostgreSQL suite passed 129 files/881 tests, format/lint (0 errors, 12 existing warnings), typecheck 6/6, build 2/2, Bash syntax, YAML parse and diff checks passed. The read-only helper passed against the actual VPS partial state without printing values. Independent scoped re-review closed both Important findings with no new blocker. Updated exact-head PR/main CI, controlled production deploy and Telegram pilot QA are still open; no production mutation occurred.

> **Task 6 local gates, 2026-09-30:** format, lint (0 errors/12 baseline warnings), typecheck 6/6 и build 2/2 (Turbo cache hits), PostgreSQL 127 files/795 tests, focused contracts 90/90, shell/YAML и diff check прошли. Документация сверена с helpers/workflow. Independent whole-branch review и внешние CI/production/Telegram gates ниже ещё не пройдены.

> **9.8.10, локальный checkpoint 2026-09-30:** реализован новый default image-bundle workflow и обновлён [runbook](../runbooks/deploy.md): runner build/export, private transfer, verify/load, runtime-based previous target, backup-before-advancement, activation/rollback без сборки, bounded exact smoke/cleanup. GHCR — explicit manual с согласованными checkout/manifest/runtime и неизменным env. Task 6 повторяет локальные gates; independent whole-branch review, exact-head/merge-tree/main CI, reviewed fast-forward prod и controlled production evidence остаются открытыми. Ни deploy, ни новые production backup/restore, ни Telegram QA этой локальной работой не выполнены. 9.8.10 остаётся in_progress; 8.7.2/8.8.11 и принятие v0.1.6/tag остаются отдельными. Исторические live snapshots ниже не доказывают текущий VPS state и требуют read-only перепроверки перед выкладкой.

> **R0.6 predeploy QA принят, 2026-09-29:** [PR #68](https://github.com/trafficolog/volleytime/pull/68), `main=32d7c4f`, exact-head CI `36552036320` success, merge/head tree совпадают. 8.10.3 done для локального F/P QA/gates; все MVP implementation dependencies done. Проверены normal/recovery/CI SSH ключи, чистый tracked серверный prod `67bbfe8`, healthy web/bot/PostgreSQL, 11 GiB свободного диска; записи на VPS не выполнялись. Миграция только additive `subscriptions_enabled DEFAULT true NOT NULL`, review допускает runbook FF/Actions/backup-before-migration. Production ещё v0.1.5; настоящий Telegram/pilot и окончательное принятие v0.1.6 остаются после controlled deploy полного кандидата.

> **8.10.3 локальный gate, 2026-09-29:** интеграция `1a063e5` с `main=99cae3a` прошла пять gates 125/731, local exact-SHA health/auth/synthetic-initData/forgery/cleanup smoke и focused independent re-review без Critical/Important. [Матрица](../qa/2026-09-28-r06-integrated-matrix.md) сохраняет точный охват F/P/T, representative native 200% auth/player и прежние пользовательские проверки. До acceptance QA-задачи остаются PR/exact-head CI; `prod`/VPS v0.1.5 без изменений. Live Telegram/pilot после controlled deploy полного кандидата.

> **3.11.10 в main, 2026-09-29:** [PR #66](https://github.com/trafficolog/volleytime/pull/66), merge `99cae3a`, exact-head CI `36542875997` и main CI `36543085212` success; merge/head tree одинаково. Native Chrome 200% подтвердил OTP countdown `1:00→0:59`, пять gates 125/731 и независимое review прошли. Исправление интегрировано в QA-ветку 8.10.3 как `1a063e5`; её итоговые gates/smoke/review/CI ещё выполняются. `prod` и VPS остаются v0.1.5. Реальный Telegram QA — после controlled deploy полного кандидата, до окончательного принятия.

> **8.10.6 в main, 2026-09-29:** [PR #64](https://github.com/trafficolog/volleytime/pull/64) merge `c473de1`, exact-head [CI 36538108493](https://github.com/trafficolog/volleytime/actions/runs/36538108493) и [main CI 36538310519](https://github.com/trafficolog/volleytime/actions/runs/36538310519) success, деревья merge/head совпадают. Mounted RED→GREEN (включая исправление failed revoke), пять gates 125/727, Chrome error/retry 45/45 и revoke fixture 4/4, independent re-review без блокеров. [8.10.3 closure-map](../qa/2026-09-28-r06-integrated-matrix.md) свёл owner 48 Mini App + 55 desktop, auth15, landing5, entry/invite60, secondary error45 и primary error21 без новых production/Telegram claims; итоговые gates/review/CI QA-ветки ещё открыты. `origin/prod=67bbfe8` / v0.1.5 и VPS не менялись. Реальный Telegram-host и двухаккаунтный пилот — после controlled deploy полного кандидата.

> **8.10.3, entry/invite/error-retry 2026-09-29:** [отчёт](../qa/2026-09-29-entry-invite-error-states.md) фиксирует Chrome 60/60 entry/invite/group states, real local negative initData 401 с актуальной ссылкой бота и 41/41 error→retry GET 200 (Mini App/desktop). Выявлен отдельный UI-дефект [8.10.6](../../tasks/8-10-6-miniapp-invite-load-retry.md): 503 списка приглашений Mini App показывает ложный empty и не даёт retry. Исправление согласовано; до кода создана карточка, общий QA/release gate ещё открыт. `origin/main=c946142`, `origin/prod=67bbfe8` проверены fetch; VPS не менялся.

> **3.11.9 принята в main, 2026-09-29:** [PR #61](https://github.com/trafficolog/volleytime/pull/61), merge `b4c9630`, закрывает потерю Oswald/Golos при прямом auth/desktop entry без зависимости от Google Fonts. Browser RED → GREEN (семь local loaded/200 faces, кириллица), пять gates (124 files / 722 tests), owner 103/103, auth 15/15, landing 5/5 и независимые task/whole-branch review без новых замечаний; [CI 36523981993](https://github.com/trafficolog/volleytime/actions/runs/36523981993) success на `67ef8c6`. Дерево merge идентично проверенному head; [отчёт](../qa/2026-09-29-global-local-reference-fonts.md). Task `done`, общий 8.10.3 открыт. `prod=67bbfe8` / v0.1.5 и VPS не менялись; Telegram-host QA остаётся после выкладки полного кандидата.

> **8.10.3, продолжение 2026-09-29 (локальная QA-ветка):** принятый main `c946142` объединён с сохранённым checkpoint `c0883fc`. Конфликты документации разрешены с сохранением QA evidence и принятого состояния 3.11.9; runtime идентичен main. Font-зависимость закрыта через PR #61/#62: повторная матрица с loaded faces — 48 Mini App + 55 desktop, auth 15 и landing 5 случаев, пять gates/review/CI пройдены по [3.11.9](../../tasks/3-11-9-global-local-reference-fonts.md). [Общая матрица](../qa/2026-09-28-r06-integrated-matrix.md) ещё открыта: оставшиеся entry/invite/error states и итоговый release smoke; Telegram-host/pilot — после полной выкладки. Историческая запись 2026-09-28 ниже не является текущим перечнем font/auth blockers. Prod/VPS не менялись.

> **8.10.3, локальный сквозной проход 2026-09-28:** от принятого main `060ecdf` создана отдельная QA-ветка. [Общая матрица](../qa/2026-09-28-r06-integrated-matrix.md) связывает референсы, routes/states и конкретное evidence, отделяя прежнюю task QA от свежего Chrome. Повторены player 41 fixture checks, 28 real-API cases после штатного QA email OTP, шесть access/error states и group-race/network-retry/switcher. Совместные auth/organizer/desktop, итоговые release smoke/gates и post-deploy Telegram/pilot acceptance ещё открыты; ни готовность deploy, ни завершение 8.10.3 не заявлены. Уже предоставленные ручные 200%/screen-reader/фон stop-resume не запрашиваются повторно. `prod`/VPS остаются v0.1.5.

> **3.11.8 принята в main, 2026-09-28:** [PR #59](https://github.com/trafficolog/volleytime/pull/59), merge `07fb8af`, закрывает локальный fallback лендинга при отказе session API без изменения общей авторизации/дизайна. RED→GREEN, пять gates (124 files / 722 tests), свежий Chrome 503/FAQ/CTA и landing regression, независимое review без замечаний и [CI 36476869854](https://github.com/trafficolog/volleytime/actions/runs/36476869854) success на `3595b7f`; merge tree идентично head. [Отчёт](../qa/2026-09-28-landing-session-fallback.md). Исторические строки о незавершённой 3.11.8 ниже более не blockers. Общая 8.10.3 остаётся открытой; `prod=67bbfe8` / v0.1.5 и VPS не менялись. Реальный Telegram-host QA — после контролируемой выкладки полного кандидата, не перед ней.

> **Landing принят в main, 2026-09-28:** [PR #43](https://github.com/trafficolog/volleytime/pull/43) смёржен как `1fa662f` после пяти gates, Chrome browser/visual QA, пользовательских native 200%/фон stop-resume и independent review без блокеров. [CI 36467608712](https://github.com/trafficolog/volleytime/actions/runs/36467608712) success на `e6bfaf3`; итоговое дерево merge идентично проверенному head. 3.11.4 **done**, а 3.11.8 (fallback ошибки сессии), общий 8.10.3 и Telegram-host acceptance отдельно открыты. Исторические ожидания landing merge/ручных пунктов ниже более не являются blockers. `prod` остаётся `67bbfe8` / v0.1.5; VPS не менялся.

> **Ручной landing QA, 2026-09-28:** пользователь подтвердил native zoom 200% для приложенного полного снимка лендинга, остановку анимации в настоящей фоновой вкладке и возобновление после возврата. Эти три ручных пункта пройдены; повторно запрашивать их не требуется. Результат внесён в [3.11.4](../../tasks/3-11-4-mvp-landing-v2.md), без подмены Telegram-host QA, нового CI интегрированной ветки или общего R0.6 gate и без публикации в `main`/`prod`/VPS.

> **Интеграция landing 3.11.4, 2026-09-28 (только task-ветка):** после приёмки player PR #47/#57 обновлённый `main` `38c9b05` совмещён с landing PR #43. Повторные пять gates (123 files / 717 tests), Chrome browser/visual smoke и independent review без Critical/Important пройдены; [отчёт](../qa/2026-09-28-landing-post-main.md). Ручные zoom/фон stop/resume подтверждены пользователем. Minor logging при API session 503 вынесен в отдельную [3.11.8](../../tasks/3-11-8-landing-session-failure-fallback.md) до общего R0.6 gate. Новый точный CI/merge PR #43 и общая 8.10.3 ещё открыты; `prod`/VPS остаются v0.1.5.

> **Дополнение 2026-09-26, landing-ветка:** [3.11.7](../../tasks/3-11-7-landing-reference-fidelity.md) закрыта: пользователь принял восстановленный внешний вид, точный fix-head `76b9a87` прошёл CI `36229113553`, PR #46 слит в landing-ветку как `511b44f` с идентичным деревом. Локальная ветка выровнена fast-forward; родительский PR #43 draft и проверяет свой CI. Это не закрывает 3.11.4, общий R0.6, native zoom/фоновую вкладку, production-бот, полный интерактив или Telegram QA. `main`, `prod` и VPS не менялись.
> **Задача 8.10.1 принята в main, 2026-09-28:** player Mini App v2 объединён с принятым organizer Mini App; два замечания whole-branch review прошли SDD RED → GREEN и повторное review без замечаний. Пять локальных gates (120 файлов/708 тестов, lint 0 ошибок/12 предупреждений), player fixture/real-API browser matrix, выборочный owner Home/menu/events на QA API и три job [CI 36452709192](https://github.com/trafficolog/volleytime/actions/runs/36452709192) на `ae678dd` прошли. [PR #47](https://github.com/trafficolog/volleytime/pull/47) смёржен как `f5a9d41`; [отчёт](../qa/2026-09-28-player-post-organizer.md). Native 200% Mini App, общий 8.10.3 и Telegram-host QA остаются отдельно открытыми. `prod`/VPS не менялись; реальный Telegram QA — после выкладки полного кандидата.

> **Текущий итог 2026-09-28:** organizer Mini App 8.10.2 и отдельно проверенный stacked loading-fix 8.10.4 приняты в main через [PR #55](https://github.com/trafficolog/volleytime/pull/55), merge `2086ee4`; [CI 36430967186](https://github.com/trafficolog/volleytime/actions/runs/36430967186) success на `ec6493d`. Пять локальных gates (112 файлов/637 тестов; lint 0 ошибок/19 предупреждений; typecheck 6/6; build 2/2), whole-branch review без замечаний, 28 основных и 12 invite browser cases; [отчёт](../qa/2026-09-28-organizer-miniapp-post-main.md). Пользовательский Home native 200% сохранён без переноса на другие маршруты. Player PR #47 и landing PR #43 ещё draft, совместная 8.10.3 открыта. `prod` остаётся `67bbfe8` / v0.1.5, VPS не менялся; реальный Telegram QA выполняется после выкладки полного кандидата. Исторические записи ниже не являются текущим перечнем blockers.

> **Дополнение 2026-09-28:** локальная ветка 8.10.2 интегрирует изменения актуального `main` после PR #51. Конфликты Home, общей формы события, навигации и документации разрешены с сохранением обеих линий поведения; направленные тесты 13/13, форматирование, lint (0 ошибок/19 предупреждений), typecheck 6/6, PostgreSQL tests 112 файлов/637 тестов и build 2/2 прошли на объединённом дереве. Это не заменяет финальный визуальный/Telegram QA 8.10.3; `prod` и VPS не менялись.

> **Дополнение 2026-09-28 — 8.10.5:** фикс переноса действий приглашения Mini App прошёл RED/GREEN на реальном Vue DOM (12/12: client width 320/390/160, light/dark, оба copy-state), клавиатурный Tab, пять gates (103 files / 571 tests), scoped review без блокирующих замечаний и CI. PR #53 смёржен как `16d7266`; финальный CI `36427906815` на `89029ac` прошёл; интеграция Mini App и общий 8.10.3 ещё не закрыты. `prod` и VPS не менялись. [Карточка и ограничения](../../tasks/8-10-5-miniapp-invite-actions-reflow.md).

> **Дополнение 2026-09-28:** задача 6.10.1 desktop-оплаты/касса принята в [PR #51](https://github.com/trafficolog/volleytime/pull/51): локальные PostgreSQL gates проходят (103 files / 571 tests, lint 0 errors / 21 baseline warnings, typecheck 6/6, format, build 2/2), scoped review не нашёл Critical/Important, [GitHub CI run 36407550559](https://github.com/trafficolog/volleytime/actions/runs/36407550559) прошёл quality, PostgreSQL tests и build. Real local API/browser проверил денежные операции, права, ошибки/retry, уход во время запросов, event pagination, зону New York и клавиатурный фокус кассы. Присланные пользователем скриншоты при заявленном zoom 200% показывают «Оплаты», «Кассу» и открытую форму дохода без явного обрезания; пользователь отдельно сообщил об успешной проверке экранным диктором без детализации диктора/браузера. Подпись hero-баланса исправлена с 2,10:1 до 11,11:1 без изменения синего фона. Статус задачи **done** не означает общий R0.6 acceptance или production/Telegram-host/deploy/backup/monitoring evidence; `prod`/VPS не изменены. Подробности — [карточка 6.10.1](../../tasks/6-10-1-organizer-desktop-finance-v2.md).

> **Дополнение 2026-09-27 (только локальная ветка 8.10.2):** Последнее замечание whole-branch review о запоздалом Telegram-подтверждении после перехода с `/manage` на `/edit` того же события закрыто mounted RED→GREEN и локальным Edge production-preview: ни отмена события, ни отклонение платежа не отправили POST после смены маршрута. Отдельные серверные review-fix [6.8.13](../../tasks/6-8-13-event-cancel-payment-confirm-race.md) и [6.8.14](../../tasks/6-8-14-payment-cancel-event-deadlock.md) подтвердили соответственно несогласованное состояние оплаты и PostgreSQL deadlock `40P01`, исправлены и включены локальными fast-forward; на итоговом дереве пять gates прошли (91 файл/508 тестов, build 2/2), независимые scoped review не нашли блокирующих замечаний. 8.10.2 и R0.6 ещё `in_progress`: native 200% zoom, реальный Telegram-host/two-account QA, desktop 5.15.1/6.10.1 и общий 8.10.3 не закрыты. GitHub `main`, `prod`, VPS и опубликованный `v0.1.5` этими локальными изменениями не затронуты.

> **Дополнение 2026-09-27 (только локальная ветка 8.10.2):** Review-fix 8.10.4 с отдельным RED→GREEN и независимым scoped review включён fast-forward `316dffb → c102e48`. На объединённом дереве пять gates прошли: format, lint (0 ошибок, 17 прежних предупреждений), typecheck 6/6, 91 файл/504 теста и build 2/2. Edge production-preview при 320 px показал skeleton во время задержанного GET, сохранение фокуса и баланса, затем реальные записи; смоделированный пустой ответ показал пустое состояние после завершения загрузки. Это не закрывает native 200% zoom, реальный Telegram-host и сквозной QA 8.10.3. Ни GitHub `main`, ни `prod`, ни VPS этим не изменены; R0.6 не готов к релизу.

> **Дополнение 2026-09-27 (только ветка 8.10.2):** Whole-branch review выявил четыре регрессии в очереди оплат, тестах управления событием, фокусе фильтра кассы и состоянии Home при несовпадении ролей. Все четыре исправлены отдельными локальными RED→GREEN циклами; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (91 файл/503 теста на новой изолированной PostgreSQL QA-БД), `pnpm build` и `git diff --check` прошли. Scoped re-review и локальный браузер обнаружили отдельный дефект: во время задержанного GET при смене фильтра кассы показано «Операций пока нет» вместо загрузки. До отдельного исправления и проверки 8.10.2 остаётся `in_progress`; native 200% zoom, реальный Telegram-host QA и общий release gate 8.10.3 также открыты. Шрифты Oswald/Golos Text загрузились в локальном браузере на проверенном тёмном экране 320 px, но это не полная визуальная/Telegram-приёмка. `main`, `prod`, VPS и опубликованный `v0.1.5` не менялись.

> **Дополнение 2026-09-26 (только ветка 8.10.2):** Mini App организатора v2 локально реализован и проверен в изолированной ветке `trafficolog/feat/8.10.2-organizer-miniapp-v2`, без push/PR/merge и без изменения `main`, `prod`, VPS или опубликованного `v0.1.5`. После первого review-исправления пять repository gates прошли; 496 тестов использовали отдельную PostgreSQL QA-БД. Review нашло скрытые старые записи кассы после 200 смешанных операций: RED→GREEN вернул компактный фильтр журнала с прежним пределом 200 на тип, без отдельной панели. Edge production-preview на другой локальной QA-БД проверил основные organizer-маршруты при 390/320 CSS px и 160 px reflow proxy, светлую тему и темную палитру через явный `.dark` fixture; парные 320 light/dark снимки live HTML и приложения записаны с оговоркой о масштабируемом phone frame референса. Task 7 отдельно проверил owner и active-organizer сессии, временное выключение/восстановление абонементов через settings API и вернул тестовому участнику роль player; прочие локальные POST/PATCH и ролевые сценарии Tasks 1–6 перечислены в [карточке 8.10.2](../../tasks/8-10-2-organizer-miniapp-v2.md). Статус 8.10.2 остаётся `in_progress`: повторное независимое ревью, native 200% zoom, проверка точных Google Fonts, реальный Telegram-host QA и общий release gate 8.10.3 не закрыты. Исторический snapshot ниже не пересчитан; production по-прежнему `v0.1.5`.

> **Дополнение 2026-09-24:** новый архив дизайн-референса v2 разобран в [карте MVP-экранов](../../design/2026-09-23-reference-v2.md), а визуальная миграция запланирована отдельными SDD-карточками в R0.6 `v0.1.6`. Задача 5.13.21 по опциональным абонементам организации прошла независимое ревью, локальные gates и CI; PR #39 смёржен в GitHub `main` как `dafb98b`. [Свидетельства и ограничения](../../tasks/5-13-21-organization-subscriptions-toggle.md) записаны в карточке. Это **не** подтверждает Telegram-host QA, общий визуальный QA R0.6 или production deploy. Снимок ниже исторический и требует отдельной общей сверки статуса.

> **Дополнение 2026-09-25 (ветка 8.10.1):** Mini App игрока v2 остаётся `in_progress`. Последние локальные пять gates прошли (91 файл/508 тестов); [частичный browser/DB smoke](../qa/2026-09-24-player-miniapp-v2-local.md) подтверждает отмену/повторную запись, повышение из листа ожидания, применение/возврат тестового остатка, информационные состояния доступа на прямых маршрутах и отсутствие горизонтального переполнения на проверенных 320/390 px маршрутах. Это не подтверждает реальную оплату/Telegram, полную функциональную и визуальную матрицу или QA других задач R0.6. Новые правки доступа ждут независимого review. Эти изменения не опубликованы в `main`; `prod` и VPS не менялись.
> **Уточнение 2026-09-25 (ветка 8.10.1):** Дополнительно локальный browser/DB smoke подтвердил серверный отказ при изменившемся времени записи/отмены, обновление устаревшего CTA после исправления и защиту после истечения QA-сессии. Последние пять gates: 91 файл/509 тестов, сборка успешна. Независимый review последней правки и полный visual/functional/Telegram-host QA остаются открытыми; `main`, `prod` и VPS не менялись.
> **Актуализация 2026-09-25 (ветка 8.10.1):** Очищенный архив референсов сопоставлен с `01–03-miniapp.png`; локальный browser smoke подтвердил скрытую, но работающую прокрутку Mini App на 320/390 px. Review выявил потерю текста отказа при снятии события с публикации; RED → GREEN, сборка и browser/DB smoke на QA-событии подтвердили исправление и восстановление фикстуры. Пять локальных gates зелёные (91 файл/511 тестов; lint без ошибок с 15 прежними предупреждениями), повторный review исправления без новых находок. [Детали](../qa/2026-09-24-player-miniapp-v2-local.md). Полная визуальная/функциональная матрица и реальный Telegram-host QA остаются открытыми. `main`, `prod`, VPS не менялись.

> **Last generated:** 2026-09-21
> **Source:** canonical GitHub repository, production VPS and live `v0.1.5` release evidence.

## Краткая сводка

- **Имя:** Volley Time
- **Домен:** `volleytime.by`
- **Стек:** Nuxt 4 + Drizzle + PostgreSQL + better-auth + grammY
- **Runtime release target:** Node.js 22, pnpm 12.4.1
- **R0/MVP scope:** phases 3, 4, 5, 6, 8, 9
- **Реализация:** основные MVP-потоки закодированы; два code review прошли hardening до `v0.1.2`.
- **Текущая итерация:** post-release MVP acceptance после опубликованного `v0.1.4`; новые продуктовые доработки оформляются отдельными SDD-задачами по готовности референсов.
- **Следующие продуктовые фазы:** 10 / 7 / 15 и далее — вне текущего release scope.

## Что реализовано в R0

### Foundation / auth

- pnpm/Turborepo monorepo, TypeScript, ESLint/Prettier, Vitest;
- PostgreSQL + Drizzle migrations/rollback;
- passwordless email auth + Telegram identity/initData;
- CI, Docker development and production builds.

### Organizations

- organization CRUD, membership, invite links, moderation;
- owner/organizer/player policies;
- tenant resolution and organization-scoped API;
- audit log.

### Events / bookings / subscriptions

- venues, events, capacity and cancellation rules;
- booking, pending payment, waitlist and promotion;
- attendance;
- subscription plans, purchase, consume/restore sessions;
- event cancellation with restore/refund logic.

### Payments / ledger

- cash/transfer pending payments;
- organizer confirm/reject;
- transaction-safe state changes;
- income/expense ledger and cashbox UI.

### Telegram / Mini App

- grammY bot and deep links;
- Telegram Mini App auth, theme and navigation;
- notification flows;
- player and organizer MVP screens.

### Production infrastructure

- web, bot and migrator Docker images;
- Caddy HTTPS/webhook routing;
- production compose;
- separate migration stage;
- smoke script with auth and forged-initData checks;
- production deploy from GitHub `prod` through runner-built exact-SHA image bundles and a verified Git bundle, without a VPS build (9.8.10); the old local-build path is historical;
- exact-SHA release identity and explicit application rollback to an immutable ancestor;
- backup/restore scripts and Sentry integration points.

## Review history

| Версия   | Результат                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `v0.1.0` | Первое полное ревью выявило 21 P0.                                                                                                   |
| `v0.1.1` | 21 P0 закрыты; 370 тестов были зелёными по отчёту ревью.                                                                             |
| `v0.1.2` | Повторное ревью подтвердило P0 и выявило 4 P1 + 5 P2; fix-эпики 3.10, 5.14, 6.9, 8.9, 9.10 смёржены.                                 |
| `v0.1.3` | Опубликованный verified production baseline `91f6bff`; manual local build и isolated restore.                                        |
| `v0.1.4` | Опубликован на `16c2fe4`: prod-only bundle deploy, exact identity, polling fallback и live rollback.                                 |
| `v0.1.5` | Исправлен bot identity drift: invite links, token и runtime config указывают на `@volleytimeby_bot`; deploy guard проверяет `getMe`. |
| `v0.1.6` | R0.6 candidate `64f1850` deployed; real Telegram/pilot acceptance and public tag/Release are still open.                             |

Отчёты: [v0.1.0 review](../reviews/2026-09-16-v0.1.0-review.md), [v0.1.1 re-review](../reviews/2026-09-18-v0.1.1-rereview.md), [v0.1.2 release-readiness](../reviews/2026-09-18-v0.1.2-release-readiness.md).

## Release state

### Repository gate

Канонический MVP gate задаётся **только** R0 release-plan: **139 исходных задач** фаз 3.1-3.8, 4.1-4.8, 5.1-5.12, 6.1-6.7, 8.1-8.7 и 9.1-9.8. Hardening/review/release-readiness эпики (`3.9+`, `4.9`, `5.13+`, `6.8+`, `8.8+`, `9.9+`) не входят в знаменатель MVP и являются evidence исправлений.

Текущий R0 snapshot: **139 tasks = 132 done + 7 in_progress**.

Открытые R0 cards:

- **8.7.2** — полный реальный Telegram Mini App QA на клиенте и двух аккаунтах;
- **9.4.1** — BotFather domain/menu, Mini App opening, deeplinks и real initData login;
- **9.5.1** — прямой Telegram webhook остаётся заблокирован внешним IPv4 ingress; production работает через polling;
- **9.6.1, 9.6.2** — Sentry event delivery и внешний UptimeRobot alert;
- **9.7.1, 9.7.2** — S3 upload/retention и S3-based restore.

После PR #3 закрыт последний продуктовый repository gap `4.7.5`. Production deploy path затем был переведён на проверяемый Git bundle: push в `prod` проходит CI, передаёт exact SHA на VPS, создаёт локальный DB backup, собирает SHA-tagged images, выполняет migration/up и smoke. GHCR сохранён только как ручная альтернатива.

**Известных repository implementation gaps в исходных 139 R0 задачах больше нет.** Оставшиеся 7 карточек требуют manual/client, monitoring, S3 или внешнего webhook evidence и не закрываются repository CI.

Ранее выполненный reconciliation по 237 R0+review cards остаётся полезным документарным аудитом, но **не является MVP denominator**.

### External / production gate

Проверено в production:

- [x] HTTPS, database/auth health и здоровые web/bot/PostgreSQL containers;
- [x] отдельные CI credentials и требуемые GitHub Secret names;
- [x] автоматический prod-only bundle/local-build deploy без VPS egress к GitHub/GHCR;
- [x] R0.6 image-bundle deploy на `64f1850` без VPS Docker build, с pre-migration backup, exact image/runtime SHA и synthetic cleanup ([evidence](../qa/2026-09-30-r06-production-candidate.md)); runtime npm dependency внутри migrator container остаётся дефектом 9.8.10;
- [x] release-local backup до advancement/migration и isolated restore в PostgreSQL 16;
- [x] controlled application rollback на `v0.1.3` и успешный redeploy exact SHA;
- [x] Telegram Bot API outbound через IPv6 и обработка реальных updates в polling mode.
- [x] полный VPS hardening audit: key-only SSH/recovery, UFW, fail2ban, timezone/NTP и unattended-upgrades dry-run.
- [x] real production delivery через защищённый `web → bot internal notify → Telegram` path.

Production bot identity drift устранён: invite URL, web/bot runtime config и установленный token теперь согласованы на `volleytimeby_bot`; deploy guard блокирует повторное несовпадение до формирования или загрузки production env.

Остаются открытыми:

- [ ] [ручной Telegram QA](../qa/telegram-miniapp-checklist.md) (Task 8.8.11);
- [ ] BotFather/Mini App/deeplink/initData acceptance на реальном клиенте;
- [ ] S3 upload/retention/S3 restore и внешний Sentry/UptimeRobot monitoring;
- [ ] прямой webhook ingress до исправления IPv4-маршрута провайдера (polling остаётся рабочим fallback);
- [ ] неделя реальных тренировок только через Volley Time (R0 DoD).

Статус: **`v0.1.5` остаётся последним опубликованным tag/Release; R0.6/`v0.1.6` кандидат `64f1850` работает в production, но 9.8.10 требует offline-runtime fix/redeploy, а релиз — реального Telegram QA и пилота. Полный R0/MVP acceptance дополнительно требует monitoring/S3 и недельного pilot gate.**

## Claude Design reference

Claude Design export используется как reference интерфейсов. Он содержит как MVP, так и будущие screens (Credits, Contributions, Reports, Root Admin, Phase 10+). Release review сравнивает только элементы/flows, принадлежащие R0; будущие screens не считаются пропусками MVP.

## Следующие шаги

1. Выполнить реальный Telegram QA по R0 Task 8.7.2 (hardening-checklist 8.8.11 используется как расширенный сценарий).
2. Проверить BotFather Menu Button, Mini App initData login и event deeplink на реальном клиенте.
3. Подключить Sentry/UptimeRobot и проверить реальные alerts.
4. Перенести release backup в S3, настроить retention и провести S3-based restore test.
5. Провести неделю реальных тренировок только через Volley Time и после этого подтвердить R0 MVP.
