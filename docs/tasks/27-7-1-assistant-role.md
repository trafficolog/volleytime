---
id: '27.7.1'
phase: '27'
epic: '27.7'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (ROLE-01). Релиз назначает владелец; не стартует до решения AQ-5.'
ref_id: ''
review_ref: 'ROLE-01'
priority: P2
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, FE]
depends_on: []
supersedes: []
decisions: ['AQ-5']
estimated_hours: '4-10'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, access, roles]
---

# Task 27.7.1: Роль помощника: набор прав или удаление

## Цель

Роль `assistant` даёт заявленные права или исчезает из приглашений и интерфейса.

## Контекст

- Замечание `ROLE-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `MANAGER_ROLES = owner, organizer`; `assistant` встречается в схеме, приглашениях и как цель модерации, но прав сверх игрока не имеет. `docs/DOMAIN.md`: «расширенные права (Phase 4 уточнит)».
- Варианты AQ-5: посещаемость и подтверждение наличных без кассы, настроек и участников; либо удалить роль.
- Открытые решения владельца: AQ-5 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Подготовить для AQ-5: где роль видна пользователю, сколько участников с ней в production (read-only запрос с разрешения владельца).
2. Вариант «права»: функции `canMarkAttendance`, `canConfirmCash` и т. п. в policies, маршруты переводятся на них; UI показывает доступное.
3. Вариант «удалить»: роль недоступна в приглашениях и смене роли; существующие помощники становятся игроками (миграция данных — отдельный шаг, `claude-opus-5-5`).
4. IDOR- и ролевые тесты на каждый затронутый маршрут; обновить DOMAIN.

## Критерии приёмки

- ✅ Решение AQ-5 исполнено; таблица прав в DOMAIN совпадает с policies
- ✅ Ролевые тесты на каждый маршрут
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не давать помощнику доступ к кассе, настройкам и экспорту без решения
