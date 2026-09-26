# Organizer Mini App v2 Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the organizer's working Mini App screens into structural and visual alignment with the approved v2 reference, without changing MVP business rules or presenting future features as live.

**Architecture:** Evolve the current Nuxt pages and `miniapp-org` layout in place. Keep server APIs authoritative; add only tiny typed UI projections where an independently testable decision is needed. Reuse `VtSheet` for the menu and ledger form, improve its dialog behavior once for both. Keep player navigation unchanged.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind/CSS tokens, Vitest unit tests, local browser QA.

**Spec:** [8.10.2 design](../specs/2026-09-26-organizer-miniapp-v2-design.md), [SDD card](../../tasks/8-10-2-organizer-miniapp-v2.md), `D:\ai\freelance\volleyball-volleytime\references\Volley Time Mini App.html` (SHA-256 in spec).

**Global Constraints:** Work only in `trafficolog/feat/8.10.2-organizer-miniapp-v2` at `C:\Users\User\.codex\worktrees\organizer-miniapp-v2-spec\volleytime`. Do not merge 8.10.1 or alter `main`, `prod`, VPS, release tags, or production. SDD before code; each behavior change follows RED → GREEN → refactor. Preserve owner/organizer server permissions, tenant separation, organization timezone, append-only ledger, real payment operations, and existing player paths. Exclude credits, split, event sharing/QR, bulk confirmation, contributions, reports, and fake metrics. User approval of the design is not Telegram or release QA approval.

## Scope and file map

Existing routes: `apps/web/app/pages/m/orgs/[orgId]/index.vue`, `events/index.vue`, `events/[eventId]/manage.vue`, `payments.vue`, `cashbox.vue`, `events/new.vue`, `events/[eventId]/edit.vue`; shared `apps/web/app/components/EventForm.vue`, `vt/TabBar.vue`, `vt/Sheet.vue`, and `apps/web/app/layouts/miniapp-org.vue`. Server contracts: `apps/web/server/api/organizations/[orgId]/dashboard.get.ts`, existing organization, event, payment, and ledger API routes. Existing unit-test location: `apps/web/app/utils/*.test.ts`. New helper (only if the RED tests need it): `apps/web/app/utils/organizer-miniapp.ts` and matching `.test.ts`. The reference is visual-only; `docs/tasks/8-10-2-organizer-miniapp-v2.md` controls accepted behavior.

### Task 1 — Lock the contract and add safe organizer navigation

- [ ] Re-read the SDD card/spec and current route/API shapes. Check `git status --short --branch` and verify the branch still descends from `origin/main`. If main has moved materially, resolve integration before editing; do not rewrite unrelated work.
- [ ] Write `apps/web/app/utils/organizer-miniapp.test.ts` RED for a pure `organizerMenuLinks(base, member, subscriptionsEnabled)` projection: active owner sees create/invite/plans (only enabled)/settings/audit; active organizer sees create/invite/plans (only enabled)/audit but not settings; player/pending sees none. Run `pnpm exec vitest run --project unit apps/web/app/utils/organizer-miniapp.test.ts`; expect failure due to missing export.
- [ ] Add the minimal `organizerMenuLinks` in `apps/web/app/utils/organizer-miniapp.ts`, consuming `{role,status}`, `base`, and the selected organization's boolean. Return `{to,label}` links, no speculative destinations. Run the same test GREEN, then simplify duplicate conditions.
- [ ] Add RED assertions for action-vs-link tab model: the four organizer destinations are overview, members, cashbox, payments; the fifth is an action named menu; player items remain links. Define `TabItem` as a discriminated union in `apps/web/app/components/vt/TabBar.vue`: `{ kind?: 'link'; to: string; label: string; icon: string; prefix?: boolean } | { kind: 'action'; id: 'menu'; label: string; icon: string }`. Emit `action` with `'menu'` when the semantic button is clicked. GREEN and run the test.
- [ ] In `miniapp-org.vue`, render the five organizer items in approved order and a `VtSheet` bound to the menu action. Render only `organizerMenuLinks(...)`, with organization-id validation and `orgError` blocking manager controls. The plans link is absent when subscriptions are disabled. Give the action `aria-expanded`, `aria-controls`, and a stable dialog id. Manually verify link navigation still works for a player before committing.
- [ ] Commit with `feat(miniapp): add organizer v2 navigation`, `Task: 8.10.2`, `Release: v0.1.6 (R0.6)`.

