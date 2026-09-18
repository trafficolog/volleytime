---
id: '9.9.9'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P1 #9'
priority: P1
roles:
  - DEVOPS
  - DB
depends_on:
  - '9.9.4'
estimated_hours: '2'
tags:
  - backup
  - review-fix
---

# Task 9.9.9: Бэкапы: ON_ERROR_STOP, ожидание БД, шифрование, пинг healthcheck

## Цель

Восстановление проверяется по-настоящему, дампы не утекают в открытом виде, молчание бэкапа заметно.

## Контекст

`restore-test.sh` без `ON_ERROR_STOP` считал успехом частично сломанный дамп; sleep вместо ожидания; дампы без шифрования; про сбой cron никто не узнаёт.

## Что должно быть сделано

1. `restore-test.sh`: `psql -v ON_ERROR_STOP=1`, `pg_isready` в цикле, проверка числа таблиц и ключевых таблиц после restore.
2. `backup.sh`: опциональное шифрование (`age`/`gpg`, ключ из env), проверка размера дампа, `curl` пинг `HEALTHCHECK_URL` при успехе/ошибке.
3. Runbook disaster-recovery дополнен разделом про ключ шифрования.

## Критерии приёмки

- ✅ Битый дамп → restore-test завершается ошибкой
- ✅ Без ключа шифрования скрипт предупреждает и не падает

## Подсказки

-

## Не делать

- ❌ Не хранить ключ шифрования рядом с дампами
