---
id: '20.1.2'
phase: '20'
epic: '20.1'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-05'
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, DB]
depends_on: ['19.2.1', '19.2.2']
supersedes: []
decisions: ['D-03', 'D-14']
estimated_hours: '16-32'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-05-multi-seat-booking.md'
  screens: ['3-miniapp-player/03-screen.png', '4-cabinet/04-screen.png']
tags: [reference-v3]
---

# Task 20.1.2: Запись на несколько мест (`P-05`)

## Цель

Игрок занимает до `maxSeats` мест в одной записи.

## Контекст

- Спецификация референса: [P-05 · Запись на несколько мест](../design/reference-v3/specs/01-platform/P-05-multi-seat-booking.md); макет: 3 Mini App → событие → выбор мест; 4 Кабинет → карточка события → состав.
- **Как есть (main `e68acf2`):** Одна запись = одно место; конкуренция защищена блокировкой события (5.3.5, 5.13.7); лист ожидания — статус `waitlisted` с автопродвижением (5.6.2).
- **Дельта до референса:** Поле мест в записи, ограничение `maxSeats` и свободными местами, частичная запись в основу и очередь с явным выбором, частичная отмена, «+N» в составе; счётчики «мест занято» и «игроков» раздельно.
- Решения владельца (2026-10-12): [D-03](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-03) — место из очереди предлагается первому с TTL 30 мин через планировщик, затем следующему; без планировщика — прежнее автопродвижение.
- Решения владельца (2026-10-13): [D-14](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-14) — при отмене игроком оплаченные места автоматически не возвращаются (R0.7 6.8.6); платёж остаётся `succeeded`, возврат — действие организатора.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Из ревью 20.1.1 (Minor):**
  - `readEventPriceQuote` (`packages/core/src/events/pricing-read-model.ts`) — перевести подсчёт занятых мест на `SUM(seats)` и места игрока на `bookings.seats`.
  - `eventPricingService.settle` — передавать `seats` записи в `allocateSplitAmount` (деление по единицам-местам уже реализовано), `pricing_participant_count` = сумма мест.
  - Не сохранять `total` fixed (цена × места — до 10 × максимум int4) в колонку `integer`: сумма может превысить int4; платёж — по месту (ADR).

**Общий функционал с другими интерфейсами:**

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [M-05 → 19.1.2](19-1-2-booking-statuses.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-05 → 20.5.6](20-5-6-event-card.md), [P-04 → 20.3.1](20-3-1-event-jobs.md). [Подробнее](../design/reference-v3/specs/links.md#booking)

## Что должно быть сделано

1. Выбор числа мест при записи, ограничение `maxSeats` и свободными местами
2. Если мест не хватает: часть в основу, часть в очередь — с явным выбором игрока; освободившиеся места предлагаются очереди по D-03
3. Частичная отмена мест
4. Отображение «+N» в составе
5. Данные и API: POST /events/{id}/bookings {seats}; PATCH /bookings/{id} {seats}.
6. Денежная модель по [ADR v3 · Денежная модель нескольких мест](../architecture/ADR-v3-domain.md#денежная-модель-нескольких-мест): один платёж на место; воплощение записи (`bookings.incarnation`, `payments.booking_incarnation`) и живые платежи; статус `confirmed` только когда все живые платежи мест `succeeded`; подтверждение и отклонение оплаты — одной операцией над записью (отклонение снимает только неоплаченные места, без оплаченных — отменяет запись); снятие одного места — через PATCH seats. Перевести на живые платежи записи: `paymentService.confirm`/`cancel` (guard 6.8.5), `listPending`/`notifyOrganizersAboutPending` (группировка по записи), уведомления `payment_confirmed`/`payment_rejected` (одно на операцию), `bookingService.cancel` (отмена всех неоплаченных мест; оплаченные места при отмене и частичной отмене не возвращаются автоматически, D-14: платёж остаётся `succeeded` и отсоединяется через `payments.seat_released_at`, при частичной отмене первым освобождается самый поздний оплаченный; в истории и составе — «оплачено, место освобождено»; возврат — только операцией организатора), `events.cancel` (выборка R0.7: fixed — `succeeded`-живые платежи неотменённых записей, освобождённые места не возвращаются; split — дополнительно `succeeded`-платежи текущего воплощения с `seat_released_at` у записей с `allocated_amount IS NOT NULL`), историю платежей и дашборд; backfill `seat_released_at` — `COALESCE(cancelled_at, updated_at)` для отменённых записей и `COALESCE(confirmed_at, created_at)` для оплаченных платежей прошлых воплощений.
7. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Конкурентные записи не превышают лимит мест (блокировка/транзакция)
- ✅ Освобождённые места уходят первым в очереди
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Скриншоты: [3-miniapp-player/03-screen.png](../design/reference-v3/screenshots/3-miniapp-player/03-screen.png), [4-cabinet/04-screen.png](../design/reference-v3/screenshots/4-cabinet/04-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`, `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Меняет модель данных: схема и контракт по ADR [19.2.1](19-2-1-domain-model.md) до UI; миграция forward-compatible (deploy runbook).

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
