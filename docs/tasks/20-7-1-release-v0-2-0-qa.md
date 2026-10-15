---
id: '20.7.1'
phase: '20'
epic: '20.7'
status: todo
release: 'v0.2.0'
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
    '19.0.2',
    '19.1.1',
    '19.1.2',
    '19.1.3',
    '19.1.4',
    '19.2.1',
    '19.2.2',
    '19.2.3',
    '19.3.1',
    '20.1.1',
    '20.1.2',
    '20.1.3',
    '20.2.1',
    '20.2.2',
    '20.3.1',
    '20.3.2',
    '20.3.3',
    '20.4.1',
    '20.4.2',
    '20.4.3',
    '20.4.4',
    '20.4.5',
    '20.4.6',
    '20.4.7',
    '20.4.8',
    '20.4.9',
    '20.4.10',
    '20.4.11',
    '20.5.1',
    '20.5.2',
    '20.5.3',
    '20.5.4',
    '20.5.5',
    '20.5.6',
    '20.5.7',
    '20.5.8',
    '20.6.1',
    '9.8.17',
  ]
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 20.7.1: Релиз v0.2.0: сквозная QA, выкладка и приёмка

## Цель

Принять v0.2.0: интегрированный main проходит все gates, визуальную сверку с референсом и Telegram QA; выкладка через Promote с backup, smoke и откатом.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Последний принятый релиз — v0.1.7.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates на интегрированном main, отчёт 19.0.2 по всем экранам релиза
2. Telegram QA на двух аккаунтах (Android/Desktop) по чек-листу
3. Продвижение через Promote (9.8.17), backup до миграций, smoke, проверка отката с новыми миграциями
4. Тег v0.2.0 и запись в RELEASES/current-state
5. Баланс событий (20.2.1, ADR v3 правило совместимости 5): провести `EVENT_BALANCE_ENFORCED` в `scripts/render-production-env.mjs` (только точное `true`, иначе `false`, контрактный тест как у `EVENT_SPLIT_PRICING_ENABLED`) и в `deploy.yml` (repository variable); выкладка с выключенным списанием; перед включением выполнить `pnpm db:event-balance reconcile --operator <root email>` (без `--apply`, затем с `--apply` по решению) из migrator-контейнера и разобрать отчёт; включить переменную после выкладки полного релиза; проверить влияние новой переменной на guard `verify-live-rollback-env.sh` (сравнение env живых контейнеров с rollback-набором) и на откат к runtime без баланса
6. Места в записи (20.1.2, ADR v3 правило совместимости 4): провести `EVENT_MULTI_SEAT_ENABLED` в `scripts/render-production-env.mjs` (только точное `true`, иначе `false`, контрактный тест как у `EVENT_SPLIT_PRICING_ENABLED`) и в `deploy.yml` (repository variable); выкладка с выключенной записью на несколько мест; расширить quiescent-guard отката (`scripts/verify-split-rollback.sh`) capability-label образа и запросом «нет данных нескольких мест» `SELECT EXISTS (SELECT 1 FROM bookings WHERE seats > 1 OR waitlist_seats > 0)` для runtime без поддержки мест; включить переменную только после выкладки полного релиза и проверки guard

7. Режим записи по приглашению (20.1.3, ADR v3 правило совместимости 4, [D-06, уточнение 2026-10-15](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-06)): провести `EVENT_INVITE_MODE_ENABLED` в `scripts/render-production-env.mjs` (только точное `true`, иначе `false`, контрактный тест как у `EVENT_SPLIT_PRICING_ENABLED`) и в `deploy.yml` (repository variable); перед Promote проверить `SELECT id FROM organizations WHERE default_join_mode = 'invite'` — 0 строк; выкладка с выключенным режимом; расширить quiescent-guard отката (`scripts/verify-split-rollback.sh`) capability-label образа и запросом для runtime без поддержки режима: `SELECT EXISTS (SELECT 1 FROM events WHERE join_mode = 'invite' AND status NOT IN ('cancelled', 'finished')) OR EXISTS (SELECT 1 FROM invite_links WHERE type = 'event_join' AND NOT is_revoked AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses_count < max_uses))`; включить переменную только после выкладки полного релиза и проверки guard

## Критерии приёмки

- ✅ Все задачи релиза done
- ✅ Отчёт сверки без открытых расхождений уровня Critical/Important
- ✅ Production health = release SHA
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
