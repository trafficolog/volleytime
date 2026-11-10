---
id: '27.3.2'
phase: '27'
epic: '27.3'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (AUTH-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'AUTH-02'
priority: P2
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, auth, otp]
---

# Task 27.3.2: Предел попыток email-кода и отправок на адрес

## Цель

Шестизначный код нельзя подобрать: после нескольких неверных попыток код сгорает, частота отправок на адрес ограничена.

## Контекст

- Замечание `AUTH-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** код 6 цифр на 5 минут; лимитер `apps/web/server/middleware/00.rate-limit.ts` — 20 запросов в минуту на клиента и путь; `allowedAttempts` в конфигурации не задан, действует значение по умолчанию better-auth 1.7.4 — 3 попытки (`plugins/email-otp/routes.mjs`).
- Цель — закрепить текущую защиту явно, чтобы обновление библиотеки её не ослабило, и добавить лимит отправок на адрес.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Явно задать `allowedAttempts: 3` (текущее значение по умолчанию) и сгорание кода после них.
2. Лимит отправок кода на один email (например, 5 в час) независимо от IP.
3. Понятные тексты ошибок на русском (в стиле существующих), без раскрытия существования аккаунта.
4. Тесты: 4-я попытка с верным кодом отклоняется; лимит отправок; сброс после истечения окна.

## Критерии приёмки

- ✅ Перебор кода невозможен в пределах срока (тест)
- ✅ Отправки на адрес ограничены (тест)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять длину кода и срок без решения владельца