### Task 2 — Make the shared bottom sheet keyboard-safe

- [ ] Add a RED browser scenario for `VtSheet`: open by keyboard, first actionable control focused, Tab/Shift+Tab contained, Escape closes, focus returns to trigger, backdrop closes without submitting the ledger form. Use the browser harness available for the repository; do not count a static assertion as keyboard QA.
- [ ] Update `apps/web/app/components/vt/Sheet.vue` with a dialog panel ref, labelled heading/id, focus initialization on open, Escape handler, focus containment, cleanup on close/unmount, and return-focus to the invoking button. Preserve `v-model` and the existing cashbox use. The panel must be above the overlay and scroll at 320px/200% zoom.
- [ ] Repeat the scenario GREEN for both organizer menu and cashbox operation sheet, including dark theme and reduced motion. Commit `fix(miniapp): make organizer sheets keyboard-safe` with the required task/release trailers.

### Task 3 — Organizer Home and event-list composition

- [ ] Add RED helper tests for a manager-only Home projection of dashboard data: only current `organization.id === route orgId` and active manager data are shown; `manager.balance` uses its real currency and distinct income/expense fields; `upcoming[0]` is the next event; zero events produces empty state. Test no cross-organization/stale balance display. Use the existing dashboard contract as input; do not infer occupancy or attendance.
- [ ] Implement only the projection needed by the tests in `organizer-miniapp.ts`. Update the `Dashboard` type in `index.vue` to the actual `balance` shape (`currency`, `income`, `expense`, `balance`, `byCurrency`) and make both organization/dashboard fetch keys route-specific. Suppress old data and mutations while switching groups or on 403/load error. Run focused test GREEN.
- [ ] Rebuild only manager sections in `index.vue`: cash hero spanning two rows at desktop-miniapp width, right pending/next-event cards (`grid-template-columns: 1.3fr 1fr` where space permits), compact upcoming list, and four working quick actions: create training, invite, expense (link to cashbox or sheet), players. Keep the current player sections untouched. Empty/error/loading states must retain functional links. Use real amounts only in their original currency.
- [ ] In `events/index.vue`, keep the upcoming/past filter and API, but render compact organizer rows with real date/time, venue, `taken/capacity`, and draft/published state. Preserve player card rendering. Add route-key/race protection so a response from another org/filter does not populate the current list.
- [ ] Check 320/390px, light/dark, 200% zoom, and full-clickable semantics against the live HTML; record screenshot locations for later review. Commit `feat(miniapp): align organizer overview and event list` with trailers.

### Task 4 — Event roster and real event payments

