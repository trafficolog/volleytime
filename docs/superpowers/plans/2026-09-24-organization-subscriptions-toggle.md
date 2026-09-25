# Organization Subscriptions Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an organization owner a reversible subscription switch that blocks new subscription sales and bookings while preserving existing balances and commitments.

**Architecture:** Store one default-on flag on `organizations`; use the existing owner-only organization PATCH and one core policy check for every new subscription action. Current Mini App surfaces derive navigation and actions from the selected organization's API response and the player's own balance; later R0.6 redesign tasks reuse the same server rule.

**Tech Stack:** TypeScript, Drizzle/PostgreSQL, Nuxt/Vue, h3 API, Vitest, pnpm.

**Spec:** [Organization subscriptions toggle design](../specs/2026-09-24-organization-subscriptions-toggle-design.md), [SDD task 5.13.21](../../tasks/5-13-21-organization-subscriptions-toggle.md).

## Global Constraints

- Work only on Task 5.13.21 in `trafficolog/feat/5.13.21-subscription-toggle`; commit with `Task: 5.13.21` and `Release: v0.1.6` trailers. Do not push `prod`.
- `subscriptionsEnabled` is `boolean NOT NULL DEFAULT true`; existing organizations must retain the current enabled behavior.
- An owner can change the flag; an organizer, assistant, or player cannot. Do not change existing membership and tenant checks.
- With the flag off, reject new plan creation, purchase, and new booking with `method: 'subscription'` in core/API. Preserve cash, transfer, free booking, existing subscriptions, confirmed bookings, and previously entered waitlists.
- A player with an active, unexpired, positive balance sees a read-only subscription entry while off; a player without such a balance does not see the navigation item. Direct authorized history remains readable.
- Do not add a per-event switch, split pricing, multiple seats, online payments, automated reminders, or future-phase screens.
- Use red → green → refactor for every code change. Integration tests need PostgreSQL. Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before the task is called done.

## File Structure

| Responsibility             | Files                                                                                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durable organization state | `packages/db/src/schema/organizations.ts`, generated `packages/db/migrations/0019_*.sql` and `meta` files, `packages/db/src/schema/organizations.test.ts`                                                                     |
| Owner update and audit     | `packages/core/src/organizations/schemas.ts`, `service.ts`, `service.test.ts`, existing `apps/web/server/api/organizations/[orgId]/index.patch.ts`, `apps/web/server/__tests__/phase4-security.integration.test.ts`           |
| One core availability rule | `packages/core/src/organizations/errors.ts`, `service.ts`; callers in `subscription-plans/service.ts`, `subscriptions/service.ts`, `bookings/service.ts`; existing service tests and `apps/web/server/utils/handle-errors.ts` |
| Mini App projection        | New `apps/web/app/utils/subscription-availability.ts` and `.test.ts`; existing `layouts/miniapp-org.vue`, organization home, event detail, subscriptions, plans, settings pages                                               |
| Release evidence           | `docs/tasks/5-13-21-organization-subscriptions-toggle.md`, `docs/operations/status/current-state.md`                                                                                                                          |

## Review Focus

1. A stale client posts `method: 'subscription'` after the owner disables the feature: core/API must return a domain conflict without consuming a session (Task 2 test).
2. A player has a balance in organization A but opens disabled organization B: B must not reveal the subscription tab (Task 3 helper test and browser smoke).
3. A purchase was pending before disable and payment is confirmed afterward: the balance must persist but remain unusable for a new booking until re-enable (Task 2 test).
4. A waitlisted subscription booking predates disable: promotion and later cancellation must keep the old commitment and restore its session (Task 2 test).
5. Saving the switch fails or organization data is unavailable: UI must not claim the new value was saved or offer subscription payment on uncertain state (Task 3 helper test and browser smoke).

---

### Task 1: Persist and expose the owner-controlled organization flag

**Files:**

- Modify: `packages/db/src/schema/organizations.ts`
- Generate: `packages/db/migrations/0019_*.sql`, `packages/db/migrations/meta/0019_snapshot.json`, `packages/db/migrations/meta/_journal.json`
- Modify: `packages/db/src/schema/organizations.test.ts`
- Modify: `packages/core/src/organizations/schemas.ts`, `packages/core/src/organizations/service.test.ts`
- Modify: `apps/web/server/__tests__/phase4-security.integration.test.ts`

