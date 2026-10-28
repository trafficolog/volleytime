---
id: '21.3.1'
phase: '21'
epic: '21.3'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS]
depends_on:
  [
    '21.1.1',
    '21.1.2',
    '21.1.3',
    '21.1.4',
    '21.1.5',
    '21.1.6',
    '21.1.7',
    '21.1.8',
    '21.2.1',
    '21.2.2',
    '21.2.3',
    '21.2.4',
    '21.2.5',
    '21.2.6',
    '21.2.7',
    '21.2.8',
    '21.2.9',
    '21.2.10',
    '21.2.11',
    '21.2.12',
    '21.2.13',
    '21.2.14',
    '21.2.15',
    '21.2.16',
    '21.2.17',
    '21.2.18',
    '21.2.19',
    '20.7.1',
  ]
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 21.3.1: Релиз v0.3.0: сквозная QA, выкладка и приёмка MVP организатора

## Цель

Принять v0.3.0 — MVP Mini App и кабинета организатора по референсу.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates, отчёт 19.0.2 по всем экранам Mini App и кабинета
2. Telegram QA на двух аккаунтах
3. Promote, backup, smoke, тег v0.3.0
4. Сборы (21.2.4, ADR v3 правило совместимости 4, по образцу 20.7.1 п. 6–7): провести `COLLECTIONS_ENABLED` в `scripts/render-production-env.mjs` (список `RELEASE_FLAGS`; только точное `true`, иначе `false`, контрактный тест как у `EVENT_MULTI_SEAT_ENABLED`) и в `deploy.yml` («Prepare production env», repository variable); diff workflow смотрит владелец до merge; выкладка со выключенными сборами.
5. Сборы, до Promote: preflight миграции `0032_collections` — `SELECT count(*) FROM payments WHERE booking_id IS NOT NULL AND subscription_id IS NOT NULL` = 0 (иначе новый `CHECK payments_single_target` уронит миграцию; координатор выполнил запрос read-only на production 2026-10-28 — 0, повторить перед Promote и записать в evidence).
6. Сборы, на кандидате: оба образа (web, bot) несут `org.volleytime.collections="1"`; guard отката приложения (`scripts/verify-split-rollback.sh`) отказывает образу без метки, пока есть ожидающие взносы (`SELECT EXISTS (SELECT 1 FROM payments WHERE collection_id IS NOT NULL AND status = 'pending')`), и пропускает при подтверждённых/отклонённых/возвращённых — evidence CI fake-shell и real-PostgreSQL guard, метки образов в evidence выкладки.
7. Сборы: включить `COLLECTIONS_ENABLED=true` только после приёмки релиза владельцем, отдельным релизным коммитом с подтверждением владельца (как флаги v0.2.0).

## Критерии приёмки

- ✅ Все экраны `3-miniapp-*` и `4-cabinet` покрыты задачами done или явно отложены
- ✅ Production health = release SHA
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
