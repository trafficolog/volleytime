---
id: '21.2.3'
phase: '21'
epic: '21.2'
status: in_progress
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Реализация в PR #194; ждёт ревью Opus и CI. Без миграций. Осознанные отклонения от макета («По игрокам», меню строки, «Долги» шире карточки события, «обновлено») — в docs/operations/qa/2026-10-27-21-2-3-cabinet-cashbox-visual.md. Способ ручной записи и категории Мячи/Судья/Тренер — отдельная карточка v0.3.0 (решение владельца 2026-10-27).'
ref_id: 'W-07'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.2.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-07-cashbox.md'
  screens: ['4-cabinet/09-screen.png', '4-cabinet/10-screen.png']
tags: [reference-v3]
---

# Task 21.2.3: Касса кабинета v3 (`W-07`)

## Цель

Деньги группы.

## Контекст

- Спецификация референса: [W-07 · Касса](../design/reference-v3/specs/03-organizer-web/W-07-cashbox.md); макет: 4 Кабинет организатора → Касса.
- **Как есть (main `e68acf2`):** Касса с поступлениями/расходами и категориями (6.6, 6.10.1).
- **Дельта до референса:** Визуал v3, обязательный комментарий к ручной операции, выгрузка CSV.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Игроки и отчёты** — Одни цифры в кабинете и в Mini App организатора. С этим связаны: [W-06 → 21.2.2](21-2-2-players.md), [W-10 → 21.2.7](21-2-7-reports.md), [M-24 → 21.1.3](21-1-3-org-players-report.md). [Подробнее](../design/reference-v3/specs/links.md#reports)

## Что должно быть сделано

1. Поступления и расходы
2. Ручной ввод
3. Категории
4. Выгрузка
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Ручная операция требует комментарий
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/09-screen.png](../design/reference-v3/screenshots/4-cabinet/09-screen.png), [4-cabinet/10-screen.png](../design/reference-v3/screenshots/4-cabinet/10-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
