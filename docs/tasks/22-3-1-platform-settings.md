---
id: '22.3.1'
phase: '22'
epic: '22.3'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-05'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.3.1', '22.1.2']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-05-platform-settings.md'
  screens:
    [
      '4b-root-admin/12-screen.png',
      '4b-root-admin/13-screen.png',
      '4b-root-admin/14-screen.png',
      '4b-root-admin/15-screen.png',
      '4b-root-admin/16-screen.png',
      '4b-root-admin/17-screen.png',
      '4b-root-admin/18-screen.png',
      '4b-root-admin/19-screen.png',
    ]
tags: [reference-v3]
---

# Task 22.3.1: Настройки платформы (`R-05`)

## Цель

Глобальные параметры.

## Контекст

- Спецификация референса: [R-05 · Настройки платформы](../design/reference-v3/specs/04-root-admin/R-05-platform-settings.md); макет: 7 Root Admin → Настройки.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Общие, команда и роли, feature flags, лимиты и квоты, уведомления, биллинг, безопасность, API и вебхуки; изменения в журнал.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11 → 19.3.1](19-3-1-auth-roles.md), [W-16 → 20.5.1](20-5-1-auth.md), [M-01 → 20.4.1](20-4-1-telegram-shell.md), [R-07 → 22.1.2](22-1-2-audit-log.md), [R-03 → 22.2.2](22-2-2-grant-balance.md). [Подробнее](../design/reference-v3/specs/links.md#auth)

## Что должно быть сделано

1. Общие
2. Платежи
3. Уведомления
4. Лимиты
5. Безопасность
6. Интеграции
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Изменения пишутся в журнал
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/12-screen.png](../design/reference-v3/screenshots/4b-root-admin/12-screen.png), [4b-root-admin/13-screen.png](../design/reference-v3/screenshots/4b-root-admin/13-screen.png), [4b-root-admin/14-screen.png](../design/reference-v3/screenshots/4b-root-admin/14-screen.png), [4b-root-admin/15-screen.png](../design/reference-v3/screenshots/4b-root-admin/15-screen.png), [4b-root-admin/16-screen.png](../design/reference-v3/screenshots/4b-root-admin/16-screen.png), [4b-root-admin/17-screen.png](../design/reference-v3/screenshots/4b-root-admin/17-screen.png), [4b-root-admin/18-screen.png](../design/reference-v3/screenshots/4b-root-admin/18-screen.png), [4b-root-admin/19-screen.png](../design/reference-v3/screenshots/4b-root-admin/19-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
