---
id: '27.1.2'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-02'
priority: P1
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '6-12'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, infra, docker]
---

# Task 27.1.2: Контейнеры без root, урезанные права и отдельные env-файлы сервисов

## Цель

Web и bot работают от непривилегированного пользователя с минимальными правами и получают только свои переменные окружения.

## Контекст

- Замечание `INF-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `apps/web/Dockerfile` и `apps/bot/Dockerfile` (node:22-alpine) без `USER`; в `docker-compose.prod.yml` оба сервиса получают весь `.env` через `env_file`, нет `read_only`, `cap_drop`, `security_opt`.
- Бот получает `BETTER_AUTH_SECRET` и ключи S3, web — секреты webhook: компрометация одного сервиса открывает секреты другого.
- Мигратор, backup и скрипты deploy используют те же образы и env — проверить, что им ничего не сломать.
- Изменение выкладки проверяется по [deploy runbook](../operations/runbooks/deploy.md); в production попадает только через релизную задачу и Promote с подтверждением владельца.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Составить таблицу «переменная → какие сервисы читают» по коду (`process.env`, `runtimeConfig`) и приложить к PR.
2. Разделить env на `web.env`, `bot.env`, `migrate.env` (или эквивалент) в рендере deploy; `docker-compose.prod.yml` подключает каждому сервису только его файл.
3. Dockerfile: `USER node`, права на рабочие каталоги; проверить запись логотипов и временных файлов.
4. Compose: `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `read_only: true` с `tmpfs` для нужных путей (проверить по факту, что пишут процессы).
5. Тест упаковки (как у существующих проверок образа): процесс не root, лишних переменных нет; локальный запуск compose с health 200.
6. Обновить runbook: новые файлы env, откат на релиз со старой схемой env.

## Критерии приёмки

- ✅ В контейнерах web и bot `id -u` не 0; health и smoke проходят
- ✅ Бот не получает `BETTER_AUTH_SECRET` и ключи S3; web не получает секрет webhook (таблица и тест)
- ✅ Откат на предыдущий релиз описан и проверен локально
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять код приложения сверх чтения конфигурации
- ❌ Не менять процедуру backup до миграций
- ❌ Не выкладывать без подтверждения владельца
