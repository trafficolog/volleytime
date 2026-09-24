# Design Tokens v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Nuxt MVP consume the final Bento Bold palette, typography and spacing tokens from the cleaned 2026-09-24 reference.

**Architecture:** Keep CSS custom properties as the single theme source, Tailwind as a mapping to them, and Telegram theme overrides scoped to Mini App. This task changes no domain logic or screen structure; atoms and routes have their own SDD tasks.

**Tech Stack:** Nuxt 4, Tailwind CSS, Vitest, CSS custom properties.

**Spec:** `docs/tasks/3-11-1-design-tokens-v2.md`; token inventory in `docs/design/2026-09-23-reference-v2.md`.

## Global Constraints

- Source: cleaned `Volley Time v2.zip/styles.css` single `:root` and `.vt-dark`, corroborated by `1 Brand and System.html` (2026-09-24 archive SHA-256 in the design map).
- Display/numerals: Oswald; interface: Golos Text; code uses the reference's system monospace stack.
- R0/MVP only; no future-phase routes or API changes.
- Required verification: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Review Focus

- Telegram theme may override design tokens with a low-contrast foreground/background pair: test both light and dark rendered combinations.
- Stale Space Grotesk/Manrope may remain in an import or Tailwind mapping: check the resulting font in a browser.
- Numeric/code typography can get conflated: inspect changing counters and OTP/email code separately.
- CSS dark rules may override or be overridden by the new light tokens in the wrong cascade order: inspect both appearances.
- External font failure may leave an unusable fallback: disable network fonts during smoke and verify readable layout.

---

### Task 1: Final design token contract

**Files:**

- Create: `apps/web/app/assets/css/tokens.test.ts`
- Modify: `apps/web/app/assets/css/tokens.css`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/nuxt.config.ts`
- Modify: `apps/web/app/assets/css/main.css`
- Modify: `docs/tasks/3-11-1-design-tokens-v2.md`

**Interfaces:**

- Consumes: `--vt-*` token names already used by Vue components; `THEME_TOKEN_MAP` in `useTelegram.ts`.
- Produces: final `--vt-*`, `--f-display`, `--f-body`, `--f-num`, `--f-mono`, `--r-*`, `--s-*` CSS variables for SDD 3.11.2 and all screens.

- [x] **Step 1: Write the failing contract test.** The test resolves `:root` and `.dark/.vt-dark` custom properties and asserts the final values `#FFFFFF`, `#F4F4F6`, `#15161A`, `#2437C9`, `Oswald`, and `Golos Text`. It also asserts the Nuxt font URL and Tailwind family maps to those variables; exact expectations come from the independently recorded design map.
- [x] **Step 2: Run RED.** `pnpm exec vitest run --project unit apps/web/app/assets/css/tokens.test.ts` failed on the old warm palette and Space Grotesk/Manrope, as expected.
- [x] **Step 3: Implement the token migration.** CSS variables, dark counterpart, Tailwind family/colors, Nuxt font link and code-vs-number styles updated; Telegram mapping unchanged.
- [x] **Step 4: Run GREEN.** Targeted Vitest passed, 3/3.
- [ ] **Step 5: Verify the repository and rendered surfaces.** Five required gates passed locally (418 tests); computed color-pair contrast checked in both themes. Real-browser smoke of local Nuxt preview could not run because Playwright CLI and in-app browser receive `ERR_CONNECTION_REFUSED` for the reachable host-side `127.0.0.1:3110`; visual matrix remains in Task 8.10.3. This is not a claim of visual acceptance.
- [ ] **Step 6: Commit.** Conventional commit with `Task: 3.11.1` and `Release: v0.1.6`, including test and task status. PR to `main`, merge only after applicable CI; no `prod` promotion until the full v0.1.6 candidate is accepted.
