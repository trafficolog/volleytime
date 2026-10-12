# Volley Time — agent entry point

Read the applicable documents before acting; these links are mandatory routing, not optional background.

- **Change or task review:** read [DEVELOPMENT_PROCESS](docs/DEVELOPMENT_PROCESS.md) and the owning `docs/tasks/<id>-*.md` in full before implementation or review. Create or update the task first when requirements change or review reveals a product defect.
- **Implement, review or integrate:** read [CODING_STANDARDS](CODING_STANDARDS.md) for engineering, Git and verification rules before coding, reviewing, committing or opening/merging a PR.
- **Orchestrate agents or pick a model:** read [ORCHESTRATION](docs/ORCHESTRATION.md). Each card carries `impl_model` and `review_model`; the implementer and the reviewer are different agents ([`.claude/agents/`](.claude/agents/)).
- **UI or product target:** the design reference v3 in [docs/design/reference-v3](docs/design/reference-v3/README.md) is the target for screens and scenarios of phases 19–26; the card's `reference` field names the exact spec and screenshots. Conflicts with accepted rules are owner decisions in the [decision log](docs/operations/decisions/2026-10-12-reference-v3-decisions.md); a card with an open decision does not start.
- **Scope or release:** read [RELEASES](docs/RELEASES.md) for the target release's scope and acceptance criteria; phase order and execution waves are in [ROADMAP](docs/ROADMAP.md).
- **Status:** read [current-state](docs/operations/status/current-state.md) and its linked dated evidence before reporting implementation or production readiness; status is not a substitute for acceptance.
- **Production-impacting change, migration or recovery:** read the [deploy runbook](docs/operations/runbooks/deploy.md) and applicable smoke/QA/recovery references before proposing or executing operations; follow the owning task and release gates. Promotion to production goes through the **Promote to production** workflow.

Task cards own requirements; DEVELOPMENT_PROCESS owns workflow; ORCHESTRATION owns agent roles and model routing; CODING_STANDARDS owns engineering rules; RELEASES owns release acceptance. If they conflict, surface the conflict before changing code or production.
