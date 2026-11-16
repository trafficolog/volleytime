---
id: '21.5.10'
phase: '21'
epic: '21.5'
status: done
release: 'v0.3.2'
sync_state: synced
last_reviewed: 2026-11-17
status_note: 'Закрыта 2026-11-17: PR #293 смёржен 2026-11-16 (head bac664e4, merge 2e3dfe23), все проверки PR зелёные; выкладка — в составе v0.3.2 (21.4.21). Аддитивные поля `priceForecast` и `myShare` во всех ответах с `pricing` (events, events/{id}, bookings/my, dashboard myBookings/hero/upcoming); паритет и IDOR — `apps/web/server/__tests__/pricing-api-fields.integration.test.ts`. Временно около 3 лишних запросов на событие в списках и dashboard до 21.5.9 (принято).'
ref_id: ''
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [FULLSTACK, QA]
depends_on: ['21.4.8', '21.2.18', '21.1.8', '21.4.20']
supersedes: []
decisions:
  [
    'Перенос 21.5.9 в v0.3.2 (журнал решений, 2026-11-11)',
    'OQ-8: удалить readEventPricing и проекцию pricing (журнал решений, 2026-10-28)',
  ]
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3, api, money]
---

# Task 21.5.10: Недостающие поля v3 API для удаления проекции `pricing`

## Цель

Добавить в ответы v3 API поля, у которых сейчас нет замены в `quote`/`seatPayments`, чтобы [21.5.9](21-5-9-legacy-event-pricing-projection.md) могла удалить `readEventPricing` и проекцию `pricing` как чистое удаление, не изменив ни одной денежной цифры на экранах.

## Контекст

- Запись журнала решений 2026-11-11 ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), «Перенос 21.5.9 в v0.3.2»): у части полей `pricing` нет замены; сначала отдельная карточка на недостающие поля API (Opus), затем 21.5.9. OQ-8 (2026-10-28) в силе.
- **Деньги:** правило ORCHESTRATION №1 — реализация и ревью `claude-opus-5-5`, `review_gate: opus+tests`, тесты граничных случаев и гонок. Расчёт долей, округление копеек (D-01) и статусы оплаты не меняются.
- Инвентаризация потребителей поля `pricing` (выполнена 2026-11-16):

  | field               | consumers                                                                                                                                                | replacement                                  |
  | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
  | mode/targetAmount   | 4 routes + client                                                                                                                                        | yes (event row, quote.mode)                  |
  | minAmount/maxAmount | organizer-miniapp.ts:226, event-row.ts, EventCard.vue, EventPricingPanel.vue, event-pricing-label.ts                                                     | partly (players only via priceQuote.perSeat) |
  | basis               | EventPricingPanel.vue:55, event-pricing-label.ts:28-44, PlayerBookingRow.vue:74, PlayerHomeBento.vue:52, EventCard.vue:109, organizer-miniapp.ts:191,226 | no for current vs capacity                   |
  | participantCount    | EventPricingPanel.vue:57                                                                                                                                 | no                                           |
  | settledAt           | organizer-miniapp.ts:191                                                                                                                                 | yes (pricingSettledAt)                       |
  | myAllocatedAmount   | bookings.vue, player-event.ts, player-booking-payment.ts, event-pricing-label.ts, event index.vue:321                                                    | partly                                       |
  | myPaymentStatus     | event-pricing-label.ts:21,49-71, event index.vue:415                                                                                                     | no                                           |

- Причина остановки 21.5.9: `quote` считает долю игрока иначе (только активные записи плюс свои места), чем `pricing` (ёмкость или текущий состав); менеджеры получают `priceQuote: null`.

## Что должно быть сделано

Новые поля добавляются рядом с `pricing` (аддитивно); `pricing` и `readEventPricing` не удаляются (это 21.5.9).

1. Статус оплаты игрока в списке событий и в dashboard (`myBookings`, hero, upcoming) — замена с той же семантикой, что `pricing.myPaymentStatus`: `pending`/`succeeded`/`null`, без нового расчёта статусов (решение владельца 2026-11-16). Показ `cancelled`/`refunded` отдельными статусами — карточка [21.5.11](21-5-11-player-payment-cancelled-refunded-status.md).
2. Выделенная доля игрока для неактивных записей (отменённая, `no_show` и т. п.) и вне котировки игрока (`priceQuote`), в тех же ответах.
3. Для панели split организатора: `participantCount`, диапазон прогноза min/max и разница между базисом «текущий состав» и «ёмкость» (сейчас менеджеры получают `priceQuote: null`).
4. Диапазон прогноза split для менеджеров и для событий с фиксированной ценой.
5. Разница прогноза между котировкой игрока (активные записи плюс свои места) и `pricing` (ёмкость или текущий состав): решить и задокументировать в карточке (раздел «Решение по расхождению прогноза») и в ADR при изменении контракта; экраны до и после идентичны. Если для идентичности нужно изменить показываемую цифру, остановиться и вернуть вопрос владельцу.
6. Тесты (RED→GREEN): паритет новых полей с `pricing` на сценариях fixed/split, открытая/закрытая/рассчитанная, несколько мест, переполнение, отмена после оплаты, возврат, округление копеек; IDOR: игрок не видит чужие суммы, организатор видит только свою группу.