**Interfaces:**

- Produces `Organization.subscriptionsEnabled: boolean`, default `true` in both DB and schema.
- Existing `organizationService.update(ctx, orgId, { subscriptionsEnabled: boolean })` and `PATCH /api/organizations/:orgId` expose the value; no new endpoint.
- Tasks 2 and 3 consume the new `Organization` field. Owner-only authorization stays in the existing PATCH handler.

- [ ] **Step 1: Add RED tests for defaults, updates, omitted field, and HTTP permissions.**

In `organizations.test.ts`, extend the existing default test:

```ts
expect(org?.subscriptionsEnabled).toBe(true)
```

In `organizations/service.test.ts`, add:

```ts
it('toggles subscriptions without changing an omitted flag', async () => {
  const org = await organizationService.create(await ctx(), { name: 'Toggle Club' })
  expect(org.subscriptionsEnabled).toBe(true)
  const off = await organizationService.update(await ctx(), org.id, { subscriptionsEnabled: false })
  expect(off.subscriptionsEnabled).toBe(false)
  const renamed = await organizationService.update(await ctx(), org.id, { name: 'Renamed Club' })
  expect(renamed.subscriptionsEnabled).toBe(false)
  const on = await organizationService.update(await ctx(), org.id, { subscriptionsEnabled: true })
  expect(on.subscriptionsEnabled).toBe(true)
})
```

In `phase4-security.integration.test.ts`, use its existing fixtures and real HTTP harness:

```ts
it('only the owner changes subscription availability', async () => {
  const off = await request('PATCH', `/api/organizations/${orgA}`, {
    user: ownerA,
    body: { subscriptionsEnabled: false },
  })
  expect(off.status).toBe(200)
  expect(off.body).toMatchObject({ organization: { subscriptionsEnabled: false } })
  for (const user of [organizerA, playerA]) {
    expect(
      (
        await request('PATCH', `/api/organizations/${orgA}`, {
          user,
          body: { subscriptionsEnabled: true },
        })
      ).status,
    ).toBe(403)
  }
  expect(
    (
      await request('GET', `/api/organizations/${orgA}`, {
        user: playerA,
      })
    ).body,
  ).toMatchObject({ organization: { subscriptionsEnabled: false } })
  expect(
    (
      await request('GET', `/api/organizations/${orgA}`, {
        user: ownerB,
      })
    ).status,
  ).toBe(403)
})
```

- [ ] **Step 2: Run RED tests.**

Run: `pnpm test packages/db/src/schema/organizations.test.ts packages/core/src/organizations/service.test.ts apps/web/server/__tests__/phase4-security.integration.test.ts`

Expected: default/update assertions fail because the field is absent; HTTP update cannot persist it. If the DB lacks the new column after the schema edit, apply the generated test migration before rerunning.

- [ ] **Step 3: Add the minimal schema and input, then generate and apply migration.**

In `organizations.ts`, beside `publicPageEnabled`:

```ts
subscriptionsEnabled: boolean('subscriptions_enabled').notNull().default(true),
```

In `UpdateOrganizationInput`:

```ts
subscriptionsEnabled: z.boolean().optional(),
```

The existing `organizationService.update` spreads validated fields into the DB update and records old/new values in the audit log. Do not duplicate that logic. Generate a migration with `pnpm db:generate`; inspect the generated SQL for `ALTER TABLE "organizations" ADD COLUMN "subscriptions_enabled" boolean DEFAULT true NOT NULL` and the matching journal/snapshot. Apply it to the test database with `pnpm db:migrate:test` and, if running local smoke against the development DB, `pnpm db:migrate`. Do not use `db:push` on production.

- [ ] **Step 4: Run GREEN tests and verify audit.**

Extend the organization service test after the `off` update, importing `auditService`:

