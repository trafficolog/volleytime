# Task 3.11.2 — Bento Bold MVP atoms

Source: cleaned `Volley Time v2.zip` (SHA-256 in the reference map), especially the final Bento Bold layer of `styles.css` and `atoms.jsx`. Scope is existing MVP Nuxt atoms only; no Root Admin or future-phase functionality.

1. Mark 3.11.1 complete after merged PR #37 and start 3.11.2 in its SDD card. Inventory existing atom variants and reference states.
2. Add failing tests for surface/button/chip/field/avatar/meter/chrome contracts, keyboard semantics, 44 px Mini App targets and reduced motion.
3. Update existing `main.css` and `components/vt` minimally. Preserve semantic navigation, Telegram native BackButton and current routes.
4. Run focused tests, then format, lint, typecheck, all tests and build. Review differences and navigation smoke; do not claim browser QA without an actual browser run.
5. Commit with Task/Release trailers, push one PR to `main`, merge only when acceptance and CI gates pass.
