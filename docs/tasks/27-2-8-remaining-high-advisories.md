---
id: '27.2.8'
phase: '27'
epic: '27.2'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-15
status_note: 'Из первого pnpm audit (PR 27.2.2): остальные high (не критичные). Релиз назначает владелец; срок исключений аудита 2026-12-15.'
ref_id: ''
review_ref: 'CI-02'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: ['27.2.2']
supersedes: []
decisions: []
estimated_hours: '2-5'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, dependencies]
---

# Task 27.2.8: Закрыть оставшиеся high из аудита зависимостей

## Цель

Все записи в `.github/audit-exceptions.json` удалены или продлены с новой причиной; `pnpm audit --prod --audit-level=high` чист.

## Контекст

- Находки из первого аудита (PR 27.2.2), пакеты: undici >=8.12.2, devalue >=5.9.3 (runtime, сериализация Nuxt), zod >=4.6.6 (runtime), node-forge >=1.4.1, seroval >=1.6.8, brace-expansion, source-map-js >=1.2.2, vite/launch-editor, happy-dom >=21.0.4 (тесты). Для каждой записи в файле исключений указан тип (runtime или dev/build/test) по пути зависимости.
- Первыми закрыть runtime: undici, devalue, zod.
- Большую часть закроют еженедельные PR Dependabot (`.github/dependabot.yml`); карточка собирает остаток.

## Что должно быть сделано

1. Принять PR Dependabot по перечисленным пакетам либо обновить вручную / через `overrides`.
2. Для каждой находки, которую обновлением закрыть нельзя, продлить запись исключения с проверенной причиной.
3. Удалить закрытые записи из `.github/audit-exceptions.json`.

## Критерии приёмки

- ✅ Исключения аудита остались только с проверенной причиной и сроком
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не обновлять зависимости без прохождения gates
