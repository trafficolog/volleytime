---
id: '21.2.6'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'W-09'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-09-subscriptions.md'
  screens: ['4-cabinet/07-screen.png', '4-cabinet/08-screen.png']
tags: [reference-v3]
---

# Task 21.2.6: Абонементы в кабинете v3 (`W-09`)

## Цель

Планы абонементов.

## Контекст

- Спецификация референса: [W-09 · Абонементы](../design/reference-v3/specs/03-organizer-web/W-09-subscriptions.md); макет: 4 Кабинет организатора → Абонементы.
- **Как есть (main `e68acf2`):** Планы и переключатель абонементов организации (5.10.2, 5.13.21).
- **Дельта до референса:** Визуал v3, форма «Новый план», предупреждение о последствиях выключения.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-11 → 20.5.7](20-5-7-settings.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)
- **Абонементы** — Выключатель в кабинете скрывает вкладку и продажу в Mini App. С этим связаны: [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [P-02 → 19.2.2](19-2-2-group-settings.md), [P-03 → 20.1.1](20-1-1-pricing.md). [Подробнее](../design/reference-v3/specs/links.md#subs)

## Что должно быть сделано

1. Планы
2. Форма «Новый план»
3. Выключатель абонементов группы и предупреждение о последствиях
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ При выключении раздел скрыт в Mini App
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/07-screen.png](../design/reference-v3/screenshots/4-cabinet/07-screen.png), [4-cabinet/08-screen.png](../design/reference-v3/screenshots/4-cabinet/08-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
