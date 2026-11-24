---
id: '30.4.2'
phase: '30'
epic: '30.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-24
status_note: 'Перепланирование 19.0.5 (референс 2026-11-24). Релиз назначает владелец.'
ref_id: 'M-33'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['30.4.1']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-33-complaint.md'
  screens: []
tags: [reference-v3]
---

# Task 30.4.2: Mini App: жалоба на организатора

## Цель

Игрок может пожаловаться в поддержку платформы, минуя организатора.

## Контекст

- Спецификация референса: [M-33 · Жалоба на организатора](../design/reference-v3/specs/02-mini-app/M-33-complaint.md); обновление референса — [отчёт 2026-11-24](../design/2026-11-24-reference-v3-update.md).
- Макет: 3 Mini App → Профиль → ··· у группы → Пожаловаться на организатора.
- **Как есть (main `69a5595`):** —
- **Дельта до референса:** всё, что в «Что должно быть сделано»; работающее не переписывается.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

**Объём** (по спецификации)

- Причины: деньги не вернули, отмена без предупреждения, грубость, другое
- Ответ в бот за 24 ч

## Критерии приёмки

- ✅ Жалоба появляется в R-10
- ✅ Экраны совпадают с макетом: отчёт харнесса визуальной сверки 19.0.2 или ручной сверки в теле PR
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, токены, доменная логика.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
