# Desktop Organizer Finance v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give owner/organizer separate desktop «Оплаты» and «Касса» screens with complete, paginated payment history and only the existing MVP money operations.

**Architecture:** Add a manager-only read endpoint backed by a focused payment-history query; leave pending/confirm/reject and ledger write contracts unchanged. Build two pages inside the merged desktop shell, with small tested presentation/validation helpers and server refetch after each mutation.

**Tech Stack:** Nuxt 4/Vue 3, H3, Drizzle/PostgreSQL, Zod, Vitest, existing CSS tokens and desktop layout.

**Spec:** `docs/superpowers/specs/2026-09-27-organizer-desktop-finance-v2-design.md`; SDD acceptance: `docs/tasks/6-10-1-organizer-desktop-finance-v2.md`.

## Global Constraints

- Work only on task 6.10.1 from reviewed `main`; preserve unrelated work and keep `prod`/VPS untouched until the full R0.6 candidate is accepted.
- `cancelled` is always labelled «Отменён»; no inferred cancellation actor or time, and no migration to reconstruct old causes.
- History covers `pending`, `succeeded`, `cancelled`, `refunded`; default page 50, maximum 100, sort `createdAt DESC, id DESC` with precision-preserving keyset cursor.
- Reuse `requireCanManageContent`, current payment confirm/reject and ledger endpoints; no new online payment, refund action, CSV, edit/delete or mixed-currency total.
- Follow SDD red → green → refactor. Code changes require `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` with PostgreSQL and `pnpm build`; review, CI and financial/browser smoke precede merge to GitHub `main`.

## Review Focus

- PostgreSQL timestamps within one millisecond: cursor must retain database precision, and the next page must neither skip nor repeat a row (Task 1 integration test).
- Malformed/repeated/oversized query values or a cursor for a different filter: return 400 or reset the client page, never leak a 500 or old-filter rows (Tasks 1 and 2 tests).
- An unavailable booking/plan or a `cancelled` payment: keep the payment visible, show a neutral target fallback and no invented cancellation detail (Tasks 1 and 2 tests).
- Another organizer processes a pending payment first: show conflict, reload both lists and create no second ledger income (Task 2 helper/HTTP regression tests and browser check).
- Group switch during loading or before a click, comma-decimal input, and BYN/other-currency balances: never show prior-tenant data or post the wrong amount/group (Tasks 2 and 3 tests).

---

### Task 1: Complete payment-history read contract

**Files:**

- Create: `packages/core/src/payments/history.ts`, `packages/core/src/payments/history.integration.test.ts`
- Modify: `packages/core/src/payments/service.ts`, `packages/core/src/payments/index.ts`
- Create: `apps/web/server/utils/payment-history-query.ts`, `apps/web/server/utils/payment-history-query.test.ts`
- Create: `apps/web/server/api/organizations/[orgId]/payments/history.get.ts`, `apps/web/server/__tests__/payment-history.integration.test.ts`

**Interfaces:**

- Produces `PaymentHistoryCursor = { createdAt: string; id: number }`, where `createdAt` is a UTC ISO timestamp with six fractional digits selected by PostgreSQL and used in the order comparison, not a JavaScript Date rounded to milliseconds.
- Produces `paymentService.listHistory(ctx, orgId, { status?, limit, cursor? }): Promise<{ payments: PaymentHistoryRow[]; nextCursor: PaymentHistoryCursor | null }>`; `PaymentHistoryRow` contains ID, status, amount, currency, method, `createdAt`, `confirmedAt`, `refundedAt`, public `user`, nullable `event` and `plan`.
- Produces `parsePaymentHistoryQuery(query: Record<string, unknown>): { status?: Payment['status']; limit: number; cursor?: PaymentHistoryCursor }` and `encodePaymentHistoryCursor(cursor): string` in the web query utility; invalid input throws and the route maps it to HTTP 400.
- Produces `GET /api/organizations/:orgId/payments/history?status=&limit=&cursor=` → `{ payments, nextCursor: string | null }`; Task 2 consumes this JSON and treats the cursor as opaque.

