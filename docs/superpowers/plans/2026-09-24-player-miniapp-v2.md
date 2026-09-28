# Task 8.10.1 — Player Mini App v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the cleaned v2 reference on the MVP player home, event, booking, subscriptions, profile and onboarding flows without replacing their real API-backed behavior.

**Architecture:** Recompose existing Nuxt pages and the `miniapp-org` layout; add only small pure UI selectors and request guards where they make state testable. Keep server contracts, authorization, Telegram MainButton, organizational subscription policy and organizer navigation intact. Complete one RED → GREEN → REFACTOR cycle per screen/flow before moving on.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, existing Bento Bold CSS/components, Vitest unit/integration projects, pnpm 12.4.1. Visual reference: cleaned `Volley Time v2.zip` / `screens-player.jsx` (SHA-256 recorded in spec).

**Spec:** [Approved player Mini App v2 design](../specs/2026-09-24-player-miniapp-v2-design.md); SDD [8.10.1](../../tasks/8-10-1-player-miniapp-v2.md). `docs/DEVELOPMENT_PROCESS.md`, `docs/RELEASES.md` and `AGENTS.md` govern completion.

## Global Constraints

- Execute on `trafficolog/feat/8.10.1-player-miniapp-v2`, based on GitHub `main` after 3.11.2 and 5.13.21; preserve the unrelated divergent local `main` and draft auth PR. First verify worktree/remote state. Do not rebase onto unfinished auth or move `prod`.
- Work through the existing 8.10.1 SDD card. If a domain/API behavior must change, amend the card and seek review before writing that code. No fake names, counts, participation percentages, profile editing, multi-seat, contributions, online payment or phase 10+ features.
- A page never trusts a previous group's data. Key requests by route identifiers, clear group-scoped state at switch, check response IDs or use a request generation guard, and fail closed if organization/membership is unknown. Mutations retain server-side authorization and leave the old visible state on failure.
- Player navigation only: Home, Bookings, conditional Subscriptions, Profile. Event list remains reachable from Home and direct links. Do not alter the organizer tab bar (8.10.2), shared domain contracts, or production. Reuse 3.11.1/3.11.2 tokens and atoms.
- For every code change write focused failing Vitest assertions, run them to observe RED, implement minimally, rerun to GREEN, refactor while green. Tests on string fragments alone are insufficient for state logic; pure selectors/request guards need behavior tests. A failing test caused by missing dependencies or an invalid harness is not a valid RED.
- Each implementation commit uses Conventional Commits and trailers `Task: 8.10.1` and `Release: v0.1.6`. The final task cannot be marked `done` or merged merely because repository tests pass; recorded browser/functional QA and review findings must be closed. Real Telegram-host QA is a distinct 8.10.3 release gate.

## File Ownership / Responsibility

| Surface                 | Existing files / intended change                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home and event list     | `apps/web/app/pages/m/orgs/[orgId]/index.vue`, `events/index.vue`, `apps/web/app/components/EventCard.vue`; player-only composition with manager view preserved                                                             |
| Group-scoped projection | `apps/web/app/utils/player-home.ts` + `.test.ts` (new), and only if needed `player-request-guard.ts` + `.test.ts`; no new API                                                                                               |
| Navigation and profile  | `apps/web/app/layouts/miniapp-org.vue`, `apps/web/app/pages/m/orgs/[orgId]/profile.vue` (new), `apps/web/app/utils/player-navigation.ts` + `.test.ts` (new); `useAuth.ts` and `useOrganizations.ts` remain sources of truth |
| Event and booking       | `apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/index.vue`, `bookings.vue`, `apps/web/app/utils/player-event.ts` + `.test.ts` (new if state projection is needed); existing POST endpoints unchanged                    |
| Subscriptions           | `apps/web/app/pages/m/orgs/[orgId]/subscriptions.vue`; extend `subscription-availability.test.ts`, `subscription-view-loader.test.ts` and existing helpers only for discovered gaps                                         |
| Onboarding              | `apps/web/app/pages/m/orgs/index.vue`, `apps/web/app/pages/m/invite/[token].vue`; existing invite parsing/redeem untouched                                                                                                  |
| Evidence and SDD state  | `docs/tasks/8-10-1-player-miniapp-v2.md`, `docs/operations/status/current-state.md`, task-specific QA evidence under `docs/operations/status/` only after verification                                                      |

