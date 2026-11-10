---
id: '27.4.4'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (API-04). Релиз назначает владелец.'
ref_id: ''
review_ref: 'API-04'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '1-3'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, infra, rate-limit]
---

# Task 27.4.4: Проверка доверия X-Forwarded-For за Caddy

## Цель

Ключ лимитера нельзя подделать заголовком: web доступен только через Caddy, а Caddy задаёт адрес клиента сам.

## Контекст

- Замечание `API-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** при `TRUSTED_PROXY=1` ключ — последний элемент `X-Forwarded-For`; порт web наружу не опубликован (проверить compose).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Проверить по конфигурации: Caddy перезаписывает или дополняет `X-Forwarded-For`; порт 3000 не опубликован.
2. Тест лимитера: подставной `X-Forwarded-For` от клиента не меняет ключ.
3. Записать вывод в runbook.

## Критерии приёмки

- ✅ Подделка заголовка не меняет ключ (тест)
- ✅ Вывод записан
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять топологию сети
