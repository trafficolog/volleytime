# Event Split Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выпустить R0.7/v0.1.7 с фиксированной ценой или однократным распределением общей суммы события при ручном закрытии записи.

**Architecture:** Аддитивная модель событий/броней, чистое распределение целых копеек и один транзакционный settlement поверх существующих payments/ledger. Общие read models обслуживают Mini App и desktop; уведомления отправляются после commit. Промежуточные PR защищены выключенной capability, production получает только полный кандидат.

**Tech Stack:** TypeScript, Nuxt/Vue, Drizzle/PostgreSQL, Vitest, pnpm, Docker image-bundle, GitHub Actions.

**Spec:** [Утверждённая 2026-10-01 спецификация](../specs/2026-10-01-event-split-pricing-design.md).

**Approval:** Спецификация и этот письменный план утверждены пользователем 2026-10-01. Документационные исправления D1–D3 синхронизируют исполнение; все семь карточек остаются `todo`, продуктовая реализация не начата.

## Global Constraints

- Отдельный R0.7/v0.1.7; открытая Telegram/pilot приёмка R0.6 не закрывается этим планом.
- Одно место на игрока; закрытие только ручное. Без multi-seat, online, credits, автоматизации и новой публичной event page.
- `fixed` по умолчанию; `price` — integer `0..2147483647`. `split`: `price=0`, `targetAmount` — integer `1..2147483647`, только cash/transfer.
- Остаток копеек распределяется по `bookedAt,id`; сумма долей равна цели, разница ≤1 копейки. Empty/target<N запрещены.
- До settlement: `pending_payment`, `paymentId=null`; после — неизменные доли. Waitlist не начисляется и не продвигается после закрытия.
- `EVENT_SPLIT_PRICING_ENABLED` разрешает создание только при точном `true`, default false; существующие split обслуживаются независимо от флага.
- Одна задача/ветка/PR; RED → GREEN → refactor, пять gates, независимое review и CI до merge. Ветки `trafficolog/feat/...`, `trafficolog/test/...`, `trafficolog/chore/...`; коммиты с `Task:` и `Release: v0.1.7`.
- `main` → reviewed fast-forward `prod` → Actions с dump до миграций; без server-side git pull, переписывания тегов и неподтверждённых claims QA.
- После первого split нельзя откатывать на образ без split-поддержки. Тег/Release только после отдельного post-deploy Telegram/pilot acceptance.

## Review Focus

1. Повторное закрытие после confirm/reject возвращает сохранённые доли без повторных денег/уведомлений — тесты 6.11.1 и 8.11.1.
2. Ранее снятая оплаченная бронь возвращается при полной отмене события ровно один раз — тест 6.11.1.
3. Booking/target update, начавшиеся до settlement, не используют устаревшее событие после ожидания lock — барьерные тесты 6.11.2.
4. Ответ settlement после смены группы/маршрута не изменяет новый экран и не порождает POST после unmount — Vue тест 5.16.2.
5. Rollback удерживает остановку всех web/bot writers от authoritative DB guard до активации старого runtime; ошибка/гонка не допускает unsafe fallback — shell-contract тесты 9.8.11.

---

## Общая процедура каждой задачи

Работа идёт последовательно в изолированном worktree `C:\Users\User\.codex\worktrees\r06-pilot-ui-fixes\volleytime`. Пользовательский checkout с веткой авторизации не переключать. Сначала принять docs PR #79 после review/CI, затем каждую task branch создавать от фактического актуального `origin/main`. Общие UI/service файлы не редактировать несколькими implementers одновременно.

- [ ] Прочитать карточку, спецификацию и `docs/DEVELOPMENT_PROCESS.md`; отметить начало задачи в её карточке.
- [ ] Выполнить указанный RED → GREEN цикл; сохранить фактический вывод, не считать отсутствие БД доказательством PASS.
- [ ] Выполнить `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` на PostgreSQL с применённой тестовой миграцией. Точечные команды ниже дополняют, а не заменяют gates.
- [ ] Свежий reviewer проверяет specification compliance и code quality; исправления проходят собственный RED/GREEN и повторное review.
- [ ] Обновить acceptance/evidence карточки и current-state; явно перечислить непроведённые manual проверки.
- [ ] Commit (`feat|test|chore: ...`, trailers `Task: <id>` / `Release: v0.1.7`), отдельный PR, применимые exact-head CI, merge после acceptance. Исключение release-задачи 9.8.11: её code/local acceptance, свежие review и exact-head CI позволяют merge в main со статусом `in_progress` и явно открытыми deployment/manual критериями. Затем integrated-main gates/review/CI → reviewed FF prod → deploy → Telegram/pilot acceptance; только финальное evidence закрывает карточку/релиз. Полный пользовательский поток не объявлять готовым по промежуточному PR.