## Review Focus

1. Group A's late dashboard, event, booking or balance response arriving after selecting group B must not appear in B. Add explicit deferred-promise tests in Tasks 1, 2, 4 and 5 where their loaders mutate local state.
2. Disabled subscriptions with a valid balance are read-only and visible, while disabled without a valid balance hides the tab but retains an authorized direct history URL. Test Task 2 navigation and Task 4 page/mutation behavior.
3. Event capacity, status, membership or payment eligibility changing between render and booking POST must keep the server rejection and the prior UI status; no optimistic success. Test Task 3, including free/cash/transfer/subscription and waitlist paths.
4. Cancellation deadline passing between display and POST must surface the server error, preserve the booking and not claim cancellation. Test Task 3 detail and Task 5 bookings list.
5. Missing user name/e-mail/session and pending/suspended group access must never generate personal data or expose booking/purchase actions. Test Task 2 profile/switcher and Task 1 fail-closed home.

---

## Task 0: Verify baseline and map the reference

**Files:** Read `docs/tasks/8-10-1-player-miniapp-v2.md`, the approved spec, `docs/design/2026-09-23-reference-v2.md`, the seven current page/layout files in the ownership map, and cleaned `screens-player.jsx`; no product writes.

- [ ] Run `git status --short --branch`, `git merge-base HEAD origin/main`, and `git log -1 --format="%H %s" origin/main`. Expected: intended isolated branch, no unexplained worktree edits, reviewed base. If remote advanced, assess its commits before integrating; do not overwrite this branch.
- [ ] Record a section-by-section mapping for Home, Event, Book, Subs, Profile and Onboard in the 8.10.1 task card: reference section → current route → API field → MVP adaptation / excluded mock. This is the visual acceptance checklist, not a new source of domain truth.
- [ ] Confirm package dependencies and test DB availability. If missing, install dependencies with `pnpm install --frozen-lockfile`; use the documented test PostgreSQL setup for integration gates. Run baseline focused tests: `pnpm exec vitest run --project unit apps/web/app/utils/subscription-availability.test.ts apps/web/app/utils/subscription-view-loader.test.ts`. Expected: green before edits.
- [ ] Update task status to `in_progress` only after this baseline and card mapping are in place. Commit documentation with `docs(8.10.1): map player v2 MVP screens` and required trailers.

## Task 1: Home, event discovery and stale-group isolation

**Files:** Add `apps/web/app/utils/player-home.ts` and `.test.ts`; edit `apps/web/app/pages/m/orgs/[orgId]/index.vue` and, only as needed for visual consistency, `events/index.vue` / `EventCard.vue`.

- [ ] RED: test a pure `projectPlayerHome(upcoming, now)` returning the nearest published future event as hero and remaining future events in order. Cases: unsorted input, draft/cancelled/past entries, empty list, `taken/capacity` unchanged. Begin with a fixture matching `EventListItem`, e.g.:

  ```ts
  const view = projectPlayerHome([past, later, draft, nearer], new Date('2026-09-24T10:00:00Z'))
  expect(view.hero?.id).toBe(nearer.id)
  expect(view.schedule.map((event) => event.id)).toEqual([later.id])
  expect(view.hero?.taken).toBe(nearer.taken)
  ```

  Never invent an event or attendance percentage.

- [ ] Run `pnpm exec vitest run --project unit apps/web/app/utils/player-home.test.ts`. Expected RED: missing projection or incorrect nearest-event selection, not test setup failure.
- [ ] GREEN: implement the smallest pure selector using the existing `EventListItem` shape. Recompose only the player branch of Home into group header/switcher trigger, one hero, bookings/subscription context and schedule; keep manager metrics/management links intact. Give «Все события» a prominent link to the existing events route. Loading, empty, HTTP/auth failure and pending membership have distinct states; unknown org ID never exposes booking CTA.
- [ ] RED: add a deferred-result test for a small `createPlayerRequestGuard(getKey)` helper: start group A, switch to B, resolve B then A; only B can commit. A key is `${orgId}:${resource}` (and `${eventId}` where relevant). Example:

  ```ts
  const guard = createPlayerRequestGuard(() => activeOrgId)
  const a = guard.begin()
  activeOrgId = 2
  const b = guard.begin()
  expect(b.isCurrent()).toBe(true)
  expect(a.isCurrent()).toBe(false)
  ```

  Run the same focused command including `player-request-guard.test.ts`; expected RED from stale A commit.

