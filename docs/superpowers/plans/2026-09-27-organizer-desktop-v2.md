# Organizer Desktop v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать активному owner/organizer браузерный MVP-кабинет `/app/orgs/:orgId` с общими с Mini App данными и правами.

**Architecture:** Отдельный Nuxt web-layout и страницы поверх существующих session/tenant API; чистые UI-проекции тестируются Vitest, реальные переходы и формы — браузерным smoke. `/m` остаётся без перенаправления. Деньги как операции добавляет только 6.10.1.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, существующие CSS-токены, Vitest, PostgreSQL для общих gates, браузерный smoke.

**Spec:** [2026-09-27-organizer-desktop-v2-design.md](../specs/2026-09-27-organizer-desktop-v2-design.md); SDD [5-15-1-organizer-desktop-v2.md](../../tasks/5-15-1-organizer-desktop-v2.md).

## Global Constraints

- Ветка задачи от актуального `main`; каждый кодовый шаг — red → green → refactor, коммиты с `Task: 5.15.1` и `Release: v0.1.6 (R0.6)`.
- Существующие `/api/organizations/:orgId/**` и серверные права — единственный источник данных и решений; JSX/HTML — только визуальный референс.
- Использовать имеющиеся Bento Bold токены: Oswald 500/600/700 и Golos Text 400/500/600/700; не вводить новую палитру или шрифты.
- `/app` остаётся web и при узком viewport; `/m` остаётся Telegram-first. Не применять Telegram SDK/haptics к desktop.
- `subscriptionsEnabled=false` скрывает планы в основной навигации, но не удаляет данные; настройку меняет только owner.
- Отдельные денежные экраны/операции — 6.10.1; глобальный visual/Telegram QA — 8.10.3; `prod` и VPS не трогать в 5.15.1.

## Review Focus

- Чужой `orgId`, ответ после смены группы или устаревшее подтверждение: не показать старые данные и не послать POST в покинутую группу (Tasks 1, 4–7).
- `/auth/login?redirect=/app/...`, внешний/двойной encoded URL: первый сохранить, второй отвергнуть (Task 1).
- Событие у границы суток в timezone группы, 50+ событий: верный день и отсутствие ложного «полного месяца» (Task 3).
- Organizer против owner, игрок/assistant/pending и отключённые абонементы: совпадение UI с серверным запретом (Tasks 1, 5–7).
- Узкий viewport и 200% zoom, клавиатура, Escape/focus, пустые/ошибочные состояния: действия остаются доступными (Task 8).

## File Map

- `apps/web/app/utils/desktop-org-ui.ts` + `.test.ts`: разрешение доступа, навигация и проверка живого маршрута; существующий `auth-destination.ts` расширяется только для безопасных `/app` redirects.
- `apps/web/app/layouts/desktop-org.vue`, `assets/css/desktop.css`: shell, семантическая навигация, responsive/zoom; `assets/css/main.css` импортирует новый слой.
- `apps/web/app/pages/app/index.vue`, `orgs/new.vue`, `orgs/[orgId]/**`: web-маршруты; каждая страница обращается к тому же endpoint, что соответствующий экран `/m`.
- `apps/web/app/utils/desktop-dashboard.ts`, `desktop-calendar.ts` и тесты: только представление полученных dashboard/event данных, без бизнес-правил.
- `apps/web/app/components/desktop/` — небольшие визуальные блоки shell, обзора и календаря; существующие `EventForm`, `ErrorState`, `EmptyState`, `SkeletonList` переиспользуются.
- `docs/tasks/5-15-1-organizer-desktop-v2.md`: точный статус и evidence после выполнения; 6.10.1 и 8.10.3 не меняются в этой ветке.

---

### Task 1: Доступ, web-вход и shell

