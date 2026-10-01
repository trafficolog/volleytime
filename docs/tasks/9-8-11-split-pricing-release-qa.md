---
id: '9.8.11'
phase: '9'
epic: '9.8'
status: todo
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'SDD подготовлена; общая QA, CI, deployment и manual Telegram acceptance ещё не выполнены.'
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
4. Обновить runbook: старый fixed-only образ не является допустимым rollback после появления split-событий; проверять данные и поддержку предыдущего образа до автоматического/manual recovery. Создать проверяемый отказ опасного downgrade без изменения данных.
5. Main→reviewed FF prod→Actions image-bundle: backup до migrations, точные Git/image/runtime SHA, healthy web/bot/DB и external smoke/cleanup, сохранить evidence.
6. Два реальных Telegram-аккаунта: состав, прогноз, waitlist, закрытие, личные суммы/уведомления, confirm/reject, disabled subscription, repeat, light/dark и pilot. Зафиксировать owner acceptance перед tag/Release.

## Критерии приёмки

- Перечисленные реальные проверки подтверждены отдельно; repository tests не подменяют production dump/health/Telegram результаты.
- Dangerous rollback на fixed-only версию при split-данных блокируется; рабочие старые образы/backup сохраняются. Не выполнять DB restore или удаление данных ради rollback.
- Сквозная сумма начислений совпадает с target, ledger меняется только от настоящих подтверждений/возвратов.
- До ручной приёмки v0.1.7 остаётся кандидатом; tags не переписываются. CI/docs state честно показывает открытые пункты.

## Подсказки

Следовать существующему image-bundle runbook и дополнительной split compatibility проверке; реальный Telegram QA проводится после полного pilot deploy по ранее принятому решению пользователя.

## Не делать

Не делать server-side git pull/build, force-push prod, prune старых образов/backup, publish tag по одному pnpm test или автоматический опасный rollback на R0.6 с split-данными.