- [ ] GREEN: key `useFetch` by org ID and check returned `organization.id`; clear dependent Home data on route change. If Nuxt fetch data lacks an embedded org ID, gate its display by the active key/generation. Apply the guard to any manual event-list fetch on this route. Keep errors retryable, not rendered as empty success.
- [ ] REFACTOR: verify 16 px inline, 12 px card and ≥24 px section spacing, semantic heading order, real `taken/capacity`, and no fake metrics. Rerun focused tests, then commit `feat(miniapp): compose player home from live data` with trailers.

## Task 2: Player navigation, group switcher and real-data profile

**Files:** Add `apps/web/app/utils/player-navigation.ts` and `.test.ts`, `apps/web/app/pages/m/orgs/[orgId]/profile.vue`; edit `apps/web/app/layouts/miniapp-org.vue` and Home header; reuse `apps/web/app/components/vt/Sheet.vue`.

- [ ] RED: test `playerTabs(base, availability)` for 3 tabs when disabled/no balance, 4 when enabled or valid read-only balance, and stable links Home/Bookings/Profile. Example:

  ```ts
  expect(playerTabs('/m/orgs/2', { showMenu: false }).map((tab) => tab.label)).toEqual([
    'Главная',
    'Записи',
    'Профиль',
  ])
  expect(playerTabs('/m/orgs/2', { showMenu: true }).map((tab) => tab.label)).toEqual([
    'Главная',
    'Записи',
    'Абонементы',
    'Профиль',
  ])
  ```

  Run `pnpm exec vitest run --project unit apps/web/app/utils/player-navigation.test.ts`; expected RED on missing function. Verify the separate Home → event-list link in browser smoke; it is not a property of `playerTabs`.

- [ ] GREEN: change only the non-manager branch of `miniapp-org.vue` to this projection. Keep manager tabs unchanged. Derive both manager role and availability from the currently selected organization's response and balance only; when org or membership is unresolved, hide actions. Direct `/subscriptions` remains governed by auth/API rather than menu visibility.
- [ ] RED: add tests for group-switcher projection: active groups selectable; pending/suspended labelled and informational, never booking-enabled; unknown/loading/error cannot select. Cover group A→B change before A's response resolves. Run focused tests and see the new assertions fail.
- [ ] GREEN: populate a `VtSheet` from `useOrganizations().fetchAll()`, call `selectOrg(id)` for an active group and navigate to its Home; retain `/m/orgs` as the informational destination for pending/suspended and invitation entry. Do not fabricate unavailable group fields. Ensure opening, Escape/close and focus return are usable; if shared `VtSheet` needs a focus-return fix, add a focused test and keep the shared change small.
- [ ] RED: test a `playerProfileFields(user)` projection with null name/e-mail/Telegram username and logged-out user; output only known user fields, no invented initials/e-mail/stats. Run focused tests; expected RED on missing projection.
- [ ] GREEN: add the auth-protected Profile route using `useAuth().user` and current org membership. Show actual fields and links to My Groups, invite entry and Bookings; no edit buttons or unsupported endpoint. Session loss uses existing auth middleware; pending/suspended access uses existing informational state.
- [ ] REFACTOR: check keyboard names, 44 px targets, focus-visible and stable 3/4-tab layout at 320 px; rerun focused and existing subscription-availability tests. Commit `feat(miniapp): add player navigation and profile` with trailers.

## Task 3: Event detail and booking without domain drift

**Files:** Edit `apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/index.vue`; add `apps/web/app/utils/player-event.ts` and `.test.ts` only for event/booking state selection, not duplicate server rules.

