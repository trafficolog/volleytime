---
id: '21.5.7'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Решение владельца OQ-4 (2026-10-28): удалить scripts/qa/*.pwcode, принимая потерю воспроизводимости старых датированных отчётов QA. Пакет из отчёта 21.5.1: LEG-22.'
ref_id: ''
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [QA]
depends_on: ['21.5.1', '21.3.1']
supersedes: []
decisions: []
estimated_hours: '1-3'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup, qa]
---

# Task 21.5.7: Удаление наследия, сценарии `scripts/qa/*.pwcode`

## Цель

Удалить 10 файлов `scripts/qa/*.pwcode`, которые не запускаются ни скриптом, ни CI и заменены `pnpm qa:visual` (`LEG-22` принятого отчёта [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md)).

## Контекст

- Решение владельца **OQ-4** ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), запись 2026-10-28): удалить; потеря воспроизводимости старых отчётов QA принята.
- Состав: `scripts/qa/global-local-fonts.pwcode`, `landing-post-main.pwcode`, `landing-session-error.pwcode`, `miniapp-invite-actions-reflow.pwcode`, `player-miniapp-auth-merge.pwcode`, `player-miniapp-fidelity.pwcode`, `player-miniapp-group-race.pwcode`, `player-miniapp-network-retry.pwcode`, `player-miniapp-real-screen-matrix.pwcode`, `player-miniapp-switcher-access.pwcode`. Остаются `visual-reference.mjs`, `visual-reference-lib.mjs`, `visual-reference-lib.test.ts`, `visual-reference-map.json`.
- Доказательство неиспользования: `rg -c "pwcode" . --glob '!node_modules' --glob '!legacy/**'` → только датированные отчёты `docs/operations/qa/2026-09-*`, карточки 3.11.8, 8.10.1, 8.10.5, план `docs/superpowers/plans/2026-09-28-global-local-reference-fonts.md`; `package.json` содержит только `qa:visual`; workflows и скрипты `.pwcode` не вызывают.
- Тексты датированных отчётов и карточек остаются как есть. По желанию в каждый отчёт QA, ссылающийся на `.pwcode`, добавляется одна строка: «Сценарии `scripts/qa/*.pwcode` удалены в 21.5.7; код доступен в истории Git».
- Модель: реализация `claude-haiku-5-5` (только удаление файлов и однострочные пометки, без логики), ревью `claude-sonnet-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Повторить `rg` по `pwcode`; если появился потребитель (скрипт, workflow, живой runbook) — исключить файл из пакета.
2. Удалить 10 файлов `.pwcode`; другие файлы `scripts/qa` не трогать.
3. По желанию добавить однострочную пометку в датированные отчёты QA (не менять остальной текст).
4. Проверить `pnpm format:check`, `pnpm test` (тесты `visual-reference-lib.test.ts` зелёные), локальные ссылки документов.
5. Обновить отчёт аудита: статус `LEG-22` — удалено + номер PR.

## Критерии приёмки

- ✅ Удалены только 10 файлов `.pwcode`; `visual-reference.*` и `visual-reference-map.json` на месте
- ✅ `pnpm qa:visual` и `visual-reference-lib.test.ts` не затронуты; пять gates зелёные
- ✅ Тексты отчётов QA не изменены, кроме необязательной однострочной пометки
- ✅ Данные, схема, миграции и workflows не изменены
- ✅ Ревью `claude-sonnet-5-5` без Critical/Important

## Не делать

- ❌ Не удалять ничего, чего нет в принятом отчёте аудита 21.5.1
- ❌ Не переписывать датированные отчёты и карточки
- ❌ Не менять `visual-reference.*`, `qa:visual` и `docs/operations/runbooks/visual-reference-harness.md`
