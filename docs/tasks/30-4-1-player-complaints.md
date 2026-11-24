---
id: '30.4.1'
phase: '30'
epic: '30.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз назначает владелец.'
ref_id: 'R-10'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK, FE]
depends_on: ['22.1.2', '29.3.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/04-root-admin/R-10-complaints.md'
  screens: []
tags: [reference-v3]
---

# Task 30.4.1: Root Admin: жалобы игроков

## Цель

Очередь обращений игроков и организаторов с действиями поддержки.

## Контекст

- Спецификация референса: [R-10 · Жалобы](../design/reference-v3/specs/04-root-admin/R-10-complaints.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 4b Root Admin → Жалобы.
- **Как есть (main `69a5595`):** жалоб игроков нет; жалобы на страницы групп — 24.1.3.
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Счётчики: новые, в работе, решено за 30 дней
- Фильтр открытые / решённые / все
- Действия: запросить объяснение (48 ч), зафиксировать возврат, предупреждение организации, закрыть без мер

## Критерии приёмки

- ✅ Каждое действие пишется в журнал
- ✅ Стороны получают ответ в бот
- ✅ IDOR- и ролевые тесты на каждый новый эндпоинт
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.
- Права по R-15: решение — Owner, Admin, Moderator; Support — передать модератору.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
