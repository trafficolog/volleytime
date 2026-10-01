---
id: '9.8.11'
phase: '9'
epic: '9.8'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'Спецификация и письменный план утверждены пользователем 2026-10-01; реализация/QA/CI/deployment/manual acceptance не начаты. После будущего local checkpoint merge статус in_progress до live evidence.'
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
4. Обновить runbook и оба automatic/manual recovery paths, включая migration/activation/smoke failure: existing image labels/build SHA/data preflight не разрешает downgrade по раннему отсутствию split. Под existing deploy lock захватить точные active web/bot container IDs/images, остановить все project web/bot writers (duplicate/scaled тоже), проверить отсутствие running writers, затем AUTHORITATIVE schema/split query через existing postgres Compose service. Stop завершает/прерывает in-flight транзакции. До guard нет Git/manifest/env/image activation mutations; непосредственно перед switch повторить writer absence и удерживать quiescence до old runtime activation. Краткая пауза касается rollback; новый persisted feature table/global advisory lock не нужен.
5. Query error/несовместимость запрещают downgrade: до stop отказ сохраняет runtime, после stop recovery только captured compatible current containers/images, никогда unsafe old fallback; невозможность safe recovery требует exact-state отчёта/ reviewed roll-forward. После code/local acceptance, свежего specification/code review и exact-head CI merge Task 7 PR в main с карточкой `in_progress`, deployment/manual acceptance открыты. Затем integrated-main пять gates/review/exact-main CI → reviewed FF prod → Actions image-bundle: backup до migrations, точные Git/image/runtime SHA, healthy web/bot/DB и external smoke/cleanup, сохранить evidence. Только финальное live evidence закрывает карточку/релиз.
6. Два реальных Telegram-аккаунта: состав, прогноз, waitlist, закрытие, личные суммы/уведомления, confirm/reject, disabled subscription, repeat, light/dark и pilot. Зафиксировать owner acceptance перед tag/Release.

## Критерии приёмки

- Перечисленные реальные проверки подтверждены отдельно; repository tests не подменяют production dump/health/Telegram результаты.
- Dangerous rollback на fixed-only версию при split-данных блокируется; рабочие старые образы/backup сохраняются. Не выполнять DB restore или удаление данных ради rollback.
- Детерминированный DB race: in-flight split до stop либо commit до authoritative query (old rejected), либо rollback; новый split не commit в guard→old activation window. Shell contracts доказывают stop всех writers/duplicate/scaled, writer recheck, неизменный runtime до stop failure и recovery только captured compatible current runtime после stop query/incompatibility/activation failure. Fake Docker evidence отдельно от реальной PostgreSQL race.
- Отдельные checkpoint: local/code acceptance + свежий review + exact-head CI допускают Task 7 merge, но статус остаётся in_progress с открытыми deploy/manual критериями; exact integrated-main gates/review/CI предшествуют promotion/deploy, финальные Telegram/pilot evidence предшествуют done/tag/Release.
- Сквозная сумма начислений совпадает с target, ledger меняется только от настоящих подтверждений/возвратов.
- До ручной приёмки v0.1.7 остаётся кандидатом; tags не переписываются. CI/docs state честно показывает открытые пункты.

## Подсказки

Следовать существующему image-bundle runbook и дополнительной split compatibility проверке; реальный Telegram QA проводится после полного pilot deploy по ранее принятому решению пользователя.

## Не делать

Не делать server-side git pull/build, force-push prod, prune старых образов/backup, publish tag по одному pnpm test или автоматический опасный rollback на R0.6 с split-данными.