## Критерии приёмки

- ✅ Для каждой строки таблицы инвентаризации есть замена в v3 API или решение «замена не нужна» с обоснованием
- ✅ Статус оплаты игрока в новом поле совпадает с `pricing.myPaymentStatus` (`pending`/`succeeded`/`null`), в том числе при платежах только `cancelled`/`refunded` (`null`)
- ✅ Новые поля совпадают с `pricing` по цифрам во всех сценариях паритета; экраны не изменены
- ✅ Решение по расхождению прогноза (п. 5) задокументировано
- ✅ `pricing` в ответах и `readEventPricing` не тронуты (удаляет 21.5.9)
- ✅ Пять gates CODING_STANDARDS на tested revision (интеграционные тесты на PostgreSQL выполнены, не пропущены); ревью `claude-opus-5-5` без Critical/Important, включая тесты граничных случаев и IDOR

## Не делать

- ❌ Не удалять `pricing`, `readEventPricing` и не переводить на новые поля потребителей (это 21.5.9)
- ❌ Не менять формулы долей, округление, `quoteEventPrice` и статусы оплаты
- ❌ Не менять схему БД и миграции
- ❌ Не менять внешний вид экранов и показываемые суммы

## Решение по расхождению прогноза

**Решение (2026-11-16, реализация 21.5.10):** котировка игрока `priceQuote` (`quoteEventPrice`, активные записи плюс свои места) и прогноз экранов остаются **двумя разными источниками**, ни одна формула не меняется. Для экранов, которые сейчас читают `pricing`, добавлены поля с той же семантикой, что и `pricing`:

- `priceForecast` = `{ participantCount, minAmount, maxAmount, basis }` — `readEventPriceForecast` (core), те же ветки, что `readEventPricing`: fixed → цена события и занятые места; settled → снимок `pricing_participant_count`; иначе `previewSplitAmount(target, min(taken, capacity), capacity)` с базисом `current`/`capacity`. Событийное поле без данных игрока: одинаково для игрока и управляющего, для fixed, free и split (закрывает п. 3 и 4: у управляющего `priceQuote: null`, теперь прогноз есть).
- `myShare` = `{ allocatedAmount, paymentStatus } | null` — `readMyEventShare` (core): своя запись `ctx.userId` в группе маршрута в любом статусе (отменённая, `no_show`), тот же подзапрос статуса по живым платежам мест текущего воплощения, что в `pricing`. `null` — у вызывающего нет записи (у `pricing` в этом случае обе подполя `null`).

Доказательство идентичности: тест паритета сравнивает новые поля с `pricing` в каждом из шести мест ответа для игрока и организатора на сценариях fixed, free, абонемент, split capacity/current (несколько мест, округление копеек 10001/3), переполнение после уменьшения вместимости, settled (остаток копейки 3334/3333/3333), отмена и `no_show` после расчёта, платежи pending/succeeded/cancelled/refunded. Экраны не изменены: потребители продолжают читать `pricing` до 21.5.9; при переводе на новые поля цифры совпадают по построению. Контракт `pricing` не меняется — ADR не требуется.

Временная цена (принято ревью PR #293): до 21.5.9 списки (`events`, `bookings/my`) и `dashboard` выполняют около 3 лишних запросов на событие (`readEventPriceForecast` и `readMyEventShare` рядом с `readEventPricing`). 21.5.9 удаляет `readEventPricing` и переводит потребителей на новые поля, а не оставляет третью копию расчёта.

Статус оплаты (п. 1): `myShare.paymentStatus` повторяет `pricing.myPaymentStatus` — `pending`/`succeeded`/`null` (решение владельца 2026-11-16); показ `cancelled`/`refunded` вынесен в [21.5.11](21-5-11-player-payment-cancelled-refunded-status.md).

| field               | replacement (21.5.10)                                                 |
| ------------------- | --------------------------------------------------------------------- |
| mode/targetAmount   | event row `priceMode`/`targetAmount` (уже есть), замена не нужна      |
| minAmount/maxAmount | `priceForecast.minAmount/maxAmount` (игрок и управляющий, все режимы) |
| basis               | `priceForecast.basis` (`fixed`/`current`/`capacity`/`settled`)        |
| participantCount    | `priceForecast.participantCount`                                      |
| settledAt           | event row `pricingSettledAt` (уже есть), замена не нужна              |
| myAllocatedAmount   | `myShare.allocatedAmount` (любой статус записи)                       |
| myPaymentStatus     | `myShare.paymentStatus`                                               |
