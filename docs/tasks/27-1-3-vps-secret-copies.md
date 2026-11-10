---
id: '27.1.3'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-07). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-07'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, infra, deploy]
---

# Task 27.1.3: Копии секретов в каталогах релизов на VPS: права и срок хранения

## Цель

На VPS не накапливаются копии production env: каждая лежит с правами 0600 и удаляется после активации или по ретенции.

## Контекст

- Замечание `INF-07` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `.github/workflows/deploy.yml` копирует `.env.production` в `/opt/volleytime/.deploy/incoming/<sha>/` на каждый релиз.
- Ретенция релизов — [9.8.18](9-8-18-vps-release-retention.md); проверить, чистит ли она эти копии.
- Чтение состояния VPS — только read-only командами с разрешения владельца.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. По коду deploy и ретенции определить, где и сколько хранятся копии env, с какими правами.
2. Права 0600 и владелец `deploy` на каждой копии; удаление после успешной активации, кроме копии, нужной для отката (описать какой).
3. Включить оставшиеся копии в ретенцию 9.8.18.
4. Тест скриптов deploy (как существующие тесты shell-скриптов): права и удаление.
5. Read-only проверка на VPS после выкладки — в релизной задаче, с разрешения владельца.

## Критерии приёмки

- ✅ После выкладки на VPS хранится не больше копий env, чем нужно для отката, все с правами 0600
- ✅ Откат по runbook работает
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять на VPS ничего вручную вне скриптов и без подтверждения владельца
- ❌ Не печатать содержимое env
