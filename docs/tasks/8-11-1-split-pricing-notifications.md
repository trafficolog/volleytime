---
id: '8.11.1'
phase: '8'
epic: '8.11'
status: done
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: 'Split reservation/promotion, персональные доли и одна сводка каждому активному manager приняты после RED 7 → GREEN 21, regression52, пяти gates (142 файла / 1010 тестов), independent spec/quality review без Critical/Important и CI36836087098 all4SUCCESS на3211392. PR82 проводит интеграцию; финальный documentation-head CI проверяется до merge. Реальная Telegram acceptance остаётся в9.8.11; production не менялся.'
roles: [BE, BOT, QA]
depends_on: ['6.11.1']
tags: [mvp, split, telegram, notifications]
---

# Task 8.11.1: уведомления о записи и итоговой доле

## Цель

Игрок получает подтверждение занятого места и затем точную сумму после закрытия, организатор — одну сводку распределения.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md). Использовать действующий polling/transport и валидную идентичность рабочего бота, без переключения webhook.

## Что должно быть сделано

1. До settlement render для book/promotion сообщает о месте и будущей сумме, не «Бесплатно»/не требование оплатить прогноз.
2. После успешного commit уведомить каждого включённого игрока о его allocatedAmount и методе с действующим event deep link.
3. Manager получает одну сводку; N созданных платежей не порождают N дублирующих сообщений расчёта. Обычные confirm/reject/cancel продолжают уведомлять как сейчас.
4. Повтор settle не рассылает повторно; ошибка после commit не отменяет реальные платежи. HTML escaping и TZ/currency соблюдаются.

## Критерии приёмки

- RED→GREEN шаблонов и transaction collector: персональные amounts различаются только по распределённым копейкам, waiter/отменённый не получают долг.
- Rollback не dispatch'ит рассылку, repeat не добавляет collector items, failed transport оставляет завершённый расчёт доступным через API.
- Фиксированные уведомления проходят regression, пять gates и review зелёные. Реальная доставка подтверждается в 9.8.11 отдельно.

## Подсказки

### Локальная проверка 2026-10-01

- Focused RED: 7 ожидаемых падений новых шаблонов и отсутствующих collector entries; GREEN: 2 файла / 21 тест.
- Реальная PostgreSQL интеграция проверяет initial book/rebook/promotion без ложной бесплатной записи/предварительной оплаты, точные 3334/3333/3333, одну manager summary и отсутствие обычных payment notifications при settlement; waiter/отменённый исключены.
- Rollback внешней транзакции через действующий `withNotifications` даёт ноль отправок/платежей/allocations. Повтор после confirm/reject не добавляет notifications. Ошибка всех четырёх transport attempts оставляет closed settlement, платежи и реальный GET с личной долей доступными.
- Первый полный suite выявил три прежних interim-ожидания пустого коллектора в pricing-validation. Они заменены на explicit `split_booking_reserved` + рендер без «Бесплатно»/требования оплатить/confirmed wording; проверки pending/null payment/null allocation и реального lock wait сохранены. Affected focused: 3 файла / 52 теста PASS.
- Первый typecheck выявил test-only TS6059 из-за static imports web harness/notify вне core rootDir. Реальные модули загружаются runtime URL imports, как маршруты в harness; tsconfig/product boundaries не расширялись. Итоговый typecheck 6/6 PASS.
- Пять финальных gates PASS: format, lint (0 errors / 12 прежних warnings), typecheck 6/6, полный test 142 файла / 1010 тестов (479.52 s), build 2/2. Build содержит нефатальные dependency deprecation/annotation warnings.
- Доставка проверялась recorder/failing transport, а не настоящим Telegram. Independent review, exact-head CI/merge, controlled deploy и Telegram/pilot acceptance ещё не выполнены.

Переиспользовать notifier/templates/collect/service и реальные Mini App URLs. Сводка распределения и уведомление реального поступления — разные события.

## Не делать

Не обещать guaranteed delivery, не добавлять outbox/scheduler/автоматические напоминания или фиктивное «доставлено» из unit tests.

## Проверка реализации, 2026-10-01

[PR #82](https://github.com/trafficolog/volleytime/pull/82), product SHA `321139290e6771441c50905d55020001aabbaf2a`, [CI 36836087098](https://github.com/trafficolog/volleytime/actions/runs/36836087098): четыре jobs SUCCESS, включая real runner image build/export/import. Independent task review: spec compliant, quality Approved, без Critical/Important. Формат/lint/typecheck/test/build прошли; 12 прежних lint warnings и dependency build notices явно сохранены как nonblocking tooling follow-up.

Post-commit collector и реальная PostgreSQL/API проверены локально: exact3334/3333/3333, одна manager summary, waiter/cancelled без начисления, rollback без dispatch, repeat после confirm/reject без дублей, transport failure не отменяет committed payments/GET. Первоначальный TS6059 исправлен только runtime test imports; три устаревших ожидания пустого коллектора заменены на required reservation message с сохранением money/state/lock assertions. Никакая реальная Telegram доставка, production выкладка или pilot acceptance этими тестами не подтверждается.
