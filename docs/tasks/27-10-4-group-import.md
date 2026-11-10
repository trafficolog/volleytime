---
id: '27.10.4'
phase: '27'
epic: '27.10'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-12). Релиз назначает владелец.'
ref_id: ''
review_ref: 'PROD-12'
priority: P2
complexity: XL
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, FE]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '10-20'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, import, money]
---

# Task 27.10.4: Импорт участников и остатков абонементов при переносе группы

## Цель

Организатор переносит существующую группу: список игроков и остатки абонементов, без ручного ввода каждого.

## Контекст

- Замечание `PROD-12` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Игроки входят через Telegram: импорт создаёт «ожидающих» участников, которые связываются при первом входе по ссылке или username.
- Остатки абонементов — деньги: операции идут через существующие сервисы ledger, append-only.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. ADR (`claude-opus-5-5`): модель ожидающего участника, сопоставление при входе, как вводятся остатки (операция «перенос» в ledger).
2. CSV-шаблон, предпросмотр с ошибками по строкам, применение в транзакции.
3. Тесты: дубликаты, неверные строки, повтор импорта, сопоставление при входе, суммы ledger.

## Критерии приёмки

- ✅ Импорт идемпотентен и не меняет суммы кассы вне операции переноса (тесты)
- ✅ Ошибки показаны по строкам
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не импортировать платежи прошлых периодов