- [ ] **Step 1: Write RED core integration tests.** In `history.integration.test.ts`, assert four statuses including `cancelled`, org isolation, deleted target fallback, order and page boundary when two `created_at` values differ by microseconds within one millisecond. Assert public row keys only.
- [ ] **Step 2: Run the core test.** `pnpm exec vitest run --project integration packages/core/src/payments/history.integration.test.ts`; expect failure because `listHistory` is absent (PostgreSQL test DB must be running/migrated).
- [ ] **Step 3: Implement the core query.** Put `listPaymentHistory(ctx, orgId, opts)` and row/cursor types in `history.ts`, expose it as `paymentService.listHistory` and export types. Use tenant condition, optional status, `limit + 1`, `createdAt DESC, id DESC` and a parameterized `(created_at, id)` keyset comparison; select cursor time via UTC `to_char(..., 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` so microseconds survive the API. Left-join nullable target context; select only public user fields.
- [ ] **Step 4: Run the core test.** Same command; expect PASS for all statuses, precision boundary, isolation and deleted target.
- [ ] **Step 5: Write RED HTTP query/API tests.** Unit-test default 50, accepted 1–100, status allowlist, cursor round-trip and rejection of invalid/repeated fields in `payment-history-query.test.ts`. In `payment-history.integration.test.ts`, use `createTestApi()` to assert owner/organizer 200; assistant/player 403; foreign organization no data; bad status/limit/cursor 400; no email/phone/Telegram ID in JSON; existing pending endpoint unchanged.
- [ ] **Step 6: Run those tests.** `pnpm exec vitest run --project unit apps/web/server/utils/payment-history-query.test.ts` and `pnpm exec vitest run --project integration apps/web/server/__tests__/payment-history.integration.test.ts`; expect RED on missing utility/route.
- [ ] **Step 7: Implement validation and route.** Decode an opaque base64url JSON cursor only after validating exact six-digit UTC timestamp text and positive integer ID; preserve that text without converting it through JavaScript Date. Reject mismatched/invalid query values with 400. In the route call `requireCanManageContent(event.context.member ?? null)` and `paymentService.listHistory` for `event.context.organization!.id`, then encode `nextCursor`; do not alter existing pending route.
- [ ] **Step 8: Run all Task 1 tests.** Repeat the three targeted Vitest commands; expect PASS. Inspect the API response for only declared fields.
- [ ] **Step 9: Commit Task 1.** Commit only its files with `Task: 6.10.1` and `Release: v0.1.6` trailers.

### Task 2: Desktop navigation and payments

**Files:**

- Modify: `apps/web/app/utils/desktop-org-ui.ts`, `apps/web/app/utils/desktop-org-ui.test.ts`, `apps/web/app/layouts/desktop-org.vue`, `apps/web/app/assets/css/desktop.css`
- Modify: `apps/web/server/__tests__/payment-history.integration.test.ts` (concurrent confirm regression)
- Create: `apps/web/app/utils/desktop-payments.ts`, `apps/web/app/utils/desktop-payments.test.ts`, `apps/web/app/pages/app/orgs/[orgId]/payments.vue`

**Interfaces:**

- Consumes Task 1 history JSON and existing `GET /payments`, `POST /payments/:id/confirm|reject`.
- Produces `paymentStatusLabel(status: Payment['status']): string`, `paymentMethodLabel(method: Payment['method']): string`, `historyCursorForStatusChange(previousStatus: Payment['status'] | 'all', nextStatus: Payment['status'] | 'all', cursor: string | null): string | null`, `shouldReloadPaymentsAfterError(code: string | null): boolean` and `canSubmitDesktopPaymentAction(currentPath: string, expectedPath: string, expectedOrgId: number, currentOrgId: number, busy: boolean): boolean` in `desktop-payments.ts`.
- Produces desktop route `/app/orgs/:orgId/payments`, with separate pending/history state and an opaque history cursor reset on status/org change or mutation.

- [ ] **Step 1: Write RED UI-helper/nav tests.** Assert both finance links exist with the selected organization in `desktopNavItems`, regardless of the subscription toggle; verify all status/method labels, including `cancelled` → «Отменён» and `online` as read-only history text. Assert status-filter change resets cursor, `payment.not_pending` requires refetch, guard rejects changed route/org or busy action, and a missing target is labelled neutrally rather than as an invented event/plan. Add HTTP regression asserting a second confirm gets 409 and only one ledger income exists.
- [ ] **Step 2: Run the unit tests.** `pnpm exec vitest run --project unit apps/web/app/utils/desktop-org-ui.test.ts apps/web/app/utils/desktop-payments.test.ts`; expect RED for absent links/helpers.
- [ ] **Step 3: Implement nav and helpers.** Add «Оплаты» with `card` and «Касса» with `wallet` icons to the existing shell, using real routes. Implement only presentation and action-guard helpers; leave business transitions on the server.
- [ ] **Step 4: Implement the payments page.** Show pending with single-payment confirm/reject (web confirmation before reject), then complete status-filtered history with «Показать ещё». Disable repeated action while busy. On success refetch pending and first history page; on `payment.not_pending` show conflict and refetch, without optimistic status or second ledger operation. Keep 401/403/404, loading, empty, retry and stale-org/route guards; do not mix currencies.
- [ ] **Step 5: Run unit, HTTP regression and local browser smoke.** Repeat Step 2 and run `pnpm exec vitest run --project integration apps/web/server/__tests__/payment-history.integration.test.ts`; expect PASS. With local API/DB, open `/app/orgs/:orgId/payments` as owner and organizer; confirm and reject one payment each, check both lists after refresh, conflict handling, filter/pagination, missing target, assistant denial, org switch during a pending request and keyboard operation.
- [ ] **Step 6: Commit Task 2.** Commit only nav, helper, page and relevant CSS with `Task: 6.10.1` and `Release: v0.1.6` trailers.

