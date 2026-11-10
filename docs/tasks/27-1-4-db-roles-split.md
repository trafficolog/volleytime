---
id: '27.1.4'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-03). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-03'
priority: P2
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [DEVOPS, DB]
depends_on: ['27.1.2']
supersedes: []
decisions: []
estimated_hours: '6-10'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, db, infra]
---

# Task 27.1.4: Отдельные роли БД для приложения и миграций

## Цель

Web и bot подключаются ролью без прав на DDL; владелец схемы используется только мигратором.

## Контекст

- Замечание `INF-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `docker-compose.prod.yml` — одна роль `volley` (владелец схемы) у web, bot и мигратора.
- Зависит от [27.1.2](27-1-2-containers-least-privilege.md): после разделения env каждому сервису отдаётся своя строка подключения.
- Роли создаются SQL-скриптом инициализации или шагом deploy, не drizzle-миграцией (миграции не управляют ролями). Если без миграции не обойтись — остановиться и вернуть карточку оркестратору.
- Изменение выкладки проверяется по [deploy runbook](../operations/runbooks/deploy.md); в production попадает только через релизную задачу и Promote с подтверждением владельца.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Скрипт идемпотентного создания роли `volley_app` с `SELECT/INSERT/UPDATE/DELETE` на таблицы и `USAGE` на последовательности схемы приложения; `ALTER DEFAULT PRIVILEGES` для будущих таблиц.
2. Шаг deploy: выполнить скрипт ролью владельца до активации; web и bot получают `DATABASE_URL` роли `volley_app`.
3. CI и локальная разработка: тест, что роль приложения не может `CREATE TABLE` и `DROP`, а все интеграционные тесты проходят под ней (или объяснить, почему тесты остаются под владельцем).
4. Backup и restore-test работают с ролью владельца; runbook и `.env.example` обновлены.

## Критерии приёмки

- ✅ Роль приложения не выполняет DDL (тест); приложение и бот работают под ней
- ✅ Миграции применяются ролью владельца; откат описан
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять схему данных
- ❌ Не выкладывать без подтверждения владельца