## Task 1 — 5.16.1: модель, validation и копейки

**Files:** Modify `packages/db/src/schema/events.ts`, `packages/db/src/schema/bookings.ts`, `packages/core/src/events/{schemas,service,index}.ts`, `packages/shared/src/index.ts`, `apps/web/server/api/organizations/[orgId]/index.get.ts`. Create `packages/shared/src/events/pricing.ts`, `packages/core/src/events/pricing-capability.ts`. Generate SQL/snapshot/journal through `pnpm db:generate` in `packages/db/migrations/` (имя генерирует Drizzle, не подделывать metadata). Test `packages/shared/src/events/pricing.test.ts`, existing schema tests and `packages/core/src/events/pricing-validation.integration.test.ts`.

**Interfaces:**

- `allocateSplitAmount(totalAmount: number, participants: readonly { bookingId: number; bookedAt: Date }[]): { bookingId: number; amount: number }[]`, экспорт из shared.
- `previewSplitAmount(targetAmount: number, taken: number, capacity: number): { minAmount: number; maxAmount: number; participantCount: number; basis: 'current' | 'capacity' }`, shared; empty current использует capacity.
- `isSplitPricingEnabled(value: string | undefined): boolean`, core helper, проверка env на сервере при create/переходе mode. Organization response: `capabilities: { eventSplitPricing: boolean }`.
- Event получает `priceMode`, `targetAmount`, `pricingSettledAt`, `pricingParticipantCount`; Booking — `allocatedAmount`. В PATCH отсутствие mode не сбрасывает существующий режим.

- [ ] Написать `allocates_remainder_by_bookedAt_then_id`: `expect(allocateSplitAmount(10000, fixtures)).toEqual([{bookingId:1,amount:3334},{bookingId:2,amount:3333},{bookingId:3,amount:3333}])`. Добавить N=1/500, ties, max integer, exact sum/gap, rejection empty/target<N; `previewSplitAmount(10000,0,4)` → `{minAmount:2500,maxAmount:2500,participantCount:4,basis:'capacity'}`.
- [ ] Запустить `pnpm exec vitest run --project unit packages/shared/src/events/pricing.test.ts`; ожидать RED по отсутствующему helper/поведению.
- [ ] Реализовать два pure helper: integer quotient/remainder, сортировка копии по времени/id, без SQL/float и изменения входного массива.
- [ ] Написать DB/API regression: legacy fixed/free неизменны; split price/target constraints, settlement pair, allocation positivity; клиентские settlement поля отвергнуты; false/undefined/`TRUE` запрещают новый split, `true` разрешает; mode нельзя менять даже после cancelled history. PATCH closed/finished без settlement запрещён, target после settlement неизменен.
- [ ] Запустить `pnpm exec vitest run --project integration packages/db/src/schema/events.test.ts packages/db/src/schema/bookings.test.ts packages/core/src/events/pricing-validation.integration.test.ts`; зафиксировать RED.
- [ ] Добавить модель/constraints/validation и миграцию. В финансовом update брать event advisory lock до свежего чтения; переиспользовать `ServiceContext` из `packages/core/src/shared/context.ts`, существующий transaction pattern и role guard. Флаг не блокирует обычный update уже созданного split. Ни одного runtime consumer не считать split бесплатным из-за price=0.
- [ ] Применить миграцию к тестовой БД через `pnpm db:migrate:test`; повторить оба focused набора до GREEN, затем общую процедуру задачи.

## Task 2 — 6.11.1: бронь, settlement и реальные деньги