- [ ] RED: test a pure `projectPlayerEvent(event, subscriptionsEnabled, now)` view projection covering published/bookable, full/waitlist, draft/cancelled/started, `pending_payment`, `confirmed`, `waitlisted`, `cancelled`, `attended` and `no_show`. Test that unknown org setting omits subscription method; free skips paid method sheet; paid allows cash/transfer plus eligible subscription only when enabled. Example:

  ```ts
  expect(projectPlayerEvent(fullPaidEvent, false, now).action).toBe('waitlist')
  expect(projectPlayerEvent(fullPaidEvent, false, now).paymentMethods).toEqual(['cash', 'transfer'])
  expect(projectPlayerEvent(freeEvent, true, now).paymentMethods).toEqual(['free'])
  ```

  Run `pnpm exec vitest run --project unit apps/web/app/utils/player-event.test.ts`; expected RED on missing projection.

- [ ] GREEN: recompose detail as hero → time/venue/price → roster/capacity → booking status/action. Keep existing `POST /events/{eventId}/bookings`, `POST /bookings/{bookingId}/cancel`, Telegram MainButton and outside-Telegram action bar. All labels come from actual event/booking data. Keep the server as final authority for capacity, deadline and payment eligibility.
- [ ] RED: add a mutation-state test (small injected handler or state adapter, not a mocked success screen): when booking POST rejects after capacity/status changes, show `apiErrorMessage`, preserve prior booking and do not emit success; when cancellation POST rejects after deadline, preserve booking and explain the error. Cover waitlist, cash, transfer, subscription and free request bodies with only allowed fields. Run focused test; expected RED on failed handling.
- [ ] GREEN: keep mutation updates only after successful POST and refresh the event/dashboard/balance as applicable; close sheets only on success. Prevent duplicate submits, clear stale method choices on org/event switch, and ensure a late event A response cannot overwrite event B. Leave no option to spend an existing balance while subscriptions are disabled.
- [ ] REFACTOR: check status text independent of chip color, roster empty, error retry, CTA safe-area/tabbar overlap, and unchanged manager manage-link. Rerun focused tests and commit `feat(miniapp): align player event and booking states` with trailers.

## Task 4: Subscription page and organization toggle

**Files:** Edit `apps/web/app/pages/m/orgs/[orgId]/subscriptions.vue`; extend `apps/web/app/utils/subscription-availability.test.ts`, `subscription-view-loader.test.ts` and helpers only where a real missing guard is found.

- [ ] RED: extend existing tests for enabled/no balance, disabled/active positive unexpired balance (menu and history visible, purchase/booking false), disabled/no valid balance (menu hidden, direct authorized history route still works), expired/exhausted/pending balances, unknown setting and another organization's balance. Run `pnpm exec vitest run --project unit apps/web/app/utils/subscription-availability.test.ts apps/web/app/utils/subscription-view-loader.test.ts`; any new gap must show RED.
- [ ] GREEN: arrange current balance, pending payment, plans/purchase and history per reference with real API values. When disabled, retain active balance/history and explanation but remove purchase controls. Existing `createSubscriptionViewLoader` must discard late group-A subscriptions/plans after switching to B; clear visible A state before B fetch. Opening an old purchase sheet then disabling the setting must close it and prevent POST.
- [ ] RED/GREEN for mutation races: test or instrument a tiny guard so disabling between sheet opening and `buy()` prevents the client POST; server rejection after a valid click leaves purchase pending state unchanged and shows error. Do not weaken server checks.
- [ ] REFACTOR: verify direct URL, no balance, pending, expired and read-only states; rerun focused tests. Commit `feat(miniapp): align subscription states with organization policy` with trailers.

## Task 5: Bookings list and onboarding navigation

**Files:** Edit `apps/web/app/pages/m/orgs/[orgId]/bookings.vue`, `apps/web/app/pages/m/orgs/index.vue`, `apps/web/app/pages/m/invite/[token].vue`; add focused `.test.ts` utilities only where data-state behavior is extracted.

