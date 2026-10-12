---
id: '20.6.1'
phase: '20'
epic: '20.6'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-17'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE, BACK]
depends_on: ['20.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-17-public-event-pages.md'
  screens: ['5-public']
tags: [reference-v3]
---

# Task 20.6.1: Публичная страница события (`P-17`)

## Цель

Событие по ссылке для тех, кто ещё не в Mini App.

## Контекст

- Спецификация референса: [P-17 · Публичные страницы события](../design/reference-v3/specs/01-platform/P-17-public-event-pages.md); макет: 5 Public Pages.
- **Как есть (main `e68acf2`):** Публичной страницы события нет (`organizations.publicPageEnabled` без маршрута).
- **Дельта до референса:** `GET /public/events/{slug}` без авторизации, три режима (fixed / split-прогноз / закрыто), CTA «Записаться через Telegram».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03 → 20.1.1](20-1-1-pricing.md), [M-07 → 20.4.6](20-4-6-split-price-event.md), [W-04 → 20.5.5](20-5-5-event-create.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#split)

## Что должно быть сделано

1. Вкладки по типу оплаты: фиксированная / сбор суммой
2. Кнопка записи ведёт в Mini App
3. Данные и API: GET /public/events/{slug}.
4. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Цена совпадает с P-03
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [5-public](../design/reference-v3/screenshots/5-public) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-public.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не раскрывать персональные данные участников без согласия: только счётчики и инициалы, если иное не решено владельцем
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