**Files:** Create `packages/core/src/events/pricing-service.ts`, `packages/core/src/events/pricing-read-model.ts`, `packages/shared/src/events/pricing-types.ts`, `apps/web/server/api/organizations/[orgId]/events/[eventId]/settle.post.ts`. Modify `packages/core/src/events/{service,index,errors}.ts`, `packages/core/src/bookings/service.ts`, `packages/core/src/payments/service.ts`, `packages/shared/src/index.ts`, API adapters `apps/web/server/api/organizations/[orgId]/events/index.get.ts`, `events/[eventId]/index.get.ts`, `bookings/my.get.ts` (последние два относительно той же org directory). Test `packages/core/src/events/split-settlement.integration.test.ts`, `packages/core/src/bookings/split-booking.integration.test.ts`, `apps/web/server/api/organizations/[orgId]/events/settle.integration.test.ts`.

**Interfaces:**

- `eventPricingService.settle(ctx: ServiceContext, orgId: number, eventId: number): Promise<SplitSettlementResult>`.
- `SplitSettlementResult = { event: Event; summary: { targetAmount: number; participantCount: number; minAmount: number; maxAmount: number } }`; повтор возвращает сохранённый snapshot, не текущий активный состав.
- `EventPricingView = { mode:'fixed'|'split'; targetAmount:number|null; settledAt:string|null; participantCount:number; minAmount:number; maxAmount:number; basis:'fixed'|'current'|'capacity'|'settled'; myAllocatedAmount:number|null; myPaymentStatus:'pending'|'succeeded'|'cancelled'|'refunded'|null }`.
- `EventPricingView` и `PricingFinancials = { collected:number; pending:number; cancelled:number; refunded:number; currency:string }` определить в shared pricing-types и экспортировать как type, без server runtime imports в UI. `readEventPricing(ctx: ServiceContext, eventId: number): Promise<EventPricingView>`; GET event/list/my-bookings добавляют `pricing`. Manager-only `pricingFinancials:PricingFinancials`. Не раскрывать чужие персональные payment details.
- `PricingPermissions = { canChangePriceMode:boolean; canChangeTargetAmount:boolean; canSettle:boolean }`, shared type. Manager-only GET события возвращает `pricingPermissions:PricingPermissions` для active owner/organizer текущей организации; игроку поле не выдаётся. `canChangePriceMode` учитывает ЛЮБУЮ историю booking (включая cancelled-only и waitlist-only) и existing role/state policy; текущий `participantCount` не является разрешением. Capability отдельно ограничивает создание/переход в split. `canChangeTargetAmount` — unsettled split в рамках existing role/state policy; `canSettle` — active manager, published unsettled split. Mutation повторно проверяет права/history/status под event lock, GET не даёт гарантии против гонок.
- `paymentService.createForBooking(ctx, params, options?: { notifyOrganizers?: boolean }): Promise<Payment>`: существующий params сохраняется; default true, settlement передаёт false. Dispatch split-specific notifications добавляет следующая задача.

- [ ] Написать `reserves_split_without_payment`: cash/transfer занимают место со статусом pending_payment, paymentId/allocatedAmount null, pending queue пустая; subscription/free/online rejected; waitlist unpaid. Проверить fixed/free/subscription regressions и publicRoster paid только по реальному succeeded split payment.
- [ ] Выполнить `pnpm exec vitest run --project integration packages/core/src/bookings/split-booking.integration.test.ts`; получить RED.
- [ ] В book/rebook/promotion получать event lock до чтения цены/status и ветвиться по mode до price=0; запретить settled rebook/self-cancel и продвижение closed waitlist. Attendance unsettled запрещена. Сохранить существующие fixed transitions.
- [ ] Написать `settles_atomically_and_repeats_after_confirm_or_reject`: суммы `[3334,3333,3333]`, N payments, event closed, ledger unchanged до confirm; повтор после confirm/reject сохраняет payment IDs, allocation/count/time и audit count. Добавить empty/target<N, wrong tenant/role, rollback всей транзакции при insert failure, невозможность PATCH reopen.
- [ ] Написать `full_cancel_refunds_previously_removed_paid_split_once`: confirm → manager remove → full cancel → refunded, один income и один refund ledger; повтор cancel не добавляет запись. Обычный manager remove не возвращает деньги автоматически, shortfall виден в финансовой сводке.
- [ ] Написать `pricing_permissions_include_cancelled_and_waitlist_history`: реальный manager GET при cancelled-only/waitlist-only history и taken=0 возвращает canChangePriceMode=false; без history учитывает role/state, capability отдельно ограничивает переход в split, settled запрещает target/settle, published unsettled разрешает settle. Игрок/foreign org не получают manager projection. Отдельный mutation после изменения history/status отвергает устаревшее разрешение под lock.
- [ ] Запустить `pnpm exec vitest run --project integration packages/core/src/events/split-settlement.integration.test.ts apps/web/server/api/organizations/[orgId]/events/settle.integration.test.ts`; получить RED.
- [ ] Реализовать settlement/read models, manager-only pricingPermissions в GET события и POST с existing organization/membership guards и `withNotifications`. Под event advisory lock → fresh row lock → existing snapshot check → taken bookings → allocate → pending payments/link → allocations/count/time/closed/audit в одной транзакции. Полная отмена учитывает исторические allocated брони; payment operations соблюдают event-first lock order.
- [ ] Повторить focused тесты до GREEN и общую процедуру задачи. Не включать capability на VPS: notification/UI ещё не готовы.

