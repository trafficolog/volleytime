# Volley Time — agent entry point

Read the applicable documents before acting; these links are mandatory routing, not optional background.

- **Change or task review:** read [DEVELOPMENT_PROCESS](docs/DEVELOPMENT_PROCESS.md) and the owning `docs/tasks/<id>-*.md` in full before implementation or review. Create or update the task first when requirements change or review reveals a product defect.
- **Implement, review or integrate:** read [CODING_STANDARDS](CODING_STANDARDS.md) for engineering, Git and verification rules before coding, reviewing, committing or opening/merging a PR.
- **Scope or release:** read [RELEASES](docs/RELEASES.md) for the target release's scope and acceptance criteria.
- **Status:** read [current-state](docs/operations/status/current-state.md) and its linked dated evidence before reporting implementation or production readiness; status is not a substitute for acceptance.
- **Production-impacting change, migration or recovery:** read the [deploy runbook](docs/operations/runbooks/deploy.md) and applicable smoke/QA/recovery references before proposing or executing operations; follow the owning task and release gates.

Task cards own requirements; DEVELOPMENT_PROCESS owns workflow; CODING_STANDARDS owns engineering rules; RELEASES owns release acceptance. If they conflict, surface the conflict before changing code or production.