- [ ] RED: add `apps/web/app/utils/player-bookings-loader.ts` and `.test.ts` for the bookings loader's group/filter identity with deferred responses: group A/upcoming starts, B/past finishes first, A finishes later; only B/past remains. Test failed cancellation after deadline preserves the row and error while success reloads. Example assertions:

  ```ts
  expect(await staleA).toEqual({ stale: true })
  expect(await currentB).toMatchObject({ stale: false, bookings: bPastBookings })
  expect(rowsAfterRejectedCancel).toEqual(rowsBeforeCancel)
  ```

  Run `pnpm exec vitest run --project unit apps/web/app/utils/player-bookings-loader.test.ts`; expected RED on stale commit or lost row.

- [ ] GREEN: recompose Upcoming/Past cards and status/empty/error states from actual bookings, guard request generation on org/filter changes, and keep existing server cancellation endpoint/confirmation. Clicking any row opens its real event detail; no cancellation success is implied before POST succeeds.
- [ ] RED: add `apps/web/app/utils/player-onboarding.test.ts` for a narrow SFC contract plus extracted state projection where necessary: empty groups → invite/create, pending → information, valid invitation → redeem, expired/revoked/blocked → explanation and group link. Keep invalid input error visible. Run `pnpm exec vitest run --project unit apps/web/app/utils/player-onboarding.test.ts`; expected RED on the intended UI/state gap, not a mere absent snapshot.
- [ ] GREEN: align onboarding and invite composition with the reference while preserving `parseInviteInput`, token encoding, redeem POST, Telegram MainButton and pending/blocked rules. No new onboarding API or action. Keep links between Home, all events, booking detail, subscriptions, profile, groups and invite reachable.
- [ ] REFACTOR: keyboard/tab order, 200% zoom and touch targets; rerun focused tests and commit `feat(miniapp): align bookings and onboarding` with trailers.

## Task 6: End-to-end visual/functional evidence, gates and handoff

**Files:** Update only the task card and task-specific QA/status evidence after verification; fix discovered defects via RED → GREEN within the owning task, with a separate review-fix SDD card if scope materially changes.

- [ ] Run full required gates from repo root: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Expected: all exit 0. Integration tests require the configured PostgreSQL test DB; document exact missing prerequisite if unavailable instead of calling the suite green.
- [ ] Run a real browser against a local build/dev server with controlled test accounts/API fixtures. At 320 and 390 CSS px in light and Telegram-dark theme, compare each MVP screen to the cleaned reference: Home, event list/detail, booking choice/status, subscriptions enabled/disabled/read-only, Bookings, Profile, My Groups and Invite. Capture screenshots or a reproducible matrix. Check 200% zoom, keyboard navigation/focus return, reduced motion and CTA/safe-area overlap. Use no fake production records.
- [ ] Functional smoke: actual allowed booking/waitlist/cancel flows, free/cash/transfer/subscription paths, server rejection after stale capacity/deadline, group A→B while requests are in flight, direct history URL when menu hidden, session loss and pending/suspended membership. Record what was really exercised; repository tests are not a substitute.
- [ ] Review the branch against SDD/spec/reference with an independent code review as available. Resolve findings with tests. Update the task card, `docs/operations/status/current-state.md` and QA record with exact evidence, open gaps and the separate real Telegram-host 8.10.3 gate. Do not mark `done` if a required 8.10.1 criterion remains unverified.
- [ ] Commit evidence/status with Task/Release trailers. Push this task branch, create a PR to GitHub `main`, attach it to the task, wait for applicable CI, and merge only after acceptance/review. Do not advance `prod` or deploy R0.6; the release-wide QA gate remains separate.

## Plan self-review before execution

- [ ] Every approved-spec route and state maps to an owning task; task exclusions and organizer boundary are explicit.
- [ ] Every added helper has a named consumer and a behavior test; no placeholder files, APIs or fabricated model fields.
- [ ] RED commands select the correct Vitest `unit` project and fail for behavior, not environment; green/refactor commands and five full gates are named.
- [ ] Five review-focus risks have an explicit test in an owning task; request-race checks cover both organization and filter/event changes.
- [ ] Browser, Telegram-host and release gates are clearly distinct; GitHub `main` may receive this task only after its own acceptance, while `prod` stays unchanged.
