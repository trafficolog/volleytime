---
id: '27.2.9'
phase: '27'
epic: '27.2'
status: todo
release: 'backlog'
sync_state: synced
last_reviewed: 2026-11-16
status_note: 'Создана 2026-11-16 по решению владельца (журнал решений, «Dependabot PR #262–#274»). Не начинать до выкладки v0.3.1. Релиз не назначен. Коммиты pnpm-lock.yaml разрешены этим решением.'
ref_id: ''
review_ref: 'CI-02'
priority: P2
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, BACKEND]
depends_on: ['21.4.3']
supersedes: []
decisions: ['Dependabot PR #262–#274: пересмотр группами после v0.3.1 (журнал решений, 2026-11-16)']
estimated_hours: '6-12'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, dependencies, ci]
---

# Task 27.2.9: Пересмотр Dependabot PR #262–#274 группами после v0.3.1

## Цель

Открытые PR Dependabot (#262–#274 и группа npm minor/patch) разобраны группами: приняты, перенесены в другую карточку или закрыты с причиной.

## Контекст

- Решение владельца 2026-11-16 ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md)): не принимать PR по одному и не до `v0.3.1`; пересмотреть группами после выпуска.
- Группы:
  1. **Runtime-мажоры:** образы `node:22-alpine` → `26-alpine` ([#262](https://github.com/trafficolog/volleytime/pull/262) bot, [#263](https://github.com/trafficolog/volleytime/pull/263) web, [#264](https://github.com/trafficolog/volleytime/pull/264) docker), vitest 4 → 5 ([#273](https://github.com/trafficolog/volleytime/pull/273)), tsup 8 → 9 ([#272](https://github.com/trafficolog/volleytime/pull/272)), `@sentry/node` 10 → 11 ([#271](https://github.com/trafficolog/volleytime/pull/271)), happy-dom 20 → 21 ([#274](https://github.com/trafficolog/volleytime/pull/274)).
  2. **Мажоры GitHub Actions:** checkout 7 ([#268](https://github.com/trafficolog/volleytime/pull/268)), docker/login 4 ([#265](https://github.com/trafficolog/volleytime/pull/265)), setup-buildx 4 ([#266](https://github.com/trafficolog/volleytime/pull/266)), build-push 7 ([#267](https://github.com/trafficolog/volleytime/pull/267)), gitleaks-action 3 ([#269](https://github.com/trafficolog/volleytime/pull/269)); в workflows действуют правила [27.2.1](27-2-1-actions-pinning.md) (SHA) и одобрение владельца для изменений workflows.
  3. **Группа npm minor/patch** (PR от Dependabot по группе `npm-minor-patch`, на дату карточки [#281](https://github.com/trafficolog/volleytime/pull/281)).
- Список на дату решения; актуальный перечень брать из `gh pr list`. Прежнее правило [27.2.2](27-2-2-security-scanning.md) «lockfile не коммитится без явной причины» для этой карточки снято решением 2026-11-16: коммиты `pnpm-lock.yaml` разрешены.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md). Образы Node и Sentry затрагивают runtime production: runbook [deploy](../operations/runbooks/deploy.md) и backup обязательны.

## Что должно быть сделано

1. Для каждой группы: прочитать release notes мажоров, определить ломающие изменения и совместимость с версиями Node, Nuxt и TypeScript проекта.
2. Принимать группы по очереди отдельными PR (или принять PR Dependabot после ребейза), по одной группе на PR; runtime-мажоры без одновременной смены версий в других группах.
3. Пять gates CODING_STANDARDS на каждой группе; для образов Node — сборка образов и smoke на staging-окружении или локально по runbook.
4. PR, который принимать нельзя, закрыть с причиной в комментарии и при необходимости игнорировать версию в `.github/dependabot.yml` (изменение workflows и конфигурации — только с одобрением владельца).
5. Итог по каждому PR (принят, закрыт, перенесён) записать в карточку.

## Критерии приёмки

- ✅ Каждый из PR #262–#274 и группа npm minor/patch принят или закрыт с причиной
- ✅ Пять gates зелёные на каждой принятой группе; `pnpm audit --prod --audit-level=high` без новых находок
- ✅ Lockfile меняется только в пределах группы PR
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не принимать мажоры до выкладки `v0.3.1` и не смешивать группы в одном PR
- ❌ Не обновлять версии вне PR Dependabot-групп без причины
- ❌ Не менять настройки GitHub и защиту веток