## Task 3 — 8.11.1: уведомления после commit

**Files:** Modify `packages/core/src/notifier/{templates,types}.ts`, `packages/core/src/bookings/service.ts`, `packages/core/src/events/pricing-service.ts`. Test `packages/core/src/notifier/templates.test.ts`, `packages/core/src/notifier/split-notifications.integration.test.ts`.

**Interfaces:** Notification types `split_booking_reserved`, `split_price_settled`, `split_settled_organizer`; расширить существующий `TemplateParams` для `amount`, `targetAmount`, `participantCount` с существующими currency/method/deep-link параметрами. Использовать существующие `collectNotification` / `dispatchNotifications`, не вводить outbox.

- [ ] Написать `split_reservation_is_not_free_or_payment_request`: reserved/promotion текст содержит «Точная сумма после закрытия записи», не содержит «Бесплатно» и не предлагает оплатить прогноз. `split_price_settled` содержит точную личную сумму/метод/deep link.
- [ ] Написать `dispatches_once_after_commit`: три игрока получают свои 3334/3333/3333, manager получает одну сводку; rollback — ноль отправок; повтор после confirm/reject — ноль новых отправок. `transport_failure_keeps_committed_settlement` сохраняет payments/allocation и GET результат.
- [ ] Выполнить `pnpm exec vitest run --project integration packages/core/src/notifier/templates.test.ts packages/core/src/notifier/split-notifications.integration.test.ts`; получить RED.
- [ ] Реализовать шаблоны и collect calls после успешных transitions; N createForBooking с quiet option не создают N manager notifications. Сохранить confirm/reject/cancel templates и HTML escaping.
- [ ] Повторить focused набор до GREEN и общую процедуру задачи; не объявлять mock transport реальной Telegram доставкой.

## Task 4 — 5.16.2: формы и управление организатора

**Files:** Modify `apps/web/app/components/EventForm.vue`, Mini App `pages/m/orgs/[orgId]/events/{new,[eventId]/edit,[eventId]/manage}.vue`, desktop `pages/app/orgs/[orgId]/events/{new,[eventId]/edit,[eventId]/index}.vue`. Create `apps/web/app/components/EventPricingPanel.vue`. Test existing `EventForm.interaction.test.ts`, `manage.interaction.test.ts`, new `EventPricingPanel.interaction.test.ts` (в директории components).

**Interfaces:** EventForm submit расширяет existing payload полями `priceMode:'fixed'|'split'`, `targetAmount:number|null`, `price:number`; оба edit parents передают capability и `pricingPermissions:PricingPermissions` из manager GET Task 2. Они не выводят разрешения из participantCount. `EventPricingPanel` props `{ pricing:EventPricingView; financials:PricingFinancials|null; currency:string; canSettle:boolean; pending:boolean }`, canSettle берётся из того же server projection, emit `settle` без произвольных клиентских amounts. `PricingFinancials`/`PricingPermissions` соответствуют manager-only контракту Task 2; UI не импортирует server service runtime. Create использует organization capability и существующие права; сервер заново проверяет каждую mutation под lock.

