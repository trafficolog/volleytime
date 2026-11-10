---
id: '27.4.1'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (API-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'API-01'
priority: P1
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, api, rate-limit]
---

# Task 27.4.1: Лимиты запросов для мутаций, токенных маршрутов и экспорта

## Цель

Ни один маршрут, принимающий токен или меняющий данные, не обрабатывает запросы без ограничения частоты.

## Контекст

- Замечание `API-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `apps/web/server/middleware/00.rate-limit.ts` и `utils/rate-limit.ts` — лимитер в памяти; покрыты только не-GET `/api/auth/*`, `/api/public/**`, `/e/<slug>`, публичный логотип. Без лимита: авторизованные мутации, `/api/invites/[token]` и `redeem`, `/api/ownership-transfers/*`, `/api/internal/**`, `/api/health`, экспорт кассы.
- Лимитер в памяти корректен при одном экземпляре web — это ограничение нужно записать.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Таблица маршрутов и лимитов в PR: токенные (по IP, строго), мутации (по пользователю), экспорт (по пользователю, редко), внутренние (по секрету).
2. Реализовать ключи «пользователь» и «IP» в существующем лимитере; ответ 429 с `Retry-After` и русским текстом.
3. Тесты: превышение на каждом классе маршрутов → 429; обычная работа Mini App (серия запросов при открытии) лимит не задевает.
4. Записать в CODING_STANDARDS или runbook: лимитер в памяти, один экземпляр web.

## Критерии приёмки

- ✅ Каждый класс маршрутов из таблицы ограничен (тесты)
- ✅ Обычные сценарии не получают 429 (интеграционный тест открытия экранов)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не вводить Redis и внешние хранилища
