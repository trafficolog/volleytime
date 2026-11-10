---
id: '27.7.4'
phase: '27'
epic: '27.7'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (ROLE-04). Релиз назначает владелец; не стартует до решения AQ-20.'
ref_id: ''
review_ref: 'ROLE-04'
priority: P1
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, SECURITY]
depends_on: ['27.7.3', '27.4.3']
supersedes: []
decisions: ['AQ-20']
estimated_hours: '6-12'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, access, root-admin]
---

# Task 27.7.4: Root admin: второй фактор, короткая сессия и журнал до фазы 22

## Цель

Действия root нельзя выполнить по украденной обычной сессии; каждое действие root попадает в журнал.

## Контекст

- Замечание `ROLE-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** root — флаг `users.is_root_admin` (`apps/web/server/utils/root-admin.ts`), вход теми же способами, что у игрока, сессия 30 дней; до v0.4.0 заявки на баланс подтверждаются операторской командой.
- Фаза [22](../phases/22-root-admin.md) строит экраны поверх `requireRootAdmin`: эту карточку стоит добавить в `depends_on` релиза [22.3.2](22-3-2-release-v0-4-0-qa.md) (решение владельца).
- Вариант второго фактора — AQ-20 (код на email, TOTP, подтверждение в Telegram).
- Открытые решения владельца: AQ-20 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. `requireRootAdmin` требует свежего подтверждения (27.7.3) не старше 15 минут и второй фактор по AQ-20.
2. Каждый вызов `/api/platform/**` и операторская команда пишут запись журнала (кто, что, параметры без секретов).
3. Оповещение владельцу при выдаче или снятии `is_root_admin`.
4. Тесты: обычная сессия root без подтверждения → 403; запись в журнал на каждый маршрут; снятие флага действует сразу.

## Критерии приёмки

- ✅ Root-маршруты требуют второго фактора и свежего подтверждения (тесты)
- ✅ Все root-действия в журнале (тесты)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не строить экраны фазы 22
