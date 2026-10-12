---
id: '22.1.1'
phase: '22'
epic: '22.1'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.3.1']
supersedes: ['10.3.1', '10.3.2']
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: ['4b-root-admin/01-screen.png']
tags: [reference-v3]
---

# Task 22.1.1: Root Admin: оболочка и обзор платформы

## Цель

Каркас Root Admin (тёмный сайдбар, бейдж ROOT) и обзор платформы.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Root-страниц нет; флаг `users.isRootAdmin` есть.
- **Дельта до референса:** Новый интерфейс.
- Поглощает карточки (входные материалы, читать перед реализацией): [10.3.1](10-3-1-super-admin-overview.md), [10.3.2](10-3-2-gate-metrics-allowlist.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Оболочка и маршрутизация `/root`, доступ только `isRootAdmin`
2. Обзор: North Star (активные организации за неделю), метрики гипотез Phase 10
3. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Не-root получает 403 на всех `/root` маршрутах и API
- ✅ Совпадение с `4b-root-admin/01`
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4b-root-admin/01-screen.png](../design/reference-v3/screenshots/4b-root-admin/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-admin.jsx`, `docs/design/reference-v3/handoff/screens-admin-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
