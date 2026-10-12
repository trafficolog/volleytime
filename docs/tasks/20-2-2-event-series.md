---
id: '20.2.2'
phase: '20'
epic: '20.2'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-06'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, DB]
depends_on: ['19.2.1', '20.2.1']
supersedes: []
decisions: ['D-04']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-06-event-series.md'
  screens: ['4-cabinet/05-screen.png']
tags: [reference-v3]
---

# Task 20.2.2: Серии событий (`P-06`)

## Цель

Массовое создание событий по правилу повтора.

## Контекст

- Спецификация референса: [P-06 · Серии событий](../design/reference-v3/specs/01-platform/P-06-event-series.md); макет: 4 Кабинет → Создание события → Повтор; 3 Mini App → организатор → создание.
- **Как есть (main `e68acf2`):** Не реализовано: события создаются по одному.
- **Дельта до референса:** Правило повтора (handoff `RecurrenceBlock`: один раз / каждую неделю / раз в 2 недели × дни × срок), предпросмотр, исключения, правка «только это / это и последующие», конфликт зала → черновик, списание баланса за каждое событие по D-04.
- Решения владельца (2026-10-12): [D-04](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-04) — серия создаётся атомарно целиком; баланс списывается за опубликованные, даты сверх баланса — черновики; предпросмотр показывает число публикуемых.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [P-08 → 20.2.1](20-2-1-event-balance.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)
- **Календари и расписание** — Общий календарь игрока, расписание группы и календарь кабинета читают одни события. С этим связаны: [M-10 → 23.2.2](23-2-2-my-calendar.md), [M-11 → 21.1.4](21-1-4-group-schedule.md), [W-03 → 20.5.4](20-5-4-events.md). [Подробнее](../design/reference-v3/specs/links.md#calendar)

## Что должно быть сделано

1. Правило: дни недели, период (месяц, квартал, год, до даты, N раз)
2. Исключения (праздники, отменённые даты)
3. Предпросмотр дат перед созданием
4. Правка «только это» / «это и последующие»
5. Списание баланса за каждое опубликованное событие серии (D-04): серия создаётся целиком, даты сверх баланса — черновики; предпросмотр показывает, сколько будет опубликовано
6. Данные и API: POST /series; GET /series/{id}/preview; PATCH /series/{id}?scope=following.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Создание серии из 52 событий выполняется одной операцией
- ✅ Серия создаётся атомарно целиком: при нехватке баланса опубликованы первые N дат, остальные — черновики; при сбое не создаётся ничего
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [4-cabinet/05-screen.png](../design/reference-v3/screenshots/4-cabinet/05-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx (`RecurrenceBlock`)`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Меняет модель данных: схема и контракт по ADR [19.2.1](19-2-1-domain-model.md) до UI; миграция forward-compatible (deploy runbook).

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
