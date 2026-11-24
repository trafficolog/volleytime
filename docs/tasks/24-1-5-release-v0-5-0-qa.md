---
id: '24.1.5'
phase: '24'
epic: '24.1'
status: in_progress
release: 'v0.5.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Проверки до Promote 2026-11-23 на 986e7120: пять gates зелёные (кроме известного шума Windows), визуальная сверка без Critical/Important, Lighthouse SEO /g/<slug> = 100, EVENT_BALANCE_ENFORCED=true в production (read-only). Ждёт main CI и подтверждения владельца на Promote. Evidence: docs/operations/qa/2026-11-23-24-1-5-release-v0.5.0-pre-promote.md.'
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS]
depends_on:
  [
    '23.1.1',
    '23.1.2',
    '23.2.1',
    '23.2.2',
    '23.2.3',
    '23.2.4',
    '24.1.1',
    '24.1.2',
    '24.1.3',
    '24.1.4',
    '22.3.2',
  ]
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 24.1.5: Релиз v0.5.0: QA, выкладка и приёмка

## Цель

Принять v0.5.0: личные функции, общий календарь, SEO-страницы, лендинг v3.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates, визуальная сверка, Lighthouse SEO (включая `/g/<slug>` публичной страницы группы — порог ≥ 95, перенесено из 24.1.2 решением владельца 2026-11-23)
2. Перед Promote проверить, что списание баланса событий включено в целевом окружении: от этого зависит фраза о возврате события на лендинге (24.1.4).
3. Promote, backup, smoke, тег v0.5.0

## Критерии приёмки

- ✅ Production health = release SHA
- ✅ Lighthouse SEO ≥ 95 на `/g/<slug>` публичной страницы группы (перенесено из 24.1.2)
- ✅ Списание баланса событий включено в целевом окружении (условие текста лендинга 24.1.4)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
