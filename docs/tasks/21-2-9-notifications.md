---
id: '21.2.9'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-15'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['20.3.2']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-15-notifications.md'
  screens: ['4-cabinet/15-screen.png']
tags: [reference-v3]
---

# Task 21.2.9: Уведомления кабинета (`W-15`)

## Цель

Лента событий для организатора.

## Контекст

- Спецификация референса: [W-15 · Уведомления кабинета](../design/reference-v3/specs/03-organizer-web/W-15-notifications.md); макет: 4 Кабинет организатора → Уведомления.
- **Как есть (main `e68acf2`):** Нет.
- **Дельта до референса:** Лента из 20.3.2, прочитано, переход к объекту.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [M-17 → 25.1.2](25-1-2-self-check.md). [Подробнее](../design/reference-v3/specs/links.md#notify)

## Что должно быть сделано

1. Лента
2. Прочитано
3. Переходы
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Переход ведёт к объекту уведомления
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/15-screen.png](../design/reference-v3/screenshots/4-cabinet/15-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