**Files:** Modify `apps/web/app/utils/auth-destination.ts`, `.test.ts`, `apps/web/app/utils/auth-flow.test.ts`, `apps/web/app/assets/css/main.css`; Create `apps/web/app/utils/desktop-org-ui.ts`, `.test.ts`, `apps/web/app/layouts/desktop-org.vue`, `apps/web/app/assets/css/desktop.css`, `apps/web/app/pages/app/index.vue`, `apps/web/app/pages/app/orgs/new.vue`.

**Interfaces:** `resolveDesktopOrgAccess(org, member, requestedId, errorStatus?, errorCode?): 'ready'|'login'|'denied'|'suspended'|'error'`; `desktopNavItems(orgId, subscriptionsEnabled): { key; label; to }[]`; `isLiveDesktopRoute(currentPath, expectedPath): boolean`. Pages use `useOrganizations()` and keyed `useFetch` for exact `orgId`; `/app` chooses only active manager groups and `/app/orgs/new` uses `POST /api/organizations`.

- [ ] **Step 1: Write RED tests.** Name the access/nav/route cases and add assertions such as `expect(safeAuthRedirect('/app/orgs/7/events')).toBe('/app/orgs/7/events')`, `expect(safeAuthRedirect('/app/%2f%2fevil.test')).toBeNull()`, `expect(resolveDesktopOrgAccess(org, player, 7)).toBe('denied')`, `expect(desktopNavItems(7, false).some((item) => item.key === 'plans')).toBe(false)` and `expect(isLiveDesktopRoute('/app/orgs/8', '/app/orgs/7')).toBe(false)`. Include assistant, pending, suspended and the existing `/m/invite` regression.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/auth-destination.test.ts apps/web/app/utils/auth-flow.test.ts apps/web/app/utils/desktop-org-ui.test.ts`; expect new assertions to fail for missing `/app` support/utilities.
- [ ] **Step 3: Implement.** Add the three named interfaces and extend safe redirect allowlist without changing Mini App invitation/default email flow; render chooser/new-group and desktop shell with skip link, `aria-current`, org switch and real links. Use `/auth/login?redirect=<encoded /app path>` before any protected shell appears.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect all targeted tests pass.
- [ ] **Step 5: Browser check.** Direct URL, refresh, back/forward, anonymous/player/organizer/owner, group switch, narrow viewport and no `/m` redirect/previous-org flash.
- [ ] **Step 6: Commit.** Stage only Task 1 files; Conventional commit with required `Task`/`Release` trailers.

### Task 2: Обзор с серверными показателями

**Files:** Create `apps/web/app/utils/desktop-dashboard.ts`, `.test.ts`, `apps/web/app/components/desktop/DashboardCards.vue`, `apps/web/app/pages/app/orgs/[orgId]/index.vue`.

**Interfaces:** Define `DashboardResponse` in `desktop-dashboard.ts` from the existing `/dashboard` payload; `desktopDashboardView(data: DashboardResponse | null): { balance; pendingCount; pendingAmount; upcoming } | null` consumes `manager.balance`, `manager.pendingCount`, `manager.pendingAmount`, `upcoming`, not independently counted figures.

- [ ] **Step 1: Write RED test.** Assert `expect(desktopDashboardView(null)).toBeNull()` and `expect(desktopDashboardView(fixture)?.pendingAmount).toBe(2500)` with fixture `manager.balance.currency='BYN'`; assert `upcoming[0]` is preserved and no trend field exists.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-dashboard.test.ts`; expect missing function/failed assertions.
- [ ] **Step 3: Implement.** Map only `/dashboard` fields; compose reference-like balance hero, pending summary and next event with loading/empty/error retry, no payment action until 6.10.1.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Inspect real/empty/error fixtures at 1280 and 1440 px; no fake metrics.
- [ ] **Step 6: Commit.** Stage only Task 2 files with required trailers.

### Task 3: События — список и календарь

**Files:** Create `apps/web/app/utils/desktop-calendar.ts`, `.test.ts`, `apps/web/app/components/desktop/EventCalendar.vue`, `apps/web/app/pages/app/orgs/[orgId]/events/index.vue`.

