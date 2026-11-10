---
id: '27.2.4'
phase: '27'
epic: '27.2'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (CI-03). Релиз назначает владелец; не стартует до решения AQ-19.'
ref_id: ''
review_ref: 'CI-03'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: ['AQ-19']
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ci, cd, promotion]
---

# Task 27.2.4: Продвижение в production без ручных обходов

## Цель

Promote работает и для диапазонов с изменениями workflows, либо ручной путь описан как штатный с теми же проверками.

## Контекст

- Замечание `CI-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `PROMOTE_TOKEN` не задан; Promote отказывает, если диапазон меняет workflows, и `prod` продвигается ручным `git push` ([current-state](../operations/status/current-state.md), v0.2.0).
- Promote — [9.8.17](9-8-17-gated-prod-promotion.md).
- Открытые решения владельца: AQ-19 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Описать варианты для AQ-19: fine-grained токен с правом `workflows` только на этот репозиторий и срок; либо штатный ручной путь.
2. По решению: доработать Promote и runbook (как выпустить и где хранить токен, ротация) либо оформить ручной путь в runbook с теми же проверками (зелёный main CI на SHA, fast-forward, подтверждение).
3. Проверка на тестовом диапазоне (dry-run, если есть) без выкладки.

## Критерии приёмки

- ✅ Следующий релиз с изменениями workflows проходит по описанному пути без импровизации
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не выдавать токену прав шире нужного
- ❌ Не продвигать `prod` для проверки
