---
id: '27.4.9'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-SEC-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-SEC-02'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, frontend, access]
---

# Task 27.4.9: Сброс экранов менеджера после понижения роли

## Цель

Если роль пользователя понижена во время работы, клиент перестаёт показывать данные менеджера при первом ответе 403.

## Контекст

- Замечание `UI-SEC-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Права решает сервер; клиент кэширует данные группы и выбранную роль (`current_org_id`, `vt.lastOrgId`).
- Единственный route-middleware `apps/web/app/middleware/auth.ts` проверяет только сессию.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Общая обработка 403 `forbidden.*` в клиенте API: обновить данные участника, сбросить кэш менеджера, перевести на экран игрока или «нет доступа».
2. Тест (Vue/браузер): понижение роли между запросами → данные менеджера не видны.

## Критерии приёмки

- ✅ После 403 экраны менеджера скрыты (тест)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не переносить проверку прав на клиент
