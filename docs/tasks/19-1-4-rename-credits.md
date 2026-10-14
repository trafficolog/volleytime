---
id: '19.1.4'
phase: '19'
epic: '19.1'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-14
status_note: 'PR #127 (f6776d2): в интерфейсе слова credit не было; добавлен guard-тест apps/web/app/utils/event-balance-term.test.ts. Ревью standard — merge, CI зелёный. Возможное усиление (по ревью, не обязательно): ловить «кредит» и сканировать apps/web/server.'
ref_id: 'R-08'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, DOCS]
depends_on: ['19.0.3']
supersedes: []
decisions: ['D-10']
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-08-rename-credits.md'
  screens: []
tags: [reference-v3]
---

# Task 19.1.4: Термин «баланс событий» вместо credits (`R-08`)

## Цель

Единый термин «баланс событий».

## Контекст

- Спецификация референса: [R-08 · Переименование credits](../design/reference-v3/specs/04-root-admin/R-08-rename-credits.md); макет: 7 Root Admin; 1 Brand and System.
- **Как есть (main `e68acf2`):** В приложении credits ещё не реализованы; слово встречается в лендинге/документах и макетах кабинета и Root Admin.
- **Дельта до референса:** Единый словарь: «баланс событий», единица — «событие». Применяется во всех новых экранах фаз 20–22.
- Решения владельца (2026-10-12): [D-10](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-10) — «баланс событий» везде, единица — «событие»; тексты макетов с credits заменяются при реализации.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md). [Подробнее](../design/reference-v3/specs/links.md#balance)

## Что должно быть сделано

1. «Credits & тарифы» → «Баланс и тарифы»
2. Выдача баланса
3. Тексты бренд-системы
4. Глоссарий в `docs/DOMAIN.md`
5. Проверка `grep -ri credit apps/web/app` в UI-строках пустая (код и идентификаторы допустимы)

## Критерии приёмки

- ✅ grep по «credit» в интерфейсе пуст
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не переименовывать идентификаторы БД ради текста
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