```ts
const [change] = await auditService.listByOrg(await ctx(), org.id, {
  action: 'organization.updated',
  entityType: 'organization',
})
expect(change?.oldValue).toMatchObject({ subscriptionsEnabled: true })
expect(change?.newValue).toMatchObject({ subscriptionsEnabled: false })
```

Run the same targeted test command as Step 2; expect all named files green. The HTTP test verifies member visibility and non-member isolation.

- [ ] **Step 5: Commit the isolated deliverable.**

Stage only the schema, migration/meta, and tests. Commit: `feat(org): persist subscription availability` with `Task: 5.13.21` and `Release: v0.1.6` trailers.

### Task 2: Reject only new subscription actions in core and API

**Files:**

- Modify: `packages/core/src/organizations/errors.ts`, `service.ts`
- Modify: `packages/core/src/subscription-plans/service.ts`, `service.test.ts`
- Modify: `packages/core/src/subscriptions/service.ts`, `service.test.ts`
- Modify: `packages/core/src/bookings/service.ts`, `service.test.ts`, `cancel.integration.test.ts`
- Modify: `apps/web/server/utils/handle-errors.ts`, `handle-errors.test.ts`
- Create: `apps/web/server/__tests__/subscription-toggle.integration.test.ts`

**Interfaces:**

- Produces `OrganizationSubscriptionsDisabledError` with code `organization.subscriptions_disabled`, HTTP 409.
- Produces `organizationService.requireSubscriptionsEnabled(ctx: ServiceContext, orgId: number): Promise<void>`; call within the existing transaction for plan creation, purchase, and new subscription booking.
- Never call the guard from `activate`, `consumeSession` during promotion, `restoreSession`, `cancel`, or read methods: these preserve commitments made before disable.

- [ ] **Step 1: Add RED integration tests for all three prohibited writes and unaffected paths.**

Use the existing fixtures in `subscription-plans/service.test.ts`, `subscriptions/service.test.ts`, and `bookings/service.test.ts`. Create the plan and paid event **before** switching off, then assert the following real service calls reject with `{ code: 'organization.subscriptions_disabled' }`:

```ts
await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: false })
await expect(
  planService.create(
    { userId: ownerId },
    {
      organizationId: orgId,
      name: 'New',
      totalSessions: 4,
      price: 4000,
    },
  ),
).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
await expect(
  subscriptionService.purchase({ userId: playerId }, orgId, plan.id, {
    method: 'cash',
  }),
).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
await expect(
  bookingService.book({ userId: playerId }, orgId, event.id, {
    method: 'subscription',
    subscriptionId: sub.id,
  }),
).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
```

Add assertions that cash and transfer still book paid events, free still books free events, and `sub.usedSessions` does not change after rejection. In `subscriptions/service.test.ts`, add this sequence using its existing `makePlan`, `ownerId`, `playerId`, and `orgId` fixtures:

```ts
const plan = await makePlan()
const { subscription, paymentId } = await subscriptionService.purchase(
  { userId: playerId },
  orgId,
  plan.id,
  { method: 'cash' },
)
await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: false })
await paymentService.confirm({ userId: ownerId }, paymentId!, { orgId })
expect((await subscriptionService.getById({ userId: playerId }, subscription.id)).status).toBe(
  'active',
)
await organizationService.update({ userId: ownerId }, orgId, { subscriptionsEnabled: true })
expect(
  (await subscriptionService.consumeSession({ userId: playerId }, orgId, subscription.id))
    .usedSessions,
).toBe(1)
```

In `bookings/cancel.integration.test.ts`, extend the existing capacity-one subscription promotion case: switch the organization off immediately before the first cancellation, then assert the preexisting waiter is promoted and its session consumed; cancel that promoted booking and assert its session is restored. Also assert a new subscription booking is rejected while off. This tests preservation of an old commitment, not permission to create a new one.

- [ ] **Step 2: Run RED tests.**

Run: `pnpm test packages/core/src/subscription-plans/service.test.ts packages/core/src/subscriptions/service.test.ts packages/core/src/bookings/service.test.ts packages/core/src/bookings/cancel.integration.test.ts`

Expected: prohibited writes unexpectedly succeed, so their new assertions fail. Tests for existing commitments should already pass; do not weaken them to force red.

