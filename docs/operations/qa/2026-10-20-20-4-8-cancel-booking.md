# QA 20.4.8 · Отмена записи в Mini App (M-09)

Дата: 2026-10-20. Карточка: [20.4.8](../../tasks/20-4-8-cancel-booking.md). Ветка `trafficolog/feat/20.4.8-cancel-booking`, перебазирована на `origin/main` (bf2fe73, после #169/#172 — 20.4.11).

## Что проверено

- Политика группы (D-02): кнопка отмены скрыта, если снимок `events.cancellation_allowed = false`; на «Моих записях» — та же проверка (`canCancelPlayerBooking`). Серверное правило не менялось (`bookingService.cancel`, `changeSeats`).
- «Отменить можно до …» показывается рядом с записью, пока отмена открыта.
- После дедлайна или при запрете политикой кнопка заменяется пояснением (`noCancelExplanation`).
- Частичная отмена мест: степпер «Отменить часть мест», `PATCH …/bookings/{id} {seats}`; подтверждение называет снимаемое и остающееся число мест.
- D-14: подтверждение отмены и частичной отмены при оплате наличными или переводом содержит «Оплаченные места освободятся без возврата денег: возврат — отдельное действие организатора.». Текст совпадает с ботом (`CANCEL_QUESTION`) и со снятием у организатора (`removeBookingText`). После успешной отмены та же фраза показывается на экране (до перезагрузки).
- Ошибка `booking.cancellation_not_allowed`: русское сообщение в `api-error.ts`, код в `staleEventRejections`.

## Визуальная сверка (харнесс 19.0.2): выполнена

- Стенд: собственный PostgreSQL 16 `vt-pg-20-4-8`, база `volleytime_visual`, миграции, `pnpm db:seed:demo`, `nuxt dev` на `http://127.0.0.1:3491` с тестовым токеном бота `111111:visual-harness-test`. Данные: игрок «Соня» (демо-пользователь).
- Сценарий в стенде (правки только в локальной базе, на сиде не закоммичено):
  - «Открытая игра» (опубликована, `cancellation_deadline_hours = 6`, политика разрешает): активная запись «Соня», подтверждена, наличные, 3 места → «Вы записаны на 3 места», кнопка «Отменить запись», «Отменить можно до пт, 23 окт., 13:30», степпер частичной отмены;
  - «Основа» (ближайшая опубликованная, `cancellation_allowed = false`): активная запись → кнопки нет, пояснение «Самостоятельная отмена недоступна — напишите организатору».
- Команда: `pnpm qa:visual --base http://127.0.0.1:3491 --routes player-event-cancel-partial,player-event --themes light,dark --out output/visual`. Все четыре снимка `ok`.
- В карту харнесса `scripts/qa/visual-reference-map.json` добавлен экран `player-event-cancel-partial` (полная страница).
- Артефакты (не коммитятся):
  - `output/visual/20261020-162607/captures/player-event-cancel-partial.light.png`
  - `output/visual/20261020-162607/captures/player-event-cancel-partial.dark.png`
  - `output/visual/20261020-162607/captures/player-event.light.png`
  - `output/visual/20261020-162607/captures/player-event.dark.png`
  - `output/visual/20261020-162607/report.html`
- Сверка с референсом (глазами, `docs/design/reference-v3/screenshots/3-miniapp-player/02-screen.png`): шапка, карточка события, состав и блок записи совпадают по структуре. Расхождения: (1) в референсе под записью одна кнопка «Отменить запись» с подписью «на абонемент» (возврат занятия), в приложении подписи нет; (2) степпер частичной отмены в референсе не показан (отдельного экрана нет, состояние собрано из атомов v3 по карточке 20.4.8). Оба зафиксированы как Minor; решение владельца не запрошено. Pixel diff не запускался (ориентир, не gate).
- Не снималось харнессом: нативное подтверждение `confirm()` с текстом D-14 и пояснение после успешной отмены: харнесс не подтверждает диалоги и не выполняет отмену. Текст подтверждения и пояснения проверяется интерактивными тестами (`event-consumer.interaction.test.ts`, `player-booking-cancel.test.ts`).

## Автоматические проверки

- Unit: `apps/web/app/**` 119 файлов, 1171 тест; `packages/shared`, `apps/bot`, `scripts/qa` и `apps/web/server` без deploy/GHCR-контрактов — зелёные.
- Integration с локальным PostgreSQL 16: `packages/core/src/bookings` и `packages/db` (181), `apps/web/server/__tests__`, `events/service`, `events/public-event`, `payments`, `series` (502) — зелёные.

## Известные ограничения

- «Оплачено, место освобождено» в истории игрока не показано. Follow-up в карточке 20.4.8: нужен API игрока с `payments.seat_released_at` (список «Мои записи» отдаёт отменённые записи только для split).
- Признак «оплачено» на клиенте приблизительный: по способу оплаты (наличные или перевод), а не по статусу платежа. Текст подтверждения может появиться и для неоплаченной записи; бот показывает ту же фразу всегда.
- Пояснение после отмены живёт до перезагрузки страницы.
- Клиентская проекция «Отменить можно» повторяет расчёт срока (`projectPlayerEvent`); окончательное решение за сервером (422).

## Gates (rebased head, см. PR)

- `pnpm format:check`: зелёный.
- `pnpm lint`: 0 ошибок, 26 предупреждений вне изменённых файлов.
- `pnpm typecheck`: зелёный. `pnpm build`: зелёный.
- Unit: см. выше. Падают только Windows-only контракты: `deploy-image-bundle-contract.test.ts` (GNU tar не понимает путь `C:`) и `ghcr-manual-deploy-contract.test.ts` (POSIX-скрипты, таймауты).
- Integration: см. выше. Не проверены на Windows: `packages/core/src/events/split-rollback-races.integration.test.ts` и `split-rollback-guard` (зависят от docker/shell; падают или зависают).
