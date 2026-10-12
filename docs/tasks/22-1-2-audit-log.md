---
id: '22.1.2'
phase: '22'
epic: '22.1'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-07'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['19.3.1', '22.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-07-audit-log.md'
  screens: ['4b-root-admin/11-screen.png']
tags: [reference-v3]
---

# Task 22.1.2: Журнал действий платформы (`R-07`)

## Цель

Кто, что и когда изменил.

## Контекст

- Спецификация референса: [R-07 · Журнал действий](../design/reference-v3/specs/04-root-admin/R-07-audit-log.md); макет: 7 Root Admin.
- **Как есть (main `e68acf2`):** Аудит организаций (4.6) и страница аудита организатора.
- **Дельта до референса:** Платформенный журнал root-действий, только чтение.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-05 → 22.3.1](22-3-1-platform-settings.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Баланс
2. Тарифы
3. Организации
4. Настройки
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Журнал нельзя изменить из интерфейса
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/11-screen.png](../design/reference-v3/screenshots/4b-root-admin/11-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