- [ ] **Step 3: Add one error and one guard, then call it at new-write boundaries.**

In `organizations/errors.ts`:

```ts
export class OrganizationSubscriptionsDisabledError extends OrganizationError {
  constructor() {
    super('organization.subscriptions_disabled', 'Subscriptions are disabled for this organization')
  }
}
```

In `organizations/service.ts`, add to `organizationService`:

```ts
async requireSubscriptionsEnabled(ctx: ServiceContext, orgId: number): Promise<void> {
  const [org] = await getDb(ctx)
    .select({ subscriptionsEnabled: organizations.subscriptionsEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('share')
  if (!org) throw new OrganizationNotFoundError(orgId)
  if (!org.subscriptionsEnabled) throw new OrganizationSubscriptionsDisabledError()
},
```

Import `organizationService` and call the guard inside the three existing transactions:

```ts
// planService.create, before the INSERT
await organizationService.requireSubscriptionsEnabled(tx, data.organizationId)
// subscriptionService.purchase, before creating a subscription or payment
await organizationService.requireSubscriptionsEnabled(tx, orgId)
// bookingService.book, after active membership check and before booking mutation
if (parsed.method === 'subscription') {
  await organizationService.requireSubscriptionsEnabled({ ...ctx, db: tx }, orgId)
}
```

Do not add the guard to `subscriptionService.createFromPlan` because `purchase` is its sole production caller and holds the transaction; the direct helper is documented as internal/test-only. Add `'organization.subscriptions_disabled': 409` to `CODE_STATUS` in `handle-errors.ts`.

- [ ] **Step 4: Verify HTTP behavior through the real API harness.**

In new `subscription-toggle.integration.test.ts`, use `createTestApi()` and the same `beforeAll`/`beforeEach` database fixture shape as `phase5-security.integration.test.ts`: owner and player, organization and active player membership, existing plan, active subscription, and paid published event. After owner PATCH false, exercise these HTTP calls:

```ts
const off = await request('PATCH', `/api/organizations/${orgId}`, {
  user: ownerId,
  body: { subscriptionsEnabled: false },
})
expect(off.status).toBe(200)
const denied = [
  await request('POST', `/api/organizations/${orgId}/plans`, {
    user: ownerId,
    body: { name: 'Another', totalSessions: 4, price: 4000 },
  }),
  await request('POST', `/api/organizations/${orgId}/subscriptions`, {
    user: playerId,
    body: { planId: plan.id, method: 'cash' },
  }),
  await request('POST', `/api/organizations/${orgId}/events/${event.id}/bookings`, {
    user: playerId,
    body: { method: 'subscription', subscriptionId: sub.id },
  }),
]
for (const response of denied) {
  expect(response.status).toBe(409)
  expect(response.body).toMatchObject({ data: { code: 'organization.subscriptions_disabled' } })
}
expect(
  (
    await request('GET', `/api/organizations/${orgId}/subscriptions/my`, {
      user: playerId,
    })
  ).body,
).toMatchObject({ subscriptions: [expect.objectContaining({ id: sub.id })] })
```

Assert a cash booking still returns 200 in this fixture, and add a unit assertion in `handle-errors.test.ts` that the new error maps to 409/code. Run:

`pnpm test apps/web/server/__tests__/subscription-toggle.integration.test.ts apps/web/server/utils/handle-errors.test.ts packages/core/src/subscription-plans/service.test.ts packages/core/src/subscriptions/service.test.ts packages/core/src/bookings/service.test.ts packages/core/src/bookings/cancel.integration.test.ts`

Expected: all targeted files green. Inspect the failed POST response bodies rather than checking status only. The `FOR SHARE` read holds a row lock until the enclosing transaction commits; the owner's UPDATE conflicts with that lock, so a completed disable cannot be overtaken by a new subscription write. Keep this lock in the transaction-bound guard rather than relying on a nonlocking cached organization object.

- [ ] **Step 5: Commit the isolated deliverable.**

Stage only the listed core/API/test files. Commit: `feat(subscriptions): enforce organization availability` with `Task: 5.13.21` and `Release: v0.1.6` trailers.

