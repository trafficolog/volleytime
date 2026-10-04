---
id: '9.8.11'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-04
status_note: 'Final integrated review I1/I2 and scoped M1-M7: combined correction checkpoint, final frozen gates/re-review/exact-head CI/targeted Chrome pending. Human-authorized exact manual GHCR case budget60000ms; historic integrated35000ms timeout retained. M8 broad harness/M9 baseline tooling deferred. Production/Telegram/pilot/tag remain open; build only after fresh3317absence, no automatic runtime changes.'
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