**Interfaces:** `groupEventsByOrgDay(events: readonly EventListItem[], timeZone: string): Map<string, EventListItem[]>`, ISO `YYYY-MM-DD` keys; `GET /events?filter=upcoming|past|all&limit=50&offset=N`. List/calendar share the loaded array; pagination appends only for the same org/filter.

- [ ] **Step 1: Write RED tests.** For an event at `2026-09-26T22:30:00Z`, assert `expect([...groupEventsByOrgDay([event], 'Europe/Minsk').keys()]).toEqual(['2026-09-27'])`; test empty list, stable same-day order and concatenated pages of 50+ events.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-calendar.test.ts`; expect missing function/failed assertions.
- [ ] **Step 3: Implement.** Use shared loaded array for list/calendar, API paging `limit=50&offset=N`, explicit loaded-range caption and load-more; do not label an incomplete month complete.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Both filters, paging, stale response after group/filter switch, direct event link and timezone boundary.
- [ ] **Step 6: Commit.** Stage only Task 3 files with required trailers.

### Task 4: Событие — деталь, состав и формы

**Files:** Create `apps/web/app/pages/app/orgs/[orgId]/events/new.vue`, `apps/web/app/pages/app/orgs/[orgId]/events/[eventId]/index.vue`, `apps/web/app/pages/app/orgs/[orgId]/events/[eventId]/edit.vue`, `apps/web/app/utils/desktop-event-actions.ts`, `.test.ts`; Modify `apps/web/app/components/EventForm.vue` only for desktop-responsive presentation while preserving default Mini App behavior.

**Interfaces:** `canSubmitDesktopEventAction(currentPath, expectedPath, busy): boolean`; add optional `EventForm.canSubmit?: () => boolean` (default true), checked before venue/event POST without changing its `saved(event)` event or Mini App defaults; existing event, roster, publish, cancel, attendance and booking-cancel endpoints remain unchanged.

- [ ] **Step 1: Write RED tests.** Assert `expect(canSubmitDesktopEventAction('/app/orgs/7/events/9', '/app/orgs/7/events/9', false)).toBe(true)` and false for `/edit`, org 8 and busy. The page must re-evaluate this guard after awaited confirmation and `EventForm.canSubmit` must guard both venue and event POST; exercise those async paths in Step 5.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-event-actions.test.ts`; expect missing guard/failed assertions.
- [ ] **Step 3: Implement.** Render server status/capacity/roster; reuse `EventForm` fields and timezone; publish/cancel/attendance/remove via existing endpoints with web confirmation and live-route guard immediately before POST; refetch after success, preserve view on error.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Create/edit/draft/publish/cancel/attendance, keyboard and route switch before confirmation; ensure Mini App form still works.
- [ ] **Step 6: Commit.** Stage only Task 4 files with required trailers.

### Task 5: Игроки и приглашения

**Files:** Create `apps/web/app/pages/app/orgs/[orgId]/members.vue`, `apps/web/app/pages/app/orgs/[orgId]/invite.vue`, `apps/web/app/utils/desktop-member-actions.ts`, `.test.ts`.

**Interfaces:** `desktopMemberActions(actor, target): ('approve'|'reject'|'block'|'unblock'|'changeRole')[]` mirrors core `canModerate`/owner policy; invite API returns `deeplinkUrl` and exposes player role to organizer, elevated roles only to owner.

