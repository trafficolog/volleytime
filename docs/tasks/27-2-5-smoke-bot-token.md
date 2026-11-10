---
id: '27.2.5'
phase: '27'
epic: '27.2'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (CI-04). Релиз назначает владелец.'
ref_id: ''
review_ref: 'CI-04'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, QA]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, ci, smoke]
---

# Task 27.2.5: Токен бота в smoke на runner: исключить утечку

## Цель

Smoke после выкладки не раскрывает токен бота в логах и артефактах, а по возможности обходится без него.

## Контекст

- Замечание `CI-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** smoke использует настоящий токен бота на GitHub runner (подпись synthetic initData).
- Токен бота даёт полный контроль над ботом; GitHub маскирует секреты в логах, но не в артефактах и производных значениях.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Проверить, куда попадает токен и производные от него значения (подписанный initData, URL, артефакты, кэш).
2. Вариант без токена: smoke подписывает initData на VPS (команда внутри контейнера) или использует отдельный служебный путь входа для smoke-пользователя; выбрать с ревьюером.
3. Если токен остаётся — `::add-mask::` для производных значений и запрет артефактов с ними.

## Критерии приёмки

- ✅ В логах и артефактах успешного и упавшего smoke нет токена и подписанного initData
- ✅ Smoke проверяет вход как раньше
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ослаблять проверку подписи initData в приложении ради smoke
