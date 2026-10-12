---
id: '24'
status: todo
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Референс v3 Ф4 + лендинг. 5 задач.'
estimated_hours: '36-72'
depends_on: []
---

# Phase 24: Публичные страницы и SEO

**Цель.** SEO-страница группы (конструктор, серверный рендер, модерация) и обновление лендинга до v3.

## Контекст

Можно вести параллельно с фазой 23.

Источник — референс v3 (Ф4 + лендинг), импорт в [docs/design/reference-v3](../design/reference-v3/README.md); перепланирование — [19.0.1](../tasks/19-0-1-reference-v3-replan.md).

## Definition of Done

1. SEO-страница группы с SSR, sitemap и Lighthouse SEO ≥ 95
2. Лендинг v3 без обещаний несуществующих функций
3. v0.5.0 принят (24.1.5)

## Эпики

| ID                                          | Эпик                      | Задач | Часов |
| ------------------------------------------- | ------------------------- | ----: | ----: |
| [24.1](../epics/24-1-group-page-landing.md) | Страница группы и лендинг |     5 | 36-72 |

**Итого:** 1 эпиков, 5 задач, 36-72 ч. Модели реализации: `claude-opus-5-5` — 2, `claude-sonnet-5-5` — 3.

## Технические заметки

### Что НЕ делаем в этой фазе

- ❌ —

### Открытые вопросы

- Решения владельца: [журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md).

## Ссылки

- [ROADMAP.md](../ROADMAP.md)
- [RELEASES.md](../RELEASES.md)
- [ORCHESTRATION.md](../ORCHESTRATION.md)
