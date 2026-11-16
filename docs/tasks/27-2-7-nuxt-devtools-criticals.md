---
id: '27.2.7'
phase: '27'
epic: '27.2'
status: in_progress
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-11-15
status_note: 'Реализация в PR (ветка trafficolog/fix/27.2.7-nuxt-devtools-criticals): @nuxt/devtools 3.4.2 → 3.4.4 (убрана зависимость simple-git, launch-editor 2.14.2), shell-quote 1.10.0 → 1.12.0 (lockfile); записи simple-git, @simple-git/argv-parser, shell-quote, launch-editor удалены из audit-exceptions. Ждёт ревью claude-opus-5-5 и merge. Релиз v0.3.1 назначен решением владельца 2026-11-16.'
ref_id: ''
review_ref: 'CI-02'
priority: P1
complexity: S
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: ['27.2.2']
supersedes: []
decisions: []
estimated_hours: '1-3'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, dependencies]
---

# Task 27.2.7: Убрать critical simple-git, argv-parser и shell-quote

## Цель

`pnpm audit --prod --audit-level=high` не показывает critical `simple-git` (GHSA-x6jw-m9v5-85vh), `@simple-git/argv-parser` (GHSA-v5rq-49vh-5v5c) и `shell-quote` (GHSA-pqg4-j6r4-53mv); записи исключений удалены.

## Контекст

- Пути из аудита: `apps/web > nuxt > @nuxt/devtools > simple-git / launch-editor > shell-quote`. Это инструменты разработки Nuxt (devtools); в production-образ они не должны попадать, это нужно подтвердить по содержимому образа.
- Исправления: simple-git >=4.0.1 (high GHSA-g4wm-2vf7-vfgr, GHSA-858h-whjf-mvg5 требуют >=4.0.0), argv-parser >=2.0.1, shell-quote >=1.11.0, launch-editor >=2.14.2.
- Обновления зависимостей идут через Dependabot либо `overrides`/обновление `nuxt`/`@nuxt/devtools`; выбрать минимальный способ.

## Что должно быть сделано

1. Проверить, что devtools не входит в production-образ `apps/web`.
2. Обновить `nuxt`/`@nuxt/devtools` или добавить `overrides` до исправленных версий.
3. Удалить соответствующие записи из `.github/audit-exceptions.json`.

## Критерии приёмки

- ✅ В аудите нет critical по этим трём пакетам
- ✅ `pnpm build` и `pnpm test` зелёные, образ web собирается
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не обновлять несвязанные зависимости
