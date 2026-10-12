---
id: '24.1.3'
phase: '24'
epic: '24.1'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'R-06'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['24.1.2', '22.1.2']
supersedes: []
decisions: ['D-08']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-06-group-page-moderation.md'
  screens: []
tags: [reference-v3]
---

# Task 24.1.3: Модерация страниц групп (`R-06`)

## Цель

Контроль публичных страниц.

## Контекст

- Спецификация референса: [R-06 · Модерация страниц групп](../design/reference-v3/specs/04-root-admin/R-06-group-page-moderation.md); макет: нет макета — нарисовать.
- **Как есть (main `e68acf2`):** Нет; макета нет.
- **Дельта до референса:** Каталог городов, жалобы, принудительный noindex с причиной.
- Решения владельца (2026-10-12): [D-08](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-08) — макет модерации заказывается в Claude Design до старта 24.1.3; без макета задача не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Страница группы** — Конструктор организатора, рендер и модерация root. С этим связаны: [W-13 → 24.1.1](24-1-1-group-page-builder.md), [W-14 → 24.1.2](24-1-2-group-page-render.md), [P-02 → 19.2.2](19-2-2-group-settings.md). [Подробнее](../design/reference-v3/specs/links.md#seo)

## Что должно быть сделано

1. Каталог городов
2. Жалобы
3. Принудительный noindex

## Критерии приёмки

- ✅ Организатор видит причину скрытия
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
