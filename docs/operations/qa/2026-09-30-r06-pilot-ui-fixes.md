# R0.6 pilot UI fixes — 2026-09-30

## Scope and acceptance boundary

Five defects reported by the owner from the production Telegram pilot were implemented as separate SDD/TDD branches and independently reviewed PRs. API, domain rules, schemas, role checks and MVP scope are unchanged. Production still identifies `64f18506b03081bc7b9c065c8371cd3e62f10b30`; public health at19:28UTC reported status/db/auth ok. These fixes are accepted in main, not yet deployed. Historical200% zoom and screen-reader confirmations remain valid historical evidence; they are not fresh regression of these patches.

## Per-task evidence

Every row passed format, lint (0 errors/12 baseline warnings), typecheck6/6, full isolated PostgreSQL tests and build2/2. Each review approved spec and quality without Critical/Important findings. Merge and reviewed-head trees matched.

| Task | Reviewed source / accepted main | PR / exact-head CI / exact-main CI | RED→GREEN / browser / full tests |
| --- | --- | --- | --- |
| 8.10.7 status reflow | `09722ca06201cff00da749c0407552a2322cb8e5` / `4a48cdbb1051b6074f22d8952bad27406921c1e7` | [72](https://github.com/trafficolog/volleytime/pull/72) / [36756645620](https://github.com/trafficolog/volleytime/actions/runs/36756645620) / [36757286455](https://github.com/trafficolog/volleytime/actions/runs/36757286455) | 5 RED→5 GREEN; 20 status cases320/390 light/dark;131 files/889 tests |
| 3.11.11 blue shadows | `ee748fa027bb83973af3b13f733d67385ccc599b` / `74149eb8dc4e6a99da5fd32f29b9a1dd80591a3b` | [73](https://github.com/trafficolog/volleytime/pull/73) / [36759344990](https://github.com/trafficolog/volleytime/actions/runs/36759344990) / [36759891584](https://github.com/trafficolog/volleytime/actions/runs/36759891584) | 2 RED→15 focused GREEN;8 page/theme shadow-focus cases;132 files/892 tests |
| 3.11.12 native radio | `49f1748c7740d0b83744938f695dfd24154f2fde` / `7bb847ddbfb57730691ea8141f65f2a66368359d` | [74](https://github.com/trafficolog/volleytime/pull/74) / [36762685559](https://github.com/trafficolog/volleytime/actions/runs/36762685559) / [36763675387](https://github.com/trafficolog/volleytime/actions/runs/36763675387) | 3 radio RED→3 GREEN;2 checkbox RED→5 total GREEN;8 settings cases + forced colors;133 files/897 tests |
| 3.11.13 gray fields | `810adf4862a323117f2f4cb6a6101745d2fababc` / `3c68fb8edc77faf0fe57711ec11723a1af29e18f` | [75](https://github.com/trafficolog/volleytime/pull/75) / [36765513535](https://github.com/trafficolog/volleytime/actions/runs/36765513535) / [36766098394](https://github.com/trafficolog/volleytime/actions/runs/36766098394) | 3 RED→10 focused GREEN;42 real-route fixture cases + native scope fixtures;134 files/900 tests |
| 8.10.8 stable filters | `ae8f88cacd5685ae41b7abfe2b49a21bdec11d2b` / `575ca06576e40a40e99340081b81b559243057a1` | [76](https://github.com/trafficolog/volleytime/pull/76) / [36767438375](https://github.com/trafficolog/volleytime/actions/runs/36767438375) / [36768428929](https://github.com/trafficolog/volleytime/actions/runs/36768428929) (pending at this record) | 2 RED failures/5 passes→7 GREEN;8 native/browser-back cells;135 files/907 tests |

All recorded completed CI runs passed four jobs, including real runner image build/export/import. The last exact-main run and final selected promotion SHA must be observed separately before prod advancement.

## Visual and behavior findings

- Status: the old84px chip contained83.3125px text before padding, causing9.3125px spill even with no document overflow. Full text now reflows below details at narrow widths; all five statuses, long venue/title, occupancy and working event link were checked.
- Shadows: shared accent elevation is none and primary hardcoded blue elevation removed. Landing, auth, desktop and Mini App representatives were checked in light/dark, including hover and keyboard focus. Neutral elevation and accessible focus indicators remain.
- Radio: native type/model/value/disabled semantics retained, shared names enable arrow navigation.20px circles/checked dots and44px label targets pass label click, ArrowDown, Space, disabled and forced-colors fallback. Enabled border/dot/focus contrast exceeds3:1. Settings checkboxes were measured17.5px under14px root font, so only these two were aligned to20px before a separate RED/GREEN cycle.
- Gray fields: paper fill plus neutral boundary only inside gray cards; outside/paper forms, buttons, radio, checkbox and colored/raised cards remain unchanged. Settings/EventForm/cashbox/invite readonly cases cover320/390/1280 light/dark, native text/select/date/textarea, input, disabled, readonly, invalid association and focus. Light border/paper/card ratios3.83/3.48; dark5.77/5.21; bone2 defaults3.25/4.63. Focus outline stays2px. No fixture API writes.
- Filters: synthetic SDK/native BackButton reproduces header64→41px and filterY64→41px before the fix; ordinary browser back masks this cause. Persistent native disabled create button with guarded navigation leaves header64px/filterY64px/filterheight54.5px unchanged during delayed success, error, retry and rapid out-of-order responses in all eight320/390 light/dark native/browser cells. Mouse/Enter cannot create during loading/error; focus and latest rows remain. Request/access guards unchanged.

Browser evidence uses ChromeCLI `r06-pilot-ui` and local port3190 with explicit synthetic API/SDK fixtures. These are real-browser layout/interaction checks, **not real Telegram-host QA**, screen-reader certification, runtime deployment, backups/restore or pilot acceptance. Local images/scripts remain under output/playwright and .playwright-cli, not release assets.

## Review follow-up and controller decisions

Minor deferred for final whole-branch review: fields.test.ts currently reads the boundary token but hardcodes tested paper/gray values; future palette changes could make this contract stale. Current computed browser colors independently prove present contrast. No current runtime contrast failure is reported.

Controller rulings: native radio means native semantics rather than retaining the standard appearance rejected by the user (small CSS visual layer, reversible); align only the two settings checkboxes to measured20px, not all checkbox surfaces (two class changes, reversible); require synthetic native-back geometry because ordinary browser back did not reproduce the jump (extra matrix cells, no claim of real Telegram QA).

## Remaining promotion gates

Final integrated five gates, whole-branch review, exact selected-main CI including runner image job and runbook VPS preflight are still open at this record. Then reviewed fast-forward prod and Actions image-bundle deploy, new validated backup before migration, exact Git/image/runtime/public SHA and synthetic auth/forgery/cleanup smoke. The bundled-node migrator fix accepted [PR71](https://github.com/trafficolog/volleytime/pull/71), head/main CI36754840764/36755609169 passed; corrected no-runtime-npm deployment remains to be proven.

After successful controlled deployment: owner regression of these five observations in real Telegram, remaining two-account/client matrix and pilot acceptance. No v0.1.6 tag or GitHub Release until that separate acceptance. Preserve real pilot users/records; technical synthetic smoke cleanup must not remove them.
