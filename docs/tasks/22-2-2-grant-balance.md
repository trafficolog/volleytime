---
id: '22.2.2'
phase: '22'
epic: '22.2'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-03'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['20.2.1', '22.1.2']
supersedes: ['7.7.1']
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-03-grant-balance.md'
  screens: ['4b-root-admin/08-screen.png']
tags: [reference-v3]
---

# Task 22.2.2: Выдача баланса организации (`R-03`)

## Цель

Ручное начисление баланса организации.

## Контекст

- Спецификация референса: [R-03 · Выдача баланса](../design/reference-v3/specs/04-root-admin/R-03-grant-balance.md); макет: 7 Root Admin → Выдать.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Выбор организации, количество, обязательная причина, запись в журнал; подтверждение заявок 21.2.8.
- Поглощает карточки (входные материалы, читать перед реализацией): [7.7.1](7-7-1-admin-grant-confirm.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-01 → 20.5.3](20-5-3-cabinet-shell.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)
- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-07 → 22.1.2](22-1-2-audit-log.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Выбор организации
2. Количество и причина
3. Запись в журнал
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Без причины начисление невозможно
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/08-screen.png](../design/reference-v3/screenshots/4b-root-admin/08-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
