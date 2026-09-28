# Global local reference fonts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Preserve the user's selected execution method after scope approval.

**Goal:** Deliver the unchanged reference font pair on every direct MVP entry without depending on Google Fonts.

**Architecture:** Reuse the seven existing licensed faces in `landing-fonts.css` through Nuxt's global CSS list. Remove redundant page/layout imports and Google font links. No new abstraction, assets or business behavior.

**Tech Stack:** Nuxt 4, CSS @font-face, existing local TTF, Vitest, Chrome Playwright CLI.

**Spec:** [SDD 3.11.9](../../tasks/3-11-9-global-local-reference-fonts.md).

## Global Constraints

- One branch/task: `trafficolog/fix/3.11.9-global-local-reference-fonts`, based on verified main, preserving the 8.10.3 QA checkpoint.
- Oswald 500/600/700 and Golos Text 400/500/600/700, unchanged binaries/licenses and design tokens.
- No API/auth/SDK or product scope changes; prod/VPS unchanged until full candidate readiness.
- Five gates, separate PostgreSQL test DB, independent review and exact-head CI.

## Review Focus

- Direct auth/desktop navigation in a fresh document must not require prior landing navigation.
- Cyrillic must use the intended loaded faces, not merely an Oswald computed family name.
- Google unavailable: existing local URLs must return successful font resources.
- All seven supplied weights remain available; removing redundant imports must not regress Mini App/landing.
- Changed font metrics must not hide controls or overflow desktop/mobile routes.

## Single task: global delivery, RED → GREEN → regression

**Files:** modify `apps/web/nuxt.config.ts`, `apps/web/app/pages/index.vue`, `apps/web/app/layouts/miniapp.vue`, `apps/web/app/layouts/miniapp-org.vue`, `apps/web/app/assets/css/tokens.test.ts`; create `scripts/qa/global-local-fonts.pwcode`; sync task, QA evidence and release/status docs. Existing font CSS/files remain unchanged.

**Interfaces:** consumes existing `/fonts/landing/*.ttf` and `~/assets/css/landing-fonts.css`; produces the same font-family/weight contract on direct routes, no JS API.

- [ ] Write the browser regression: abort Google CSS/gstatic, navigate directly to `/auth/login` and authenticated `/app/orgs/1`, await fonts; assert loaded Oswald 700 and Golos Text 400/700 using Cyrillic sample `Тренировка 123`. Also load all seven weights and require local resource delivery. Landing/Mini App are controls.
- [ ] Run it against current built preview; record RED for auth/desktop missing FontFace entries, not a selector/auth error.
- [ ] Add existing font CSS to Nuxt global `css`; remove three redundant imports and only font-specific external links. Update obsolete Google URL test expectation to the local-delivery contract.
- [ ] Stop the owned preview before build, run five gates (`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`), using `volleytime_qa_8101_post56`, not browser QA DB. Restart isolated preview; run exact same browser test and require GREEN.
- [ ] Repeat auth email/code/choice/error states, owner 12 Mini App routes 320/390 light/dark and 11 desktop routes 1280/1440/720/390, plus landing control. Inspect representative PNG against live HTML; assert no overflow/covered bottom/action loss and actual loaded faces.
- [ ] Record observed counts/limitations, independent scoped review, commit with `Task: 3.11.9` / `Release: v0.1.6`; task PR → green CI → merge main. Return to 8.10.3; no partial prod promotion.

Plan self-review: each spec requirement is covered; no unrelated optimization or product redesign. Implementation awaits user scope confirmation.
