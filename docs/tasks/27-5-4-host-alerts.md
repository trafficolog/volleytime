---
id: '27.5.4'
phase: '27'
epic: '27.5'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (OPS-03). Релиз назначает владелец.'
ref_id: ''
review_ref: 'OPS-03'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: ['27.5.1']
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ops, monitoring]
---

# Task 27.5.4: Оповещения по памяти, сертификату и возрасту бэкапа

## Цель

Владелец узнаёт о нехватке памяти, скором истечении сертификата и устаревшем бэкапе раньше пользователей.

## Контекст

- Замечание `OPS-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Один VPS, диск 28 ГБ; оповещение по диску уже есть (`.github/workflows/vps-disk-monitor.yml`).
- Канал оповещения — тот же, что у disk-monitor или UptimeRobot из 27.5.1.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Расширить проверку disk-monitor (или аналогичный workflow): свободная память и swap, срок сертификата (меньше 14 дней), возраст последнего бэкапа (больше 26 часов), рестарты контейнеров.
2. Тесты скрипта проверки на пороговых значениях.
3. Описать в runbook реакцию на каждое оповещение.

## Критерии приёмки

- ✅ Каждое оповещение срабатывает на тестовом пороге
- ✅ Runbook описывает реакцию
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ставить агенты мониторинга на VPS без решения владельца
