---
id: '20.4.8'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-09'
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.2.2', '20.1.2']
supersedes: []
decisions: ['D-02', 'D-14']
estimated_hours: '2-4'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-09-cancel-booking.md'
  screens: []
tags: [reference-v3]
---

# Task 20.4.8: Отмена записи v3 (`M-09`)

## Цель

Отмена по правилам группы.

## Контекст

- Спецификация референса: [M-09 · Отмена записи](../design/reference-v3/specs/02-mini-app/M-09-cancel-booking.md); макет: 3 Mini App → событие → отмена.
- **Как есть (main `e68acf2`):** Отмена есть, срок — из события (5.13.10).
- **Серверное правило уже есть (19.2.2):** `bookingService.cancel` отклоняет самоотмену игрока, если снимок `events.cancellation_allowed = false` (`booking.cancellation_not_allowed`, 422); организатор отменяет всегда. Срок берётся из снимка `events.cancellation_deadline_hours`. Здесь остаётся только UI и тексты.
- **Дельта до референса:** Политика группы (D-02), «Отменить можно до …», частичная отмена мест, пояснение после дедлайна.
- Решения владельца (2026-10-13): [D-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-14) — при отмене игроком после оплаты деньги автоматически не возвращаются; возврат — действие организатора.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05 → 20.1.2](20-1-2-multi-seat-booking.md), [M-05 → 19.1.2](19-1-2-booking-statuses.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#booking)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02 → 19.2.2](19-2-2-group-settings.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)

## Что должно быть сделано

1. Доступна/недоступна по политике
2. «Отменить можно до …»
3. Частичная отмена мест
4. После отмены записи или мест, за которые оплата уже подтверждена, показать: «Деньги не возвращаются автоматически — свяжитесь с организатором» ([D-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-14)); оплаченное освобождённое место в истории — «оплачено, место освобождено»

- Для ошибки сервера `booking.cancellation_not_allowed` (19.2.2): русское сообщение в `apps/web/app/utils/api-error.ts`, код в `staleEventRejections` (`player-event-action.ts`), кнопка отмены скрыта, если политика события запрещает отмену.

## Критерии приёмки

- ✅ После дедлайна кнопка заменяется пояснением
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Haiku-задача: только вёрстка, тексты и переименования. Если нужна бизнес-логика — остановиться и эскалировать оркестратору.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
