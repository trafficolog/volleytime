---
id: '27.5.2'
phase: '27'
epic: '27.5'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-06). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-06'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ops, backup, security]
---

# Task 27.5.2: Обязательное шифрование бэкапа и восстановление по расписанию

## Цель

Бэкап без шифрования не создаётся и не лежит открытым на диске; восстановление проверяется регулярно автоматически.

## Контекст

- Замечание `INF-06` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `scripts/backup.sh` — age-шифрование необязательно (без `BACKUP_AGE_RECIPIENT` только предупреждение), дамп в `/tmp`, хранение 21 день; `scripts/restore-test.sh` запускается вручную.
- Release-local backup до миграций (deploy) — отдельный путь; проверить, шифруется ли он.
- Регулярное восстановление из S3 зависит от [27.5.1](27-5-1-phase-9-ops-debt.md); локальное восстановление последнего дампа можно сделать сразу.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Ошибка и ненулевой код при отсутствии ключа шифрования в production-режиме.
2. Временные файлы — в каталоге 0700, удаление по `trap` при любой ошибке.
3. Еженедельный restore-test последнего локального дампа (`scripts/backup-local.sh`) по расписанию с оповещением через канал disk-monitor; восстановление из S3 — после 27.5.1.
4. Тесты скриптов: без ключа → отказ; временный файл удалён после ошибки.
5. Инструкция владельцу: где хранится приватный ключ age (не на VPS).

## Критерии приёмки

- ✅ Без ключа бэкап не создаётся (тест)
- ✅ Открытый дамп не остаётся после сбоя (тест)
- ✅ Restore-test запускается по расписанию
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять бэкап перед миграциями в deploy без отдельной проверки
- ❌ Не хранить приватный ключ на VPS