### Task 3: Desktop cashbox and task acceptance

**Files:**

- Create: `apps/web/app/utils/desktop-cashbox.ts`, `apps/web/app/utils/desktop-cashbox.test.ts`, `apps/web/app/pages/app/orgs/[orgId]/cashbox.vue`
- Create: `apps/web/server/__tests__/desktop-finance-smoke.integration.test.ts`
- Modify: `apps/web/app/assets/css/desktop.css`, `docs/tasks/6-10-1-organizer-desktop-finance-v2.md`, `docs/operations/status/current-state.md` (acceptance evidence only after checks)

**Interfaces:**

- Consumes existing `GET /api/organizations/:orgId/ledger`, `POST /ledger/income|expense`, `GET /events?filter=all&limit=30` and Task 2 desktop shell.
- Produces `parseDesktopLedgerAmount(raw: string): number | null` in `desktop-cashbox.ts`: comma/dot decimal, strictly 1–2 fractional digits, positive, maximum `10_000_000` minor units. Also produces `desktopBalanceRows(balance: LedgerBalance): CurrencyBalanceRow[]` with each currency separate, `canSubmitDesktopLedgerAction(currentPath: string, expectedPath: string, expectedOrgId: number, currentOrgId: number, busy: boolean): boolean`, and category constants matching `AddIncomeInput`/`AddExpenseInput`. `LedgerBalance` is the current `GET /ledger` balance shape; `CurrencyBalanceRow` has `currency`, `income`, `expense`, `balance` as minor-unit values.
- Produces `/app/orgs/:orgId/cashbox`: real balance and last ledger operations, type filter, manual income/expense forms using current server categories and organization timezone.

- [ ] **Step 1: Write RED cashbox-helper tests.** Assert `1,25` → 125 minor units, `0`/negative/three decimals/over-maximum invalid; each currency remains separate; only current income/expense categories are selectable (no manual `payment_income`/`refund`). Assert changed route/org or busy state prevents a submit.
- [ ] **Step 2: Run the unit test.** `pnpm exec vitest run --project unit apps/web/app/utils/desktop-cashbox.test.ts`; expect RED because helpers are absent.
- [ ] **Step 3: Implement helper and page.** Fetch balance and recent entries via the existing ledger route; show main-currency balance/income/expense and separate other-currency balances. Filter journal by `all|income|expense`. Reuse server-backed manual income/expense categories, `toMinor`/timezone conversion and optional own-org event; after POST refetch balance and journal. Preserve form values on error, block duplicate submit, clear stale data on org change/unmount, and show all agreed access/loading/error/empty states. No edit/delete/CSV buttons.
- [ ] **Step 4: Write the financial HTTP smoke test.** In `desktop-finance-smoke.integration.test.ts`, book two paid places, confirm one and reject the other through HTTP, assert history has `succeeded`/`cancelled`, exactly one automatic income appears in ledger, then post one valid manual income and expense and assert the final server balance; assert player cannot read/write finance endpoints.
- [ ] **Step 5: Run the unit/financial smoke and browser checks.** `pnpm exec vitest run --project unit apps/web/app/utils/desktop-cashbox.test.ts` and `pnpm exec vitest run --project integration apps/web/server/__tests__/desktop-finance-smoke.integration.test.ts`; expect PASS. With local API/DB, create one manual income and expense, check exact minor-unit amounts and refreshed balance/journal, reject a foreign event, verify 403, event/date filter, back/forward, keyboard, 1280/1440 px, narrow viewport and 200% zoom; inspect both finance screens against MVP portions of the current reference.
- [ ] **Step 6: Run full gates.** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` with migrated PostgreSQL and `pnpm build`; expect all exit 0. Re-run Task 1 HTTP/integration tests and the financial smoke; repository tests alone do not prove visual, Telegram or production QA.
- [ ] **Step 7: Review and close.** Obtain independent whole-branch review, repair findings under this SDD card with RED tests, rerun affected/full gates, record exact evidence in the task card and a dated current-state note. Create one task PR, wait for CI, merge to GitHub `main` only when criteria pass; keep `prod`/VPS unchanged pending full R0.6 and 8.10.3 QA.