- [ ] Написать `preserves_unsaved_values_between_modes`: fixed 1500 → split 10000 → fixed 1500; split payload price=0/target=10000, fixed target=null. Проверить disabled capability, booking-history mode lock, settled target lock, валюту и доступный radio/focus.
- [ ] Проверить `api_permissions_lock_both_edit_forms`: ответы реального manager GET для cancelled-only и waitlist-only history с taken=0 проходят через Mini App и desktop edit parents в EventForm; mode disabled, target/settle следуют своим server permissions. Проверить server refusal после устаревшего GET. Одни hand-written mounted fixtures не заменяют этот API-to-form evidence.
- [ ] Написать `settlement_is_guarded_by_full_route_and_lifecycle`: маршрут manage→edit того же event до подтверждения → POST count 0; смена org/event и unmount → POST count 0; поздний ответ не заменяет новый экран. Двойное подтверждение → один POST, failure → actionable error/GET retry без ложной пустоты.
- [ ] Выполнить `pnpm exec vitest run --project unit apps/web/app/components/EventForm.interaction.test.ts apps/web/app/components/EventPricingPanel.interaction.test.ts apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/manage.interaction.test.ts`; получить RED.
- [ ] Реализовать общий panel, conditional form и guarded settlement handler в обоих parents. Диалог показывает target/count и предупреждение о фиксации; сервер остаётся источником окончательного результата. Summary не смешивает валюты, отмены не пересчитывают доли.
- [ ] Повторить focused tests до GREEN; Chrome Mini App 320/390 и desktop 1280 light/dark, keyboard/новые controls при 200%, error/retry/route-switch. Сверить композицию с реальными organizer/web form references, без синих теней и с видимыми inputs на gray cards.
- [ ] Выполнить общую процедуру задачи; сохранить новые screenshots/evidence, прежнюю ручную QA неизменённых экранов не запрашивать повторно.

## Task 5 — 8.11.2: игрок, roster и применимый лендинг

**Files:** Modify `apps/web/app/components/EventCard.vue`, `apps/web/app/pages/m/orgs/[orgId]/{index,bookings}.vue`, `events/[eventId]/index.vue` в той же org directory, `apps/web/app/pages/index.vue`. Create `apps/web/app/utils/event-pricing-label.ts`, its `.test.ts`, `apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/pricing.interaction.test.ts`.

**Interfaces:** `eventPricingLabel(pricing: EventPricingView, currency: string): { text:string; description:string; payable:boolean }`; basis current/capacity — прогноз, settled+mine — точная доля, settled без mine — диапазон, fixed — прежнее отображение. Получает только Task 2 API contract, не вычисляет оплату из legacy price.

- [ ] Написать `unsettled_split_is_not_free_or_paid`: current выводит ≈/пояснение, zero participants — «При полном составе»; nullable own amount не означает 0/free. Settled mine=3334 — точная сумма без ≈; чужому игроку не видны персональные payments. Cancelled/refunded не показывают «Оплачено».
- [ ] Написать `split_booking_allows_only_cash_or_transfer`: modal скрывает subscription даже при enabled org, выбранный method реально уходит в API; response pending_payment без paymentId показывает занятую бронь/расчёт позже. Fixed subscription/free сохраняются.
- [ ] Выполнить `pnpm exec vitest run --project unit apps/web/app/utils/event-pricing-label.test.ts apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/pricing.interaction.test.ts`; получить RED.
- [ ] Реализовать helper и согласованное использование Home/cards/event/booking confirmation/my bookings. Обновить применимые исходные блоки/FAQ лендинга только о реально реализованном split: никаких обещаний auto-close/multi-seat/онлайн-оплаты. Проверить защищённый roster и существующие deep links, не создавать публичную event page.
- [ ] Повторить focused tests до GREEN; Chrome 320/390 light/dark — zero/current/waitlist/settled/confirmed/cancelled/refunded, navigation/GET retry. Сверить с `screens-player.jsx` и реальным Mini App reference; лендинг desktop/mobile regression.
- [ ] Выполнить общую процедуру задачи.

## Task 6 — 6.11.2: детерминированные денежные гонки

**Files:** Create `packages/core/src/events/split-races.integration.test.ts`. Modify existing `packages/core/src/payments/money-races.integration.test.ts`, `packages/core/src/__tests__/phase6-money-flows.integration.test.ts`; production files изменять только при подтверждённом дефекте с синхронизацией карточки.

**Interfaces:** Только реальные service interfaces предыдущих задач и тестовые PostgreSQL connections/transactions; без sleep-based победителей, production test hooks или отдельной финансовой реализации.

