---
id: '19.1.2'
phase: '19'
epic: '19.1'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-05'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.1.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-05-booking-statuses.md'
  screens: ['1-brand']
tags: [reference-v3]
---

# Task 19.1.2: Статусная модель: участие, событие, места (`M-05`)

## Цель

Одна логика цвета и текста статусов на всех экранах.

## Контекст

- Спецификация референса: [M-05 · Статусы записи](../design/reference-v3/specs/02-mini-app/M-05-booking-statuses.md); макет: 1 Brand and System → Статусная модель.
- **Как есть (main `e68acf2`):** Чипы статусов есть в Mini App и кабинете (8.10.7 «полный статус события»), логика частично дублируется по экранам.
- **Дельта до референса:** Три оси никогда не смешиваются: «Моё участие» (синий чип словом: «Иду», «В очереди · N-й»), «Событие» (нейтральный серый: «Запись закрыта», «Прошла», «Отменена»), «Места» (цифра + шкала, цвет на шкале по `meterTint`, на hero — `meterTintOnDark`). Оплата — отдельная ось (amber/grass). «Пересечение» (amber) для общего календаря.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05 → 20.1.2](20-1-2-multi-seat-booking.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#booking)

## Что должно быть сделано

1. Статус игрока: «Иду» (зелёный), «В очереди · N-й»
2. Состояние события: «есть места», «мест нет», «закрыто» (нейтральные)
3. «Закрыто · вы идёте» остаётся зелёным
4. «Пересечение» (янтарный) для общего календаря
5. Один набор Vue-компонентов и функций (`participationOf`, `eventStateOf`, `meterTint`, `SeatsMini`) в `apps/web` для Mini App и кабинета
6. Человеческие подписи вместо enum; согласование числа «1 ждёт / 2 ждут»
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Статус игрока и заполненность события не используют один цвет
- ✅ Компонент один для Mini App и кабинета
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [1-brand](../design/reference-v3/screenshots/1-brand) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/brand.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/styles.css`, `docs/design/reference-v3/handoff/brand-ideas.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не менять серверные статусы — только представление
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
