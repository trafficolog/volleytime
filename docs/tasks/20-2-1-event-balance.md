---
id: '20.2.1'
phase: '20'
epic: '20.2'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-08'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, DB]
depends_on: ['19.2.1']
supersedes: ['7.1.1', '7.1.2', '7.2.1', '7.3.1', '7.3.2', '7.8.1']
decisions: ['D-09', 'D-10']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-08-event-balance.md'
  screens: ['4-cabinet/16-screen.png']
tags: [reference-v3]
---

# Task 20.2.1: Баланс событий (`P-08`)

## Цель

Предоплаченный баланс организатора: 1 событие = 1 единица.

## Контекст

- Спецификация референса: [P-08 · Баланс событий](../design/reference-v3/specs/01-platform/P-08-event-balance.md); макет: 4 Кабинет → Баланс и оплата; 7 Root Admin → Баланс и тарифы.
- **Как есть (main `e68acf2`):** Не реализовано. Фаза 7 (credits) расписана, но не начата.
- **Дельта до референса:** Журнал операций (append-only), списание при создании события, возврат при отмене по D-09, demo-квота (5 по handoff), порог «баланс заканчивается». Карточки 7.1–7.3 и 7.8.1 — входные материалы.
- Поглощает карточки (входные материалы, читать перед реализацией): [7.1.1](7-1-1-credit-schema.md), [7.1.2](7-1-2-credit-service.md), [7.2.1](7-2-1-demo-grant.md), [7.3.1](7-3-1-credit-spend.md), [7.3.2](7-3-2-credit-refund.md), [7.8.1](7-8-1-credit-tests.md).
- Зависит от решений владельца: [D-09](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-09), [D-10](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-10). До решения карточка не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)

## Что должно быть сделано

1. Списание при создании события
2. Возврат при отмене события до открытия записи
3. Пакеты и покупка
4. История операций с причиной
5. Порог «баланс заканчивается»
6. Операторская команда начисления и подтверждения заявок баланса для root (скрипт с записью автора и причины в журнал) — мост до UI 22.2.2
7. Данные и API: Журнал операций (append-only), баланс как сумма; POST /balance/purchase.
8. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Баланс никогда не уходит в минус
- ✅ Каждое изменение баланса имеет запись в журнале и автора
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [4-cabinet/16-screen.png](../design/reference-v3/screenshots/4-cabinet/16-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Меняет модель данных: схема и контракт по ADR [19.2.1](19-2-1-domain-model.md) до UI; миграция forward-compatible (deploy runbook).

## Не делать

- ❌ Не реализовывать онлайн-оплату баланса (фаза 12)
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
