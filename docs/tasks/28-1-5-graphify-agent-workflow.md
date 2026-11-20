---
id: '28.1.5'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Решение владельца D-22 (2026-11-20): без хука Claude Code, ручное обновление, без CI.'
ref_id: ''
review_ref: ''
priority: P3
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps]
depends_on: ['28.1.4']
supersedes: []
decisions: ['D-22']
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [tooling, graphify, agents]
---

# Task 28.1.5: Граф в работе агентов

## Цель

Агенты знают, когда спрашивать граф и когда читать файлы; граф не устаревает незаметно.

## Контекст

- [AGENTS.md](../../AGENTS.md), [ORCHESTRATION](../ORCHESTRATION.md), агенты [`.claude/agents/`](../../.claude/agents/).
- По коду 0.9.103 ([28.1.1](28-1-1-graphify-evaluation.md#что-пишет-graphify-install-по-installpy)): `graphify install` без `--project` пишет только скилл в `~/.claude/skills/graphify/` и блок в `~/.claude/CLAUDE.md`, хуков не ставит. `graphify install --project` и `graphify claude install` ставят хук перед Read/Glob/Grep/Bash в `.claude/settings.json` и пишут в репозиторий. Хук меняет поведение всех агентов, включая ревьюера, которому нужно читать diff и файлы целиком.
- Решение владельца [D-22](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-22): хук Claude Code не ставится; обновление вручную `graphify update .`, без git-хуков и CI. Правила семантического прохода — [28.1.4](28-1-4-graphify-docs-semantic.md).

## Что должно быть сделано

1. Правило в ORCHESTRATION (AGENTS.md — одна строка маршрутизации): граф — для поиска и анализа влияния до чтения; ревью и приёмка — по файлам и diff, не по графу; при расхождении верен код.
2. Обновление: команда `graphify update .` после `git pull` и перед анализом влияния; признак устаревания (версия и коммит в `graph.json`).
3. Только ручные команды `graphify query|path|explain` в guide. Скилл ставится `graphify install` на уровне пользователя (без `--project`); `graphify install --project`, `graphify claude install` и `graphify hook install` не запускаются (D-22, дополнение 2026-11-20).
4. Если граф не установлен у агента — правило не блокирует работу.

## Критерии приёмки

- ✅ Хуки Claude Code и git не установлены, CI не изменён
- ✅ Правило в ORCHESTRATION и строка в AGENTS.md
- ✅ Агенты работают без установленного Graphify
- ✅ Prettier и проверка управляющих символов для изменённых документов; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ставить хук Claude Code, git-хуки (`graphify hook install`) и проверки CI (D-22)
- ❌ Не делать граф источником требований вместо карточек
- ❌ Не использовать `graphify prs --triage` с внешним backend
