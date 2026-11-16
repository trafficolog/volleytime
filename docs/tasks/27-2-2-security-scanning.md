---
id: '27.2.2'
phase: '27'
epic: '27.2'
status: done
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-11-16
status_note: 'Выполнено 2026-11-15, PR #261 (merge d8f87285): `.github/dependabot.yml` (npm, github-actions, docker; раз в неделю), `dependency-audit.yml` с `scripts/audit-gate.mjs` (high/critical без записи в `audit-exceptions.json` блокируют CI), `codeql.yml` на PR, push в `main` и по расписанию. Dependabot уже открыл PR по всем трём экосистемам, CodeQL и аудит проходят на PR. Первая волна находок передана карточками 27.2.6–27.2.8. Включение secret scanning, push protection и Dependabot alerts — за владельцем (`docs/GITHUB_SETUP.md` §9). CI зелёный.'
ref_id: ''
review_ref: 'CI-02'
priority: P1
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, ci, supply-chain]
---

# Task 27.2.2: Автоматические проверки: dependabot, аудит зависимостей, CodeQL, secret scanning

## Цель

Уязвимые зависимости, утёкшие секреты и типовые ошибки кода обнаруживаются до merge.

## Контекст

- Замечание `CI-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** в `.github/` только workflows; нет dependabot/renovate, `pnpm audit`, CodeQL; репозиторий публичный.
- Secret scanning и push protection включает владелец в настройках репозитория.
- Правило проекта: lockfile не коммитится в задачах без явной причины — обновления зависимостей идут отдельными PR dependabot.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. `.github/dependabot.yml`: npm (группировка minor/patch), github-actions, docker; расписание раз в неделю.
2. Job `pnpm audit --prod --audit-level=high` в CI; известные исключения — файл с причиной и сроком.
3. Workflow CodeQL для JavaScript/TypeScript по PR и раз в неделю.
4. Инструкция владельцу: включить secret scanning, push protection, Dependabot alerts; что делать с первой волной находок.
5. Первый прогон: список находок high/critical в PR и предложение карточек.

## Критерии приёмки

- ✅ Dependabot создаёт PR по трём экосистемам
- ✅ Аудит high блокирует CI
- ✅ CodeQL запускается на PR
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не обновлять зависимости в этой карточке
- ❌ Не отключать находки без записи причины
