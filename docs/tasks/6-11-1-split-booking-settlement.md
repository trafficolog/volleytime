---
id: '6.11.1'
phase: '6'
epic: '6.11'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-01
status_note: '5.16.1 принята (PR80). Реализация 6.11.1 и пять локальных gates завершены: 141 файл / 999 тестов. Независимое review, exact-head CI и merge ещё не выполнены.'
roles: [BE, QA]
depends_on: ['5.16.1']
tags: [mvp, split, payments, concurrency]
---

# Task 6.11.1: запись и атомарное распределение общей суммы

## Цель

Держать место без предварительного платежа и создать окончательные доли одной транзакцией при ручном закрытии записи.

## Контекст

Общие финансовые правила: [R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md). Existing payment confirm/reject/refund и append-only ledger сохраняют свои гарантии.

## Что должно быть сделано

1. Split book/promotion: только cash/transfer, pending_payment с paymentId=null до settlement; waitlisted не входит в расчёт, абонемент/free/online отклоняются сервером.
2. Manager-only POST events/:id/settle проверяет organization/access и атомарно фиксирует count/time/allocation, payments и closed. До commit не отправлять уведомления.
3. Lock event перед чтением book/rebook/cancel/promotion/target edit/settle; перечитывать status и mode после ожидания. Сохранять согласованный порядок блокировок с платежами.
4. Идемпотентно возвращать существующий settlement без новых платежей, audit или рассылки; полное rollback при любой ошибке внутри транзакции.
5. Запретить PATCH закрытие без settlement, reopen и finished до расчёта, самостоятельную отмену после фиксации. Manager снятие/reject не пересчитывает доли; закрытый waitlist не продвигается. Полная отмена использует существующий refund/cancel.
6. GET/stats/my bookings/roster/manager summary различают unsettled, pending, paid, cancelled/refunded; mine содержит личную долю, roster не выдаёт чужие платежи и не показывает false paid.
7. Manager-only GET события возвращает `pricingPermissions: { canChangePriceMode:boolean; canChangeTargetAmount:boolean; canSettle:boolean }`. Mode permission проверяет ЛЮБУЮ историю booking (cancelled-only/waitlist-only тоже), а не participantCount, и existing role/state policy. Target permission — unsettled split с existing role/state policy; settle permission — active manager и published unsettled split. Capability отдельно ограничивает переход в split; игроку manager projection не выдаётся. Сервер повторно проверяет историю/роль/status под event lock при mutation.

## Критерии приёмки

- RED→GREEN доказывает отсутствие payment/ledger до расчёта; после него N платежей суммарно target, реальные confirm создают income ровно один раз.
- N0/target<N, wrong org/role, invalid methods и попытка обхода PATCH оставляют прежнее состояние.
- Повтор settle после confirm/reject возвращает сохранённый snapshot; allocatedAmount не исчезает при cancelled/refunded.
- Cancel event корректно закрывает как unsettled, так и settled брони, включая возврат succeeded payment ранее снятой split-брони с сохранённой allocatedAmount; нет начислений waitlist или изменения чужой доли.
- Реальный manager GET для cancelled-only/waitlist-only history при taken=0 возвращает canChangePriceMode=false; без history действует role/state policy. Settled блокирует target/settle; published unsettled позволяет active manager settlement. Игрок/foreign org не получают projection, mutation отвергает устаревшие разрешения после новой истории/status под lock. Task 5.16.2 проверяет передачу этого API-контракта в обе формы.
- Fixed/free/subscription flows, локальные PostgreSQL интеграции, пять gates и отдельное review проходят.

## Подсказки

### Локальная проверка 2026-10-01

- RED → GREEN: 6 reservation-тестов и 12 settlement/HTTP-тестов; PostgreSQL rollback при ошибке второго payment insert, идемпотентность после confirm/reject, возврат ранее снятой оплаченной split-брони, history-based permissions и приватность projections.
- Focused regression: 14 файлов / 133 теста; полный `pnpm test`: 141 файл / 999 тестов, 527.34 s.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` проходят; lint содержит 12 существующих предупреждений, build — нефатальные dependency warnings.
- GET события: `event.pricing`, manager-only `event.pricingPermissions` и `event.pricingFinancials`; список событий — `pricing` каждой строки; мои брони — `pricing` в корне каждой брони.
- Новые split-уведомления относятся к 8.11.1. Capability в production не включалась. Независимое review, CI/merge, расширенная матрица гонок 6.11.2 и Telegram/pilot acceptance остаются открытыми.

Существующие eventService/bookingService/paymentService, API permissions и notifier collector. Добавить только необходимые read projections. UI зависит от прав, но сервер является источником разрешений.

## Не делать

Не считать прогноз платежом, не подтверждать split по статусу брони, не рассылать внутри транзакции, не автоматически повышать долги после выхода участника, не переоткрывать settlement.
