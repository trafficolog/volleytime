---
id: '28.1.5'
phase: '28'
epic: '28.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-20
status_note: 'Ждёт решений владельца по хуку Claude Code и обновлению (вопросы 3–4 эпика 28.1).'
ref_id: ''
review_ref: ''
priority: P3
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: standard
roles: [DevOps]
depends_on: ['28.1.3']
supersedes: []
decisions: []
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
- `graphify install` для Claude Code ставит хук перед Read/Glob/`grep`; `--project` пишет в репозиторий. Это меняет поведение всех агентов, включая ревьюера, которому нужно читать diff и файлы целиком.
- Решения владельца — вопросы 3–4 [эпика 28.1](../epics/28-1-graphify-knowledge-graph.md).

## Что должно быть сделано

1. Записать решения владельца (хук, git-хуки, CI).
2. Правило в ORCHESTRATION (AGENTS.md — одна строка маршрутизации): граф — для поиска и анализа влияния до чтения; ревью и приёмка — по файлам и diff, не по графу; при расхождении верен код.
3. Обновление: команда `graphify update .` после `git pull` и перед анализом влияния; признак устаревания (версия и коммит в `graph.json`).
4. Если владелец разрешил хук — `graphify claude install --project`, проверить, что записанные файлы (`.claude/settings.json`, `CLAUDE.md` и т. п.) не ломают агентов `vt-*`; иначе — только ручные команды в guide.
5. Если граф не установлен у агента — правило не блокирует работу.

## Критерии приёмки

- ✅ Решения владельца записаны в карточке
- ✅ Правило в ORCHESTRATION и строка в AGENTS.md
- ✅ Агенты работают без установленного Graphify
- ✅ Prettier и проверка управляющих символов для изменённых документов; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ставить хуки и CI без решения владельца
- ❌ Не делать граф источником требований вместо карточек
- ❌ Не использовать `graphify prs --triage` с внешним backend
