---
id: '30.3.4'
phase: '30'
epic: '30.3'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз v0.6.0 (D-34).'
ref_id: 'W-19'
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['30.1.1', '21.2.7']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-19-report-breakdown.md'
  screens: []
tags: [reference-v3]
---

# Task 30.3.4: Отчёты в разрезе: тренер, зал, тип события

## Цель

Выручка, аренда и заполняемость по тренерам, залам и сериям.

## Контекст

- Спецификация референса: [W-19 · Отчёты в разрезе](../design/reference-v3/specs/03-organizer-web/W-19-report-breakdown.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 4 Кабинет → Отчёты → «В разрезе».
- **Как есть (main `69a5595`):** отчёты кабинета (21.2.7) без разреза по тренеру, залу и типу события.
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Переключатель: по тренерам / залам / сериям
- Колонки: игр, заполняемость, выручка, аренда

## Критерии приёмки

- ✅ Суммы сходятся с итогом месяца
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