- [ ] Написать барьерные сценарии `settle_vs_book_reloads_event_after_lock`, `settle_vs_target_update_uses_locked_value`, `settle_vs_cancel_or_promotion`, `concurrent_settle_is_one_snapshot`. Удерживать lock отдельной тестовой connection, дождаться фактического ожидания через PostgreSQL, затем отпускать в контролируемом порядке. Assert exact N/payment IDs/allocation sum/closed и отсутствие новых участников после settlement.
- [ ] Написать `confirm_reject_full_cancel_no_double_money`: каждый допустимый порядок даёт максимум один income/refund на payment, ни одного deadlock; previously removed paid booking также refunded. Fixed/free/subscription regression сохраняет прежние ledger/slot инварианты.
- [ ] Выполнить `pnpm exec vitest run --project integration packages/core/src/events/split-races.integration.test.ts packages/core/src/payments/money-races.integration.test.ts packages/core/src/__tests__/phase6-money-flows.integration.test.ts`; RED обязателен при найденном дефекте, а GREEN characterization не выдавать за RED.
- [ ] Исправить только доказанные нарушения lock order/fresh reads/idempotence, повторить focused tests до GREEN; каждый testcase очищает только свои fixtures, releases connection даже при assertion failure.
- [ ] Повторить concurrency suite три раза, затем общую процедуру задачи. Не считать эту проверку Telegram/production QA.

## Task 7 — 9.8.11: rollback boundary, общий QA и выпуск

**Files:** Create `scripts/verify-split-rollback.sh`, `apps/web/server/utils/split-rollback-contract.test.ts`, `packages/core/src/events/split-rollback-races.integration.test.ts`, `docs/operations/qa/2026-10-01-r07-split-pricing.md`. Modify `scripts/deploy-image-bundle.sh`, `scripts/deploy-ghcr-manual.sh`, `scripts/render-production-env.mjs`, `.github/workflows/deploy.yml`, `apps/web/Dockerfile`, `apps/bot/Dockerfile`, `docs/operations/runbooks/deploy.md`, release/task/status docs. Existing deploy contract tests дополнить, не отключать.

**Interfaces:** `bash scripts/verify-split-rollback.sh WEB_IMAGE BOT_IMAGE CAPTURED_RUNTIME_FILE` → authoritative exit 0 только при безопасной совместимости и доказанной write quiescence для fixed-only downgrade. Caller удерживает existing deploy lock до завершения activation/recovery; snapshot содержит точные active web/bot container IDs и immutable image IDs/references для recovery. Образы полного R0.7 имеют label `org.volleytime.event-split-pricing=1`; supplied label не заменяет проверенный build SHA. Existing image/data preflight выполняется до остановки, но раннее отсутствие split не разрешает downgrade.

Для authoritative downgrade check под deploy lock сначала захватить snapshot и остановить ВСЕ project web/bot writers, включая duplicate/scaled containers; проверить по project/service identity, что ни один не running. Остановка дожидается завершения или принудительно завершает in-flight транзакции. Только затем через existing postgres Compose service проверить schema column и split rows; query error — fail closed, отсутствие схемы/строк допускает fixed-only runtime только при удерживаемой quiescence. Непосредственно перед switch повторно проверить отсутствие writers; до authoritative guard не менять Git/manifest/env и не активировать images (остановка writers — необходимый подготовительный шаг). Держать writers остановленными до активации старого runtime; lock исключает конкурирующую управляемую активацию. Это краткая контролируемая пауза rollback, без нового persisted feature table/global advisory lock и без паузы обычных пользовательских flows.

Отказ на несовместимом образе или query error не выполняет downgrade: до stop runtime остаётся прежним; после stop восстанавливать только захваченные совместимые current containers/images, никогда old unsafe fallback. Если safe recovery нельзя подтвердить, оставить отказ и сообщить точный runtime/Git/manifest/env state для reviewed roll-forward. Не делать DB restore/удаление split-данных. Те же правила обязательны для manual и automatic migration/activation/smoke recovery.

