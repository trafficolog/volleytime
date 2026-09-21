---
id: '9.7.3'
phase: '9'
epic: '9.7'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'The release backup hook is merged and exercised before production advancement/migrations; local gzip, permissions, retention and isolated restore acceptance passed. S3 remains Task 9.7.1/9.7.2 scope.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.7.1'
  - '9.8.3'
estimated_hours: '1.5'
tags:
  - backup
  - deployment
  - postgres
  - production
---

# Task 9.7.3: локальный backup БД перед production-релизом

## Цель

Перед каждой production-миграцией создавать и проверять локальный gzip-дамп PostgreSQL на VPS, чтобы пилот не зависел от ещё не подключённого S3.

## Контекст

Хостинг уже создаёт backup всего сервера, а `scripts/backup.sh` рассчитан на S3. Для пилота с одной организацией нужен более быстрый release-level safety net: локальный дамп перед миграцией, закрытые права и ограниченная ретенция. Переход на S3 выполняется позже по задачам 9.7.1/9.7.2.

## Что должно быть сделано

1. Скрипт создаёт backup в `/opt/volleytime/backups` (путь переопределяем), использует `pg_dump`, gzip и атомарное завершение файла.
2. Каталог имеет mode `0700`, готовый backup — `0600`; временный файл удаляется при ошибке.
3. Нулевой/повреждённый дамп отклоняется; число локальных backup ограничено параметром retention count.
4. GHCR и local-build deploy вызывают backup после установки env, но до первой production-миграции.
5. Ошибка backup останавливает релиз.
6. Контрактный тест и shell syntax test проходят; live acceptance требует реального backup и отдельного restore-test на VPS.

## Критерии приёмки

- [x] Оба deploy path создают локальный backup до `run --rm migrate`.
- [x] Backup имеет timestamped имя, gzip проходит проверку, права каталога/файла ограничены.
- [x] При ошибке дампа release останавливается до миграции.
- [x] Retention сохраняет последние `LOCAL_BACKUP_KEEP` файлов.
- [x] Реальный production backup создан и восстановлен во временную БД.

## Не делать

- Не считать snapshot всего VPS заменой проверяемому DB dump.
- Не удалять текущий S3 backup path.
- Не выполнять автоматический destructive restore в production БД.

## Live evidence — 2026-09-19

- Production dump создан в `/opt/volleytime/backups` после первой миграции.
- Файл: mode `0600`, owner `deploy:deploy`, gzip validation прошла, размер 6860 bytes.
- Dump восстановлен в отдельный временный `postgres:16-alpine`; проверены 15 таблиц в `public` schema.
- Production PostgreSQL оставался healthy; restore не выполнялся в production volume.

## Release evidence — 2026-09-21

- Automatic bundle deployments created local backups before checkout advancement and migrations; the latest audited file is `volleytime_20260921_055333.sql.gz`, mode `0600`, owner `deploy:deploy`, size 8464 bytes, SHA-256 `7238f784a7743910ad2bdb8f9879ebc89ca4747531ffde09f6357c779d584e23`.
- `gzip -t` passed and no temporary restore container remained. The earlier isolated PostgreSQL 16 restore verified 15 public tables without touching the production volume.