- [ ] Add RED tests in `organizer-miniapp.test.ts` for `pendingPaymentsForEvent(payments, eventId)`: select only `event?.id === eventId`, exclude plan-only and other-event payments, preserve actual amount/method/user, return empty for none. Add tests for `inRoster`/waitlist status grouping only if moving that logic into the helper. Run focused test and observe RED.
- [ ] Implement the minimal pure filter; GREEN test. In `events/[eventId]/manage.vue`, add accessible `Состав`/`Оплаты` tabs with `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, and actual panels. Keep `mark`, `removeBooking`, `cancelEvent`, `publish` and their confirmations. Use existing `/bookings` and `/payments` GETs, with distinct loading/error states per panel and route-key/race protection.
- [ ] For each pending event payment render only real amount, currency, method, payer, and individual Confirm/Reject buttons. POST to `/api/organizations/${orgId}/payments/${id}/confirm|reject`; prompt before rejection. On success refresh payments, roster, and event; on `payment.not_pending` refresh before showing the conflict. Track busy by payment id. Never claim a processed booking means money was received; if shown, label by actual booking status without amount.
- [ ] Exercise RED/GREEN browser flows: pending and empty event payments, successful single confirmation/rejection, already-processed conflict, canceled event, attendance after start, roster/waitlist, unauthorized access, org/event switch. No bulk action or event-share control. Commit `feat(miniapp): add event roster and payment tabs` with trailers.

### Task 5 — General payment queue and cashbox

- [ ] Add RED tests for any moved payment/ledger projection: currency totals remain separate; no `online` payment is labelled cash; on org switch/load error old queue and balance are not visible. Run focused unit test RED. If no pure projection is required, use failing browser flow as RED before editing the page.
- [ ] Update `payments.vue` to reference rhythm while retaining only pending data and one-at-a-time POST actions. Preserve loading, empty, 403, and `payment.not_pending`; reset data on org change and block old-org action. Do not display fabricated recent confirmations. GREEN unit/browser tests.
- [ ] Update `cashbox.vue` to a blue balance hero with real income/expense and separately shown other currencies, two real operation buttons, and day-grouped journal. Keep existing POST income/expense payload and categories, append-only semantics, errors, and organization timezone. Clear/guard old data on org switch and distinguish 403 from retryable error. GREEN unit/browser tests for form validation, saved operation refresh, 403, and no edit/delete controls.
- [ ] Commit `feat(miniapp): align payments and append-only cashbox` with trailers.

### Task 6 — Event form and subscription-setting readout

- [ ] Add RED browser tests for new/edit routes: fields round-trip through existing POST/PATCH payload (title, zoned start/end, venue or new venue, capacity, fixed price in minor units, deadline, description, draft/publish); zero price stays zero; validation/API failure retains input and reports error. Check disabled subscriptions renders only an explanatory readout, not a per-event switch or subscription payment option.
- [ ] In `events/new.vue` and `events/[eventId]/edit.vue`, fetch the selected organization's `subscriptionsEnabled` and active member, route-keyed. Deny the form when org/event loading fails or role cannot manage; pass the boolean to `EventForm.vue` as a read-only prop. On edit, preserve existing event status and timezone behavior.
- [ ] Recompose `EventForm.vue` into the reference's grouped sections while preserving native controls and current mutation payload. Label the group-level subscription state without offering an event-level toggle. Do not add templates, split, credits, or automatic pricing. GREEN browser tests at 320/390px, light/dark, keyboard, and 200% zoom.
- [ ] Commit `feat(miniapp): align organizer event form` with trailers.

### Task 7 — Integrated task QA, review, and handoff

- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` from the task worktree; record exit codes. If integration tests need PostgreSQL, start the repository-supported local test database and rerun; never report an unexecuted DB gate as green. Run `git diff --check`.
- [ ] On a local production build, compare organizer Home, event list/manage tabs, payments, cashbox, new/edit form, and menu against the live HTML at 320/390px, light/dark, 200% zoom, reduced motion, and native/Telegram-like viewport. Capture before/after evidence. Exercise cash, transfer, free, draft, disabled subscriptions, owner/organizer/player, empty/error/403, route switching, and keyboard focus. Fixtures prove browser behavior only, not real Telegram or real money.
- [ ] Request independent code review, resolve findings through SDD-first RED → GREEN cycles, repeat affected gates and browser cases. Update `docs/tasks/8-10-2-organizer-miniapp-v2.md` and `docs/operations/status/current-state.md` with exact evidence and unfinished manual QA; do not mark `done` on repository tests alone.
- [ ] If task acceptance including applicable browser QA is met, push this branch and open a task PR to GitHub `main`. Merge only after applicable CI/review pass and any task-specific manual check. Keep `prod`/VPS on v0.1.5 until 8.10.1, desktop tasks, 8.10.3 full release QA, real Telegram checks, and deploy-runbook gate are complete.

## Plan self-check

- Every UI operation above maps to an existing MVP route/API; no new server financial behavior is assumed.
- Unit tests target pure decisions; browser tests target actual DOM/focus/network behavior. Neither is a substitute for two-account Telegram-host QA.
- `TabBar` union affects all callers, so player navigation and any other layout using it must be searched and typechecked before commit.
- Worktree remains isolated. A task PR may enter GitHub `main` when complete; this plan does not authorize `prod` or VPS promotion.
