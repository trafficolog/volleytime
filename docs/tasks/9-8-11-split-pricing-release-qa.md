---
id: '9.8.11'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'Полный кандидат bbd6f41 принят PR91/exact-head/main CI; Deploy37328474440 остановился pre-VPS из-за missing PostgreSQL test service identity. Локальный env fix9.8.14 имеет отдельные RED/GREEN/gate evidence; scoped review/exact-head/main CI открыты. Controlled deployment и Telegram/pilot/tag остаются открыты; последнее подтверждённое production967aff3.'
roles: [QA, DEVOPS]
depends_on: ['8.11.2', '6.11.2']
tags: [mvp, split, release, production, telegram]
---

# Task 9.8.11: сквозная QA и выпуск split pricing

## Цель

Проверить полный режим fixed/split и контролируемо выпустить R0.7 с отдельной реальной Telegram/pilot приёмкой.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md), [deploy runbook](../operations/runbooks/deploy.md). R0.6 — уже выложенный кандидат; эта задача не закрывает историческую ручную QA автоматически.

## Что должно быть сделано

1. Сверить acceptance всех шести implementation/test cards, review и CI каждого PR; на объединённом дереве выполнить пять gates с PostgreSQL и whole-branch review.
2. Browser visual/functional QA новых форм, управления, игрока и применимых landing-блоков в светлой/тёмной теме, 320/390/1280, keyboard/reflow, API errors/routes.
3. Проверить release capability: runtime split creation включается только для полного кандидата. Исключить продвижение промежуточного main ради части функции.
4. Обновить runbook и оба automatic/manual recovery paths, включая migration/activation/smoke failure: existing image labels/build SHA/data preflight не разрешает downgrade по раннему отсутствию split. Под existing deploy lock захватить точные active web/bot container IDs/images и доказанные IPv4/IPv6 identities общей direct PostgreSQL backend bridge network, остановить все project web/bot writers (duplicate/scaled тоже), проверить отсутствие running writers. Docker stop сам по себе не доказывает завершение PostgreSQL queued transaction: после stop свежим discovery targeted sessions по полному owned address set выполнить bounded drain с подтверждённым backend exit, только затем AUTHORITATIVE schema/split query через existing postgres Compose service. Capture→stop новые соединения также входят в свежий discovery; неизвестная/shared/NAT topology или query error запрещают downgrade. До guard нет Git/manifest/env/image activation mutations; непосредственно перед switch повторить writer/backend absence и удерживать quiescence до old runtime activation. Recovery также захватывает и drains дополнительные current/partial old-activation writers до restart. Нельзя глобально terminate пользователя/БД или unrelated sessions. Краткая пауза касается rollback; новый persisted feature table/global advisory lock не нужен.
5. Query error/несовместимость запрещают downgrade: до stop отказ сохраняет runtime, после stop recovery только captured compatible current containers/images, никогда unsafe old fallback; невозможность safe recovery требует exact-state отчёта/ reviewed roll-forward. После code/local acceptance, свежего specification/code review и exact-head CI merge Task 7 PR в main с карточкой `in_progress`, deployment/manual acceptance открыты. Затем integrated-main пять gates/review/exact-main CI → reviewed FF prod → Actions image-bundle: backup до migrations, точные Git/image/runtime SHA, healthy web/bot/DB и external smoke/cleanup, сохранить evidence. Только финальное live evidence закрывает карточку/релиз.
6. Два реальных Telegram-аккаунта: состав, прогноз, waitlist, закрытие, личные суммы/уведомления, confirm/reject, disabled subscription, repeat, light/dark и pilot. Зафиксировать owner acceptance перед tag/Release.

## Критерии приёмки

### Deploy test-environment recovery checkpoint — 2026-10-05

