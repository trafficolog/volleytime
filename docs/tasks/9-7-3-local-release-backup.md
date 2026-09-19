---
id: '9.7.3'
phase: '9'
epic: '9.7'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'A production baseline dump and isolated restore are verified; the task remains open until the backup hook is merged and exercised by the release workflow. S3 remains a later external gate.'
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

- [ ] Оба deploy path создают локальный backup до `run --rm migrate`.
- [ ] Backup имеет timestamped имя, gzip проходит проверку, права каталога/файла ограничены.
- [ ] При ошибке дампа release останавливается до миграции.
- [ ] Retention сохраняет последние `LOCAL_BACKUP_KEEP` файлов.
- [ ] Реальный production backup создан и восстановлен во временную БД.

## Не делать

- Не считать snapshot всего VPS заменой проверяемому DB dump.
- Не удалять текущий S3 backup path.
- Не выполнять автоматический destructive restore в production БД.

## Live evidence — 2026-09-19

- Production dump создан в `/opt/volleytime/backups` после первой миграции.
- Файл: mode `0600`, owner `deploy:deploy`, gzip validation прошла, размер 6860 bytes.
- Dump восстановлен в отдельный временный `postgres:16-alpine`; проверены 15 таблиц в `public` schema.
- Production PostgreSQL оставался healthy; restore не выполнялся в production volume.
