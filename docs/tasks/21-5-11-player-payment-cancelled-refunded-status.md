---
id: '21.5.11'
phase: '21'
epic: '21.5'
status: todo
release: 'backlog'
sync_state: synced
last_reviewed: 2026-11-16
status_note: 'Создана 2026-11-16 решением владельца при ревью 21.5.10 (PR #293): 21.5.10 оставляет статус оплаты с семантикой `pricing.myPaymentStatus` (`pending`/`succeeded`/`null`), а показ `cancelled`/`refunded` — эта карточка. Бэклог, релиз не назначен. Не стартовала.'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [FULLSTACK, QA]
depends_on: ['21.5.10']
supersedes: []
decisions: ['Статус оплаты 21.5.10 и показ cancelled/refunded (журнал решений, 2026-11-16)']
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3, money, ui]
---

# Task 21.5.11: Статусы оплаты игрока «отменён» и «возвращён» на экранах

## Цель

Показывать игроку статус оплаты своей записи `cancelled` и `refunded` в списке событий, на главной (dashboard: `myBookings`, hero, upcoming) и на экране события. Сейчас при платежах только `cancelled`/`refunded` статус пустой (`null`).

## Контекст

- Решение владельца 2026-11-16 ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), «Статус оплаты 21.5.10 и показ cancelled/refunded»): [21.5.10](21-5-10-event-pricing-api-fields.md) добавляет `myShare.paymentStatus` с той же семантикой, что `pricing.myPaymentStatus` (`pending`/`succeeded`/`null`); отдельные статусы `cancelled`/`refunded` — эта карточка.
- Тип `EventPricingView.myPaymentStatus` уже допускает `cancelled`/`refunded`, и ветки подписей в `apps/web/app/utils/event-pricing-label.ts` есть, но сервер эти значения не отдаёт.
- «Оплачено, место освобождено» уже отдаёт `seatPayments.releasedPaidSeats` (21.1.8).
- **Деньги:** правило ORCHESTRATION №1 — ревью `claude-opus-5-5` с тестами граничных случаев.
- Это изменение экрана: показываемый статус меняется.

## Что должно быть сделано

1. Определить правило статуса записи по платежам текущего воплощения (приоритет живых `pending`/`succeeded` над `cancelled`/`refunded`; несколько мест) и зафиксировать его в карточке до кода.
2. Отдавать `cancelled`/`refunded` в `myShare.paymentStatus` (после 21.5.9 — единственный источник) только для своей записи вызывающего.
3. Показ в списке событий, dashboard и на экране события; тексты — по существующим подписям.
4. Тесты: статусы pending, succeeded, cancelled, refunded и их сочетания по местам; IDOR (игрок не видит чужой статус).

## Критерии приёмки

- ✅ Игрок видит «отменён»/«возвращён» для своей записи в трёх местах; прочие статусы не изменились
- ✅ Суммы, доли, округление и статусы платежей в БД не изменены
- ✅ Пять gates CODING_STANDARDS; ревью `claude-opus-5-5` без Critical/Important, включая IDOR

## Не делать

- ❌ Не начинать до `done` 21.5.10 и решения владельца о релизе
- ❌ Не менять формулы долей, округление, `quoteEventPrice` и переходы статусов платежей
- ❌ Не менять схему БД и миграции