- Полный candidate `bbd6f41e518f916b14d36180d5e510cf9fadaefc` принят PR91 и [exact-main CI37327727365](https://github.com/trafficolog/volleytime/actions/runs/37327727365), все четыре jobs SUCCESS. [Deploy37328474440](https://github.com/trafficolog/volleytime/actions/runs/37328474440) остановился на Test before deploy: 1310 passed / 6 failed из-за missing exact `POSTGRES_TEST_CONTAINER_ID`; build/deploy skipped, staging нового SHA отсутствует. Controller live checkpoint подтверждает прежние Git/health/phase `967aff312f962196e7347cc0e50f879f25f6dffa`, `smoke-passed` и healthy services. Это pre-VPS failure, а не неудачная активация/rollback.
- [Task9.8.14](./9-8-14-deploy-postgres-test-identity.md) отдельно реализует минимальную передачу Actions service identity в deploy test command с RED→GREEN и frozen local gates, сохраняя failclosed guard/races. Business/schema/UI полного принятого кандидата не меняются; previous QA acceptance сохраняется в своём scope. После independent scoped review и exact-head CI нужны PR/main integration, exact-main CI и reviewed production workflow. Локальные gates не означают deployment acceptance; 9.8.11/release остаются `in_progress`, реальная Telegram/pilot/owner acceptance и tag/Release открыты.

### Authoritative final code/pre-deploy checkpoint — 2026-10-05

- Все шесть feature cards приняты; PR86 rollback, PR87 budgets, PR88 final corrections, PR89 owned-shell fixture и PR90 trailing-route интегрированы. Exact accepted main `003968944c4e5f5f3a48685c2deb316e0e8a014a`, tree `43921551ee01b6ffd7c28db191a350425490802e`; [exact-main CI37294307936](https://github.com/trafficolog/volleytime/actions/runs/37294307936) all4SUCCESS. [Sanitized QA provenance](../operations/qa/2026-10-05-r07-final-code-checkpoint.md) содержит точные PR/head/main/CI identities и closure-map; прежние pending checkpoints ниже исторические.
- Worker заново сравнил literal binary bytes всех 802 tracked paths вне `docs/` с сохранённым original `22c085090420db5012a9610ccbd0a352bdb0d84c`: changed=[]; financial/privacy/fixed/split/rounding и production/test источники идентичны принятому source. Только документация синхронизируется. Final Chrome100% и native200 supplement принят в своём scope: E1 closed, E2 controller-owned functional provenance retained; без нового browser replay и без claims native Telegram delivery.
- Whole-branch I1/M1–M5/M7 закрыты reviewed correction PR88; canonical I2 и отдельный N1 закрыты PR88/PR90; M6 failure-bound закрыт PR89. Task6 Minor1→M4 join/error correction, Minor2→M5 exact ordered ledger pair, Minor3→M9 baseline tooling. Task4M1→M1, Task5 harness/emptycopy→M8/M7, Task7 subprocess→M6. M8 broad harness и M9 wrapper/warnings остаются deferred; 10s polling deadline не ограничивает все awaited DB queries/final joins. Исторические FAILED/diagnostics и ранние12 warnings не удалены; текущие11 warnings раскрываются отдельно.
- После всех documentation edits один freeze и ровно пять отдельных последовательных gates, existing exact PostgreSQL container и только `volleytime_test`; full suite уже содержит deployment contracts и реальные PG races, дополнительный covering run не требуется. Complete logs, binary mapping, source manifest, dynamic3317/output isolation и результаты: target `output/playwright/final-r07-main`, original ignored `final-release-checkpoint-report.md`. Этот report фиксирует фактические результаты после freeze; status metadata не подменяет gate evidence.
- Это только local code/pre-deploy checkpoint. Controller final independent release/integration review и exact final docs-head CI/merge-tree/exact-main CI с runner bundle/capacity остаются отдельными. После merge требуется равенство tested tree/source bytes. До promotion нужны fresh keys/live identity/capacity/phase audit, полный candidate capability, reviewed FF prod, Actions backup-before-migrations/exact runtime SHA/smoke-cleanup; затем real two-account Telegram/pilot/owner acceptance. Task9.8.11/release остаётся `in_progress`, tag/Release отсутствуют.

### Main integration checkpoint — 2026-10-05

- Reviewed correction `6f586aba1965c0fc0b01492aa2b02bdef6e38831` перенесён на main `7e430b4763065c9a455c73409c0995bbf967477a` (approved Task 9.8.13 / PR87). Единственный metadata conflict разрешён сохранением main-identical `ghcr-manual-deploy-contract.test.ts`: бюджет60000ms и принятая per-variant for-loop registration. Исторические ограничения budgets ниже относятся к прежнему checkpoint; на этом base все approved9.8.13 budgets сохраняются без сокращения. Product/test correction sources должны совпадать с reviewed reference, кроме independently approved main timeout metadata; новый product RED для Git replay не требуется, исходный RED/GREEN/re-review сохраняется.
- Перед новым локальным checkpoint требуются пять свежих последовательных gates на frozen source manifest, exact validated PostgreSQL container и отдельной `volleytime_test`; original QA database `volleytime_split_ui_qa` не используется. Task 9.8.12 и 8.11.3 остаются отдельными pending integration. Source reviews/Chrome/native200 evidence полного `22c0850` не доказывают приёмку этого частичного main-based candidate.
- Build safety ruling для отдельного worktree: перед target build свежо проверить listener3317/PID37148 и отсутствие directory/symlink overlap между target `verify-9-8-5-final/volleytime` и original `r06-pilot-ui-fixes/volleytime`, включая `.output`. Original foreground QA разрешено оставаться активным; его process/output/source не менять. Историческое требование3317absence защищает original output и здесь применяется как доказательство изоляции target build. Gates/build выполняются последовательно; resource contention принимается.
- Статус остаётся `in_progress`: scoped independent integration review, exact-head CI, полная integrated-main acceptance, controlled deployment и реальная Telegram/pilot/manual acceptance остаются открытыми. Этот checkpoint не разрешает production promotion, tag или Release.

- Final integrated review fix wave (2026-10-04, base ade78281): устранить I1/I2 и M1–M7 по `.superpowers/sdd/2026-10-01-event-split-pricing/final-wholebranch-review.md` одним scoped изменением с RED→GREEN. I1: реальные organization responses/defaultCurrency проходят оба create parents; currency остаётся server-owned. I2: отдельный mounted event-consumer suite проверяет confirmation lifetime/full-route/latest permission и сохранение busy/result/refusal refresh уже отправленного POST при query/hash. M1–M3/M7: корректная consequence/forecast/rounding/empty copy и persisted settlement time в timezone организации. M4–M6: barrier joins при отказе, deterministic exact ledger pair и bounded cleanup только owned subprocesses, synchronous Docker timeout. M8 broad harness rewrite и M9 baseline tooling/wrapper deferred.
- Сохранить прежний integrated FAILED test log и unchanged focused GHCR diagnostic17.07s. Уточнение прямого решения пользователя2026-10-04: ТОЛЬКО `apps/web/server/utils/ghcr-manual-deploy-contract.test.ts` case `old activation failure restores exact boundary history and captured current only` получает60000ms вместо35000ms. Аналогичный image-bundle case и все остальные budgets неизменны; это локальный test budget, не root-cause repair и не production timeout. После source freeze — пять новых gates с exact authorized PostgreSQL test identity, hashes/logs и fresh separate3317absence перед build; runtime не запускать/останавливать. Independent combined re-review, exact-head CI, targeted Chrome и integrated/live acceptance остаются отдельными checkpoint; task in_progress.

- Перечисленные реальные проверки подтверждены отдельно; repository tests не подменяют production dump/health/Telegram результаты.
- Dangerous rollback на fixed-only версию при split-данных блокируется; рабочие старые образы/backup сохраняются. Не выполнять DB restore или удаление данных ради rollback.
- Повторный recovery сохраняет все additional writer network snapshots неудачных попыток и доказывает drain полного union до любого restart; validator failclosed не отключается Python optimization.
- Review I1: override hostname postgres через ExtraHosts и ambiguous DNS aliases на любых attached networks запрещают guard до stop; нормальные frontend+backend web/bot остаются допустимы. Review I2: реальные PG race tests используют явный exact POSTGRES_TEST_CONTAINER_ID (Actions service ID или настроенный local ID), проверяют database/image/container identity и соответствие configured endpoint реальному transport; arbitrary discovery/skip запрещены.
- По прямому решению пользователя тяжёлые одиночные shell deploy/rollback/recovery проверки получают явный per-test бюджет 35000ms для ограниченной локальной конфигурации; multi-operation 60000ms сохраняется. Production timeouts и assertions не меняются, глобальный Vitest override не используется.
- Детерминированный DB race: container reports stopped, но реальный writer PostgreSQL backend ещё жив/queued — guard не разрешает query/switch до доказанного drain; in-flight split до stop либо commit до authoritative query (old rejected), либо rollback. Позднее capture→stop соединение тоже drained; unrelated PG session выживает. Новый split не commit в guard→old activation window. Shell contracts доказывают stop всех writers/duplicate/scaled, IPv4/IPv6 ownership/topology failclosed, writer/backend recheck, неизменный runtime до stop failure и recovery только captured compatible current runtime после stop query/incompatibility/activation failure. Fake Docker evidence отдельно от реальной PostgreSQL race.
- Отдельные checkpoint: local/code acceptance + свежий review + exact-head CI допускают Task 7 merge, но статус остаётся in_progress с открытыми deploy/manual критериями; exact integrated-main gates/review/CI предшествуют promotion/deploy, финальные Telegram/pilot evidence предшествуют done/tag/Release.
- Сквозная сумма начислений совпадает с target, ledger меняется только от настоящих подтверждений/возвратов.
- До ручной приёмки v0.1.7 остаётся кандидатом; tags не переписываются. CI/docs state честно показывает открытые пункты.

## Подсказки

Следовать существующему image-bundle runbook и дополнительной split compatibility проверке; реальный Telegram QA проводится после полного pilot deploy по ранее принятому решению пользователя.

## Не делать

Не делать server-side git pull/build, force-push prod, prune старых образов/backup, publish tag по одному pnpm test или автоматический опасный rollback на R0.6 с split-данными.