- [ ] Написать `rollback_blocks_old_images_with_split_rows`, `rollback_db_error_fails_closed`, `rollback_before_first_split_remains_safe`: fake Docker/DB shell harness проверяет preflight → captured IDs/images → stop всех duplicate/scaled writers → authoritative query → writer recheck → old activation. До guard нет Git/manifest/env/image activation mutations; при отказе история/manifest сохраняются. Прогнать manual/automatic rollback paths, включая migration/activation/smoke failure.
- [ ] Написать детерминированные `inflight_split_before_stop_is_seen_or_rolled_back` и `split_cannot_commit_between_guard_and_old_activation`: управляемые barriers с реальной PostgreSQL-транзакцией доказывают, что запрос до stop либо commit до authoritative query (old runtime rejected), либо rollback; новый запрос не commit в guard→activation window. Shell harness доказывает отсутствие running writers включая duplicates/scales. Проверить pre-stop failure без runtime изменений, post-stop query/incompatibility/activation failure с recovery только captured compatible current runtime, writer recheck failure и отсутствие unsafe fallback; evidence fake Docker отдельно от DB race.
- [ ] Выполнить `pnpm exec vitest run --project unit apps/web/server/utils/split-rollback-contract.test.ts apps/web/server/utils/deploy-image-bundle-contract.test.ts apps/web/server/utils/ghcr-manual-deploy-contract.test.ts`; получить RED.
- [ ] Выполнить `pnpm exec vitest run --project integration packages/core/src/events/split-rollback-races.integration.test.ts` с PostgreSQL; получить RED по отсутствующему quiescence contract, сохранить реальный DB-state evidence отдельно от shell mocks.
- [ ] Реализовать preflight/quiescence/authoritative guard/recheck/recovery в обоих deploy paths и capability env propagation из repository variable. Добавить image labels только полному реализованному runtime. В runbook зафиксировать captured IDs/images, остановку всех writers под deploy lock, сохранение паузы до activation, exact-state recovery и reviewed roll-forward без удаления данных/DB restore.
- [ ] Повторить focused deploy tests и DB race до GREEN; пять gates, полный локальный real-API visual matrix (organizer/player/desktop, fixed/split/error/stale routes, light/dark, 320/390/1280, новые controls 200%), свежие specification/code review и exact-head CI. Зафиксировать code/local acceptance и SHA; deployment/manual acceptance явно остаются open.
- [ ] Merge отдельного Task 7 PR в main после этого локального checkpoint; карточка 9.8.11 остаётся `in_progress`, релиз не закрывается. На точном интегрированном main выполнить пять gates с PostgreSQL, whole-branch review и exact-main CI; сохранить candidate SHA/evidence до promotion.
- [ ] Продвинуть этот проверенный main reviewed fast-forward в prod, включить capability только после ready gates, Actions image-bundle deploy. Проверить dump до migrations, gzip/permissions, workflow success, Git/images/runtime/health exact SHA и synthetic smoke. Не запускать Docker сборку на VPS и не считать backup проверенным restore.
- [ ] Проверить два Telegram test accounts в pilot organization: запись/forecast, ручное закрытие, личные exact amount notification, confirm/reject, запрет subscription, повторное закрытие без дублей. Недоступные агенту действия запросить конкретным списком у пользователя; реальную доставку не подменять mocks. Критический дефект → остановка и безопасное recovery согласно новой rollback boundary.
- [ ] Только после manual acceptance закрыть 9.8.11/релиз, создать неизменяемый v0.1.7 tag/Release, сохранить результаты; автоматическое наблюдение обновить/остановить по фактическому завершению его цели, не раньше.

## Самопроверка плана

Спецификация покрыта: модель/flag/rounding — Task 1; lifecycle/финансы/privacy/attendance и manager pricingPermissions — Task 2; delivery/idempotence — Task 3; organizer/API-to-form permissions — Task 4; player/landing — Task 5; races — Task 6; quiescent rollback/deploy/manual acceptance — Task 7. Пять Review Focus привязаны к именованным тестам. Контракты `EventPricingView`, `PricingPermissions` и settlement едины для server/UI, schema-generated SQL не переименовывается вручную. Статусы todo сохраняются до реализации; ни один checkbox выше не является подтверждением выполненной проверки. Merge Task 7 после local checkpoint сохраняет in_progress до deployment/manual evidence.

Спецификация и письменный план утверждены пользователем 2026-10-01. Ранее выбранный способ исполнения — **Subagent-driven**, отдельная проверка каждой задачи; повторный выбор способа не требуется. Продуктовая реализация ещё не начата.
