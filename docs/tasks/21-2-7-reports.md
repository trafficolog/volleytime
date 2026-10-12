---
id: '21.2.7'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Поглощает фазу 14 в объёме макетов.'
ref_id: 'W-10'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE, BACK]
depends_on: ['19.2.1', '21.2.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-10-reports.md'
  screens: ['4-cabinet/13-screen.png', '4-cabinet/14-screen.png']
tags: [reference-v3]
---

# Task 21.2.7: Отчёты и экспорт (`W-10`)

## Цель

Аналитика группы.

## Контекст

- Спецификация референса: [W-10 · Отчёты](../design/reference-v3/specs/03-organizer-web/W-10-reports.md); макет: 4 Кабинет организатора → Отчёты.
- **Как есть (main `e68acf2`):** Отчётов нет. Фаза 14 — скелет.
- **Дельта до референса:** Посещаемость, деньги, заполняемость, период, экспорт; цифры сходятся с кассой.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Игроки и отчёты** — Одни цифры в кабинете и в Mini App организатора. С этим связаны: [W-06 → 21.2.2](21-2-2-players.md), [W-07 → 21.2.3](21-2-3-cashbox.md), [M-24 → 21.1.3](21-1-3-org-players-report.md). [Подробнее](../design/reference-v3/specs/links.md#reports)

## Что должно быть сделано

1. Посещаемость
2. Деньги
3. Заполняемость
4. Период и выгрузка
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Цифры совпадают с кассой
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/13-screen.png](../design/reference-v3/screenshots/4-cabinet/13-screen.png), [4-cabinet/14-screen.png](../design/reference-v3/screenshots/4-cabinet/14-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