### Task 3: Show the switch and project read-only balances in the current Mini App

**Files:**

- Create: `apps/web/app/utils/subscription-availability.ts`, `.test.ts`
- Modify: `apps/web/app/layouts/miniapp-org.vue`
- Modify: `apps/web/app/pages/m/orgs/[orgId]/index.vue`, `events/[eventId]/index.vue`, `subscriptions.vue`, `plans.vue`, `settings.vue`
- Modify: `docs/tasks/5-13-21-organization-subscriptions-toggle.md`, `docs/operations/status/current-state.md`

**Interfaces:**

- Produces `subscriptionUiState(enabled: boolean | null, orgId: number, subscriptions: readonly SubscriptionBalance[], now?: Date): { showMenu: boolean; allowPurchase: boolean; allowBooking: boolean; readOnly: boolean }` in one pure helper. `SubscriptionBalance` contains `organizationId`, `status`, `usedSessions`, `totalSessions`, and `expiresAt` (`Date | string | null`).
- All views use the selected organization's `GET /api/organizations/:orgId` response. `/subscriptions/my` remains readable while disabled. No localStorage copy of the flag.

- [ ] **Step 1: Add RED tests for the state matrix.**

In `subscription-availability.test.ts`, call the not-yet-existing `subscriptionUiState` with: enabled and no balance; disabled and active balance; disabled and only pending/exhausted/expired; unknown flag and active balance; balance belonging only to another organization. Assert `showMenu`, `allowPurchase`, `allowBooking`, and `readOnly` exactly. Example:

```ts
const active = {
  organizationId: 1,
  status: 'active',
  usedSessions: 3,
  totalSessions: 8,
  expiresAt: null,
}
expect(subscriptionUiState(false, 1, [active])).toEqual({
  showMenu: true,
  allowPurchase: false,
  allowBooking: false,
  readOnly: true,
})
expect(subscriptionUiState(false, 2, [active])).toEqual({
  showMenu: false,
  allowPurchase: false,
  allowBooking: false,
  readOnly: false,
})
expect(subscriptionUiState(false, 1, [])).toEqual({
  showMenu: false,
  allowPurchase: false,
  allowBooking: false,
  readOnly: false,
})
expect(subscriptionUiState(null, 1, [])).toMatchObject({
  allowPurchase: false,
  allowBooking: false,
})
```

- [ ] **Step 2: Run RED test.**

Run: `pnpm test apps/web/app/utils/subscription-availability.test.ts`

Expected: module/function missing. Do not create the helper before observing this failure.

- [ ] **Step 3: Implement the minimal pure rule and wire existing views.**

Create the helper:

```ts
export interface SubscriptionBalance {
  organizationId: number
  status: string
  usedSessions: number
  totalSessions: number
  expiresAt: Date | string | null
}

export function subscriptionUiState(
  enabled: boolean | null,
  orgId: number,
  subscriptions: readonly SubscriptionBalance[],
  now = new Date(),
) {
  const hasBalance = subscriptions.some(
    (s) =>
      s.organizationId === orgId &&
      s.status === 'active' &&
      s.usedSessions < s.totalSessions &&
      (s.expiresAt == null || new Date(s.expiresAt) > now),
  )
  return {
    showMenu: enabled === true || hasBalance,
    allowPurchase: enabled === true,
    allowBooking: enabled === true,
    readOnly: enabled !== true && hasBalance,
  }
}
```

In `miniapp-org.vue`, extend the current organization fetch to include `organization.subscriptionsEnabled` and fetch `/subscriptions/my` with a key scoped to `orgId`. Recompute on `orgId` and route change so purchase/activation changes the tab; use `subscriptionUiState` to conditionally include the `Абонементы` tab:

