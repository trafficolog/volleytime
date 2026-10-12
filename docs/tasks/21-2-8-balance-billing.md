---
id: '21.2.8'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-12'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['20.2.1']
supersedes: ['7.4.1', '7.4.2', '7.5.1', '7.5.2', '7.6.1', '7.6.2', '7.8.2']
decisions: ['D-10']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-12-balance-billing.md'
  screens: ['4-cabinet/16-screen.png']
tags: [reference-v3]
---

# Task 21.2.8: Баланс событий и оплата в кабинете (`W-12`)

## Цель

Пополнение баланса событий.

## Контекст

- Спецификация референса: [W-12 · Баланс и оплата](../design/reference-v3/specs/03-organizer-web/W-12-balance-billing.md); макет: 4 Кабинет организатора → Баланс и оплата.
- **Как есть (main `e68acf2`):** Нет. Фаза 7 (тарифы, заявки на покупку) не начата.
- **Дельта до референса:** Пакеты, покупка через заявку (без онлайн-оплаты), история, предупреждение о низком балансе; нет слова credits. До v0.4.0 заявку подтверждает root операторской командой из 20.2.1.
- Поглощает карточки (входные материалы, читать перед реализацией): [7.4.1](7-4-1-pricing-tiers-schema.md), [7.4.2](7-4-2-pricing-service.md), [7.5.1](7-5-1-purchase-request-service.md), [7.5.2](7-5-2-purchase-notify-api.md), [7.6.1](7-6-1-credits-balance-history.md), [7.6.2](7-6-2-credits-purchase-ui.md), [7.8.2](7-8-2-pricing-purchase-tests.md).
- Зависит от решений владельца: [D-10](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-10). До решения карточка не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)

## Что должно быть сделано

1. Пакеты
2. Покупка
3. История
4. Предупреждение о низком балансе
5. Проверить остатки слова «credit»
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Нет англоязычных «credits» в интерфейсе
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/16-screen.png](../design/reference-v3/screenshots/4-cabinet/16-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