- [ ] **Step 1: Write RED tests.** Assert `expect(desktopMemberActions(organizer, owner)).toEqual([])` and owner can moderate another non-owner, while player/pending cannot; include self-target and role-change owner-only cases.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-member-actions.test.ts`; expect missing function/failed assertions.
- [ ] **Step 3: Implement.** Active/pending/blocked tabs, one-at-a-time actions, owner-only role edit, create/copy/revoke group invites through existing API; web confirmation and visible errors, reload after success.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Permission matrix, wrong-org/stale route, API-provided bot deeplink, clipboard failure and keyboard use.
- [ ] **Step 6: Commit.** Stage only Task 5 files with required trailers.

### Task 6: Планы абонементов

**Files:** Create `apps/web/app/pages/app/orgs/[orgId]/plans.vue`, `apps/web/app/utils/desktop-plans.ts`, `.test.ts`.

**Interfaces:** `desktopPlanState(subscriptionsEnabled, plans): { showCreate: boolean; plans }`; `canMutateDesktopPlan(currentPath, expectedPath, subscriptionsEnabled, busy): boolean`; `GET/POST /plans`, `PATCH /plans/:planId`, `POST /plans/:planId/archive`; same `toMinor`/`toMajor` conversion as Mini App.

- [ ] **Step 1: Write RED tests.** Assert `expect(desktopPlanState(false, [plan]).showCreate).toBe(false)`, retained `plan.id`, `expect(canMutateDesktopPlan('/app/orgs/8/plans', '/app/orgs/7/plans', true, false)).toBe(false)` and `toMinor(toMajor(2500))===2500`.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-plans.test.ts`; expect missing functions/failed assertions.
- [ ] **Step 3: Implement.** Real list/create/edit/archive endpoints and shared money conversion; when off, read-only direct-link history with no sales CTA. Refetch after success, show errors.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Enabled/disabled/unknown state, organizer access, stale group switch and form errors.
- [ ] **Step 6: Commit.** Stage only Task 6 files with required trailers.

### Task 7: Настройки организации

**Files:** Create `apps/web/app/pages/app/orgs/[orgId]/settings.vue`, `apps/web/app/utils/desktop-settings.ts`, `.test.ts`; reuse `organizationSettingsPayload` and its tests.

**Interfaces:** `canSaveDesktopSettings(member, currentPath, expectedPath, busy): boolean`; owner-only `PATCH /api/organizations/:orgId` and `POST /archive`; `subscriptionsEnabled` changes only after confirmed refresh.

- [ ] **Step 1: Write RED tests.** Assert `expect(canSaveDesktopSettings(owner, '/app/orgs/7/settings', '/app/orgs/7/settings', false)).toBe(true)` and false for organizer, busy or wrong org; assert `organizationSettingsPayload(form, true)` includes `subscriptionsEnabled:false` only after an off toggle.
- [ ] **Step 2: Verify RED.** Run `pnpm exec vitest run --project unit apps/web/app/utils/desktop-settings.test.ts apps/web/app/utils/organization-settings-payload.test.ts`; expect missing guard/failed assertions.
- [ ] **Step 3: Implement.** Owner edit/read-only organizer state, explicit archive confirmation, pending/success/error feedback, reread confirmed settings and navigation after PATCH.
- [ ] **Step 4: Verify GREEN.** Rerun Step 2 command; expect pass.
- [ ] **Step 5: Browser check.** Denied save, off/on persistence, failed PATCH rollback, plans nav, archive and route switch before destructive confirmation.
- [ ] **Step 6: Commit.** Stage only Task 7 files with required trailers.

### Task 8: Whole-branch verification and handoff

**Files:** Modify `docs/tasks/5-15-1-organizer-desktop-v2.md`; create concise evidence under `docs/operations/qa/` only if needed for reproducible desktop smoke.

- [ ] **Step 1: Verify.** Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` with PostgreSQL, `pnpm build`; record exit codes. No green claim from a subset.
- [ ] **Step 2: Visual/functional QA.** Compare MVP screens to `4 Кабинет организатора.html` at 1280/1440, narrow width and 200% zoom; exercise mouse/keyboard, focus/Escape, direct links/refresh, auth, failures, owner/organizer/player, shared statuses and currency. Record screenshot/evidence and any open mismatch in SDD card; defects get a task before fixes.
- [ ] **Step 3: Review and merge.** Fresh review of branch against spec and SDD; fix findings with RED tests, rerun affected and full gates, then PR/CI and merge into GitHub `main` only if acceptance holds. Leave `prod` and VPS unchanged until 6.10.1, 8.10.3 and full R0.6 candidate are ready.