```ts
const { data: balanceData, refresh: refreshBalances } = await useFetch<{
  subscriptions: SubscriptionBalance[]
}>(() => `/api/organizations/${orgId.value}/subscriptions/my`, {
  key: () => `org-nav-balances-${orgId.value}`,
})
watch(() => route.fullPath, () => { void refreshBalances() })
const availability = computed(() => subscriptionUiState(
  data.value?.organization?.subscriptionsEnabled ?? null,
  orgId.value,
  balanceData.value?.subscriptions ?? [],
))
// append to the existing player tab array
...(availability.value.showMenu
  ? [{ to: `${base.value}/subscriptions`, label: 'Абонементы', icon: 'card' }]
  : []),
```

If the organization request fails, pass `null` rather than defaulting to `true`. The helper's `orgId` filter prevents a previous group's response from revealing the new group's menu.

In `subscriptions.vue`, fetch the organization flag before showing plans or purchase controls. Continue loading and showing the player's own current/history subscriptions while disabled; show a concise pause explanation and hide purchase actions. Tie every client-side action to the confirmed value, for example:

```ts
const { data: orgData, error: orgError } = await useFetch<{
  organization: { subscriptionsEnabled: boolean }
}>(() => `/api/organizations/${orgId.value}`)
const availability = computed(() =>
  subscriptionUiState(
    orgError.value ? null : (orgData.value?.organization.subscriptionsEnabled ?? null),
    orgId.value,
    subs.value,
  ),
)
if (!availability.value.allowPurchase || !buyPlan.value) return
```

Insert that guard as the first statement of the existing `buy` function; preserve its request, refresh, and error handling. Render the buy section and `VtSheet` only while `allowPurchase` is true; close `buyPlan` when the flag changes to false so a previously open sheet cannot remain actionable.

In `events/[eventId]/index.vue`, include the organization flag in the existing `orgData`; fetch/use subscriptions only when `subscriptionsEnabled === true`, hide the subscription booking option otherwise, and leave cash/transfer/free intact. In group home, keep the existing balance card only when its actual dashboard balance exists; it links to the read-only page while off. Hide the manager's `/plans` shortcut in group home when the flag is off, without blocking the authorized direct route to existing plans. In `plans.vue`, read the same confirmed flag and gate `create()` and its button; keep existing-plan read/archive reachable from an authorized direct link.

In `settings.vue`, add `subscriptionsEnabled` to the form and PATCH body, use a labelled switch/checkbox with explanation, and display the server-confirmed state after `refreshOrg()`:

```ts
// reactive form and syncForm
subscriptionsEnabled: true,
form.subscriptionsEnabled = value.subscriptionsEnabled
// PATCH body
subscriptionsEnabled: form.subscriptionsEnabled,
// catch (e), before existing error/haptic handling
if (org.value) form.subscriptionsEnabled = org.value.subscriptionsEnabled
```

The checkbox is disabled during save; on failure the visible state returns to the last server-confirmed value. Existing owner-only gate stays unchanged.

- [ ] **Step 4: Run GREEN tests and visual behavior checks.**

Run `pnpm test apps/web/app/utils/subscription-availability.test.ts`; expect every matrix case green. Run full `pnpm test` to catch cross-layer regressions. In a local browser at 320 and 390 px in light and Telegram-dark themes, use an owner and a player to verify: switch save/failure, enabled/disabled navigation, read-only active balance, hidden tab without balance, direct history URL, booking method list, and group switch. Use real local API data, not prototype fixtures. Record which checks were local browser smoke; leave real Telegram-host QA open for 8.10.3.

- [ ] **Step 5: Run release gates, reconcile status, and commit.**

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Apply the migration to the test DB before integration tests. If any gate fails, resolve it within this task. Update the SDD card status only after its acceptance criteria are actually evidenced; record local smoke and any remaining Telegram QA limitation in the card/current-state. Stage only Task 3 files and evidence docs. Commit: `feat(miniapp): honor organization subscription switch` with `Task: 5.13.21` and `Release: v0.1.6` trailers.

## Completion and promotion boundary

Check `git diff --check`, the full gate outputs, migration SQL, task criteria, and branch diff against local `main`. Do not mark 8.10.1, 8.10.2, 5.15.1, 8.10.3, R0.6, Telegram QA, or production acceptance complete from this task. Publication follows the repository's task branch → GitHub `main` flow only after review and green CI; `prod` remains unchanged until the full R0.6 release gate is met.
