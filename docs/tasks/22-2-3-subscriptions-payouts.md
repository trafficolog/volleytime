---
id: '22.2.3'
phase: '22'
epic: '22.2'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-04'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, FE]
depends_on: ['20.2.1', '22.2.2']
supersedes: []
decisions: ['D-07']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-04-subscriptions-payouts.md'
  screens: ['4b-root-admin/09-screen.png']
tags: [reference-v3]
---

# Task 22.2.3: Подписки и выплаты платформы (`R-04`)

## Цель

Деньги платформы.

## Контекст

- Спецификация референса: [R-04 · Подписки и выплаты](../design/reference-v3/specs/04-root-admin/R-04-subscriptions-payouts.md); макет: 7 Root Admin → Подписки и выплаты.
- **Как есть (main `e68acf2`):** Нет; онлайн-оплаты (фаза 12) нет.
- **Дельта до референса:** Объём по D-07: без платёжного провайдера сверка «до копейки с провайдером» недостижима.
- Решения владельца (2026-10-12): [D-07](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-07) — в v0.4.0 — реестр заявок организаций, ручное подтверждение и выгрузка; выплаты и сверка с провайдером — после фазы 12.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)

## Что должно быть сделано

1. Платежи организаций
2. Выплаты
3. Сверка
4. Возвраты
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Сверка сходится до копейки с платёжным провайдером
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [4b-root-admin/09-screen.png](../design/reference-v3/screenshots/4b-root-admin/09-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
