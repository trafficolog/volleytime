# Drift Report

> ⚠️ **Сгенерировано**. Дата: 2026-05-25.
>
> Перечисляет phases/epics/tasks, у которых `sync_state: drifted` —
> то есть карточка описывает целевую функциональность, которой ещё нет в коде.
> Это нормально и означает «в плане, но не реализовано».

## Drifted Phases

- 🔄 [2.5 · Phase 2.5: Расширенная админ-панель](../../phases/2-5-extended-admin-panel.md) — Расширенная админ-панель: то, что нужно с первого дня работы в реальной группе. 7 эпиков, 22 задачи.
- 🔄 [3 · Phase 3: Интеграция bePaid](../../phases/3-bepaid-integration.md) — Заблокирован Треком A (регистрация ИП/НПД и подключение bePaid). Все 5 эпиков и 15 задач описаны и готовы к реализации.
- 🔄 [4 · Phase 4: Напоминания и автоматизация](../../phases/4-reminders-and-automation.md) — Можно делать параллельно с Phase 3. Все 4 эпика и 8 задач описаны и готовы к реализации.
- 🔄 [5 · Phase 5: Отчёты и полировка](../../phases/5-reports-and-polish.md) — После Фазы 4.
- 🔄 [6 · Phase 6: Деплой в прод](../../phases/6-production-deploy.md) — Финальная фаза. Деплой 24/7, бэкапы, мониторинг.

## Drifted Epics

- 🔄 [2.8 · Epic 2.8: Управление игроками](../../epics/2-8-user-management.md)
- 🔄 [2.9 · Epic 2.9: Управление тренировками](../../epics/2-9-training-management.md)
- 🔄 [2.10 · Epic 2.10: Ручное управление записями](../../epics/2-10-manual-booking-control.md)
- 🔄 [2.11 · Epic 2.11: Ручное управление абонементами](../../epics/2-11-manual-subscription-control.md)
- 🔄 [2.12 · Epic 2.12: Корректировки в кассе](../../epics/2-12-ledger-corrections.md)
- 🔄 [2.13 · Epic 2.13: CRUD планов абонементов](../../epics/2-13-subscription-plans-crud.md)
- 🔄 [2.14 · Epic 2.14: Настройки через UI](../../epics/2-14-settings-ui.md)
- 🔄 [3.1 · Epic 3.1: Сервис bePaid](../../epics/3-1-bepaid-service.md)
- 🔄 [3.2 · Epic 3.2: Приём и обработка webhook](../../epics/3-2-webhook-handling.md)
- 🔄 [3.3 · Epic 3.3: UX оплаты](../../epics/3-3-payment-ux.md)
- 🔄 [3.4 · Epic 3.4: Безопасность](../../epics/3-4-security.md)
- 🔄 [3.5 · Epic 3.5: Тесты Phase 3](../../epics/3-5-tests-phase3.md)
- 🔄 [4.1 · Epic 4.1: APScheduler infrastructure](../../epics/4-1-scheduler.md)
- 🔄 [4.2 · Epic 4.2: Напоминания](../../epics/4-2-reminders.md)
- 🔄 [4.3 · Epic 4.3: Автоматические переходы статусов](../../epics/4-3-auto-status-transitions.md)
- 🔄 [4.4 · Epic 4.4: Тесты Phase 4](../../epics/4-4-tests-phase4.md)
- 🔄 [5.1 · Epic 5.1: Отчёты для админа](../../epics/5-1-admin-reports.md)
- 🔄 [5.2 · Epic 5.2: Экспорт CSV](../../epics/5-2-exports.md)
- 🔄 [5.3 · Epic 5.3: UX-полировка](../../epics/5-3-ux-polish.md)
- 🔄 [5.4 · Epic 5.4: Опциональные фичи](../../epics/5-4-options.md)
- 🔄 [6.1 · Epic 6.1: Миграции БД (Alembic)](../../epics/6-1-migrations.md)
- 🔄 [6.2 · Epic 6.2: Контейнеризация](../../epics/6-2-containerization.md)
- 🔄 [6.3 · Epic 6.3: Хостинг](../../epics/6-3-hosting.md)
- 🔄 [6.4 · Epic 6.4: Эксплуатация](../../epics/6-4-operations.md)
- 🔄 [6.5 · Epic 6.5: CI/CD](../../epics/6-5-ci-cd.md)

## Drifted Tasks (по фазам)

### Phase 2.5: Phase 2.5: Расширенная админ-панель

- 🔄 [2.8.1 · Task 2.8.1: Список игроков и поиск](../../tasks/2-8-1-users-list-and-search.md)
- 🔄 [2.8.2 · Task 2.8.2: Карточка игрока с историей](../../tasks/2-8-2-user-card-with-history.md)
- 🔄 [2.8.3 · Task 2.8.3: Редактирование профиля (ФИО, телефон)](../../tasks/2-8-3-user-edit-profile.md)
- 🔄 [2.8.4 · Task 2.8.4: Блокировка и управление ролью](../../tasks/2-8-4-user-block-and-promote.md)
- 🔄 [2.9.1 · Task 2.9.1: Редактирование полей тренировки](../../tasks/2-9-1-edit-training.md)
- 🔄 [2.9.2 · Task 2.9.2: Копирование тренировки как шаблон](../../tasks/2-9-2-copy-training.md)
- 🔄 [2.9.3 · Task 2.9.3: Создание серии повторяющихся тренировок](../../tasks/2-9-3-training-series.md)
- 🔄 [2.9.4 · Task 2.9.4: Изменение лимитов слотов для существующей тренировки](../../tasks/2-9-4-edit-slot-limits.md)
- 🔄 [2.10.1 · Task 2.10.1: Запись игрока админом «за него»](../../tasks/2-10-1-manual-add-booking.md)
- 🔄 [2.10.2 · Task 2.10.2: Снятие чужой записи с причиной](../../tasks/2-10-2-manual-cancel-booking.md)
- 🔄 [2.10.3 · Task 2.10.3: Перемещение между слотами и тренировками](../../tasks/2-10-3-move-between-slots-and-trainings.md)
- 🔄 [2.11.1 · Task 2.11.1: Создание абонемента вручную (подарок)](../../tasks/2-11-1-create-subscription-manually.md)
- 🔄 [2.11.2 · Task 2.11.2: Продление срока и модификация сессий абонемента](../../tasks/2-11-2-extend-and-modify-subscription.md)
- 🔄 [2.11.3 · Task 2.11.3: Отмена абонемента с возвратом](../../tasks/2-11-3-refund-subscription.md)
- 🔄 [2.12.1 · Task 2.12.1: Редактирование описания записи в кассе](../../tasks/2-12-1-edit-ledger-description.md)
- 🔄 [2.12.2 · Task 2.12.2: Создание корректирующих записей](../../tasks/2-12-2-ledger-corrections.md)
- 🔄 [2.13.1 · Task 2.13.1: Миграция планов абонементов в БД](../../tasks/2-13-1-migrate-plans-to-db.md)
- 🔄 [2.13.2 · Task 2.13.2: Список планов и просмотр](../../tasks/2-13-2-plans-list-and-view.md)
- 🔄 [2.13.3 · Task 2.13.3: Создание, редактирование, деактивация плана](../../tasks/2-13-3-plans-create-edit-deactivate.md)
- 🔄 [2.14.1 · Task 2.14.1: Модель AppSetting и SettingsService с кешем](../../tasks/2-14-1-app-settings-model-and-service.md)
- 🔄 [2.14.2 · Task 2.14.2: UI просмотра и редактирования настроек](../../tasks/2-14-2-settings-ui.md)
- 🔄 [2.14.3 · Task 2.14.3: Перевести услуг на SettingsService](../../tasks/2-14-3-migrate-config-usages.md)

### Phase 3: Phase 3: Интеграция bePaid

- 🔄 [3.1.1 · Task 3.1.1: BePaidClient — Basic Auth + создание checkout](../../tasks/3-1-1-bepaid-client.md)
- 🔄 [3.1.2 · Task 3.1.2: BePaidClient — refund](../../tasks/3-1-2-bepaid-refund.md)
- 🔄 [3.1.3 · Task 3.1.3: Поддержка ЕРИП](../../tasks/3-1-3-bepaid-erip.md)
- 🔄 [3.2.1 · Task 3.2.1: Парсер payload bePaid webhook](../../tasks/3-2-1-webhook-payload-parser.md)
- 🔄 [3.2.2 · Task 3.2.2: Идемпотентность webhook по bepaid_uid](../../tasks/3-2-2-webhook-idempotency.md)
- 🔄 [3.2.3 · Task 3.2.3: Подтверждение Booking/Subscription через PaymentService](../../tasks/3-2-3-webhook-confirm-flow.md)
- 🔄 [3.3.1 · Task 3.3.1: Кнопки bepaid_card / bepaid_erip в payment_method_choice](../../tasks/3-3-1-add-bepaid-methods-ui.md)
- 🔄 [3.3.2 · Task 3.3.2: Deeplink на checkout + сохранение токена](../../tasks/3-3-2-checkout-deeplink.md)
- 🔄 [3.3.3 · Task 3.3.3: QR-код для ЕРИП](../../tasks/3-3-3-erip-qr-code.md)
- 🔄 [3.4.1 · Task 3.4.1: Жёсткая проверка RSA-подписи webhook](../../tasks/3-4-1-strict-signature-check.md)
- 🔄 [3.4.2 · Task 3.4.2: Allowlist IP-адресов bePaid](../../tasks/3-4-2-ip-allowlist.md)
- 🔄 [3.4.3 · Task 3.4.3: Redaction чувствительных данных в логах](../../tasks/3-4-3-log-redaction.md)
- 🔄 [3.5.1 · Task 3.5.1: Тесты verify_bepaid_signature](../../tasks/3-5-1-tests-signature.md)
- 🔄 [3.5.2 · Task 3.5.2: Тест идемпотентности webhook](../../tasks/3-5-2-tests-webhook-idempotency.md)
- 🔄 [3.5.3 · Task 3.5.3: Интеграционный тест полного цикла оплаты](../../tasks/3-5-3-tests-bepaid-full-cycle.md)

### Phase 4: Phase 4: Напоминания и автоматизация

- 🔄 [4.1.1 · Task 4.1.1: AsyncIOScheduler + SQLAlchemyJobStore](../../tasks/4-1-1-scheduler-setup.md)
- 🔄 [4.1.2 · Task 4.1.2: Регистрация задач при создании Training](../../tasks/4-1-2-register-jobs-on-training-create.md)
- 🔄 [4.2.1 · Task 4.2.1: Напоминание за 24 часа](../../tasks/4-2-1-reminder-24h.md)
- 🔄 [4.2.2 · Task 4.2.2: Напоминание за 2 часа + закрытие записи](../../tasks/4-2-2-reminder-2h-and-close.md)
- 🔄 [4.3.1 · Task 4.3.1: TTL pending_payment (15 минут → cancel)](../../tasks/4-3-1-ttl-pending-payment.md)
- 🔄 [4.3.2 · Task 4.3.2: Уведомление waitlist с TTL 30 мин](../../tasks/4-3-2-waitlist-promotion-notify.md)
- 🔄 [4.3.3 · Task 4.3.3: Авто-finished для прошедших тренировок](../../tasks/4-3-3-auto-finished.md)
- 🔄 [4.4.1 · Task 4.4.1: freezegun + тесты scheduler-задач](../../tasks/4-4-1-tests-scheduler-jobs.md)

### Phase 5: Phase 5: Отчёты и полировка

- 🔄 [5.1.1 · Task 5.1.1: Отчёт «кто должен»](../../tasks/5-1-1-report-debtors.md)
- 🔄 [5.1.2 · Task 5.1.2: Баланс кассы за период](../../tasks/5-1-2-report-balance-by-period.md)
- 🔄 [5.1.3 · Task 5.1.3: Статистика посещаемости](../../tasks/5-1-3-report-attendance.md)
- 🔄 [5.2.1 · Task 5.2.1: CSV-экспорт кассы](../../tasks/5-2-1-csv-export-ledger.md)
- 🔄 [5.2.2 · Task 5.2.2: CSV-экспорт посещаемости](../../tasks/5-2-2-csv-export-attendance.md)
- 🔄 [5.3.1 · Task 5.3.1: Inline-подсказки в FSM](../../tasks/5-3-1-fsm-inline-hints.md)
- 🔄 [5.3.2 · Task 5.3.2: Группировка тренировок по неделям](../../tasks/5-3-2-trainings-weekly-grouping.md)
- 🔄 [5.4.1 · Task 5.4.1: Бот в групповом чате](../../tasks/5-4-1-bot-in-group-chat.md)
- 🔄 [5.4.2 · Task 5.4.2: Заморозка абонемента](../../tasks/5-4-2-subscription-freeze.md)
- 🔄 [5.4.3 · Task 5.4.3: Реферальная программа](../../tasks/5-4-3-referral-program.md)

### Phase 6: Phase 6: Деплой в прод

- 🔄 [6.1.1 · Task 6.1.1: Настройка Alembic](../../tasks/6-1-1-alembic-setup.md)
- 🔄 [6.1.2 · Task 6.1.2: Начальная миграция](../../tasks/6-1-2-alembic-initial-migration.md)
- 🔄 [6.2.1 · Task 6.2.1: Dockerfile](../../tasks/6-2-1-dockerfile.md)
- 🔄 [6.2.2 · Task 6.2.2: docker-compose.yml](../../tasks/6-2-2-docker-compose.md)
- 🔄 [6.2.3 · Task 6.2.3: /health эндпоинт](../../tasks/6-2-3-healthcheck-endpoint.md)
- 🔄 [6.3.1 · Task 6.3.1: Выбор провайдера и сервер](../../tasks/6-3-1-choose-provider-and-server.md)
- 🔄 [6.3.2 · Task 6.3.2: Домен + Let's Encrypt](../../tasks/6-3-2-domain-and-tls.md)
- 🔄 [6.3.3 · Task 6.3.3: Telegram webhook вместо polling](../../tasks/6-3-3-telegram-webhook-mode.md)
- 🔄 [6.4.1 · Task 6.4.1: Ежедневный бэкап БД](../../tasks/6-4-1-daily-db-backup.md)
- 🔄 [6.4.2 · Task 6.4.2: Sentry + UptimeRobot](../../tasks/6-4-2-sentry-and-uptime.md)
- 🔄 [6.4.3 · Task 6.4.3: Ротация логов](../../tasks/6-4-3-logs-rotation.md)
- 🔄 [6.5.1 · Task 6.5.1: GitHub Actions: lint + tests на PR](../../tasks/6-5-1-github-actions-tests.md)
- 🔄 [6.5.2 · Task 6.5.2: Авто-деплой на main](../../tasks/6-5-2-auto-deploy-main.md)

## Рекомендации

1. **Не паниковать.** Drifted — это не баг, а «в плане».
2. **Не браться за всё сразу.** Фазы идут по порядку: Phase 1 → 2 → 3 → 4 → 5 → 6.
3. **Параллельные треки** (см. ROADMAP) — A (юридическое) и B (документация) — могут идти независимо.
4. **При завершении задачи:**
   - Обновить статус `todo → done` в frontmatter task-карточки
   - Установить `sync_state: aligned`
   - Запустить (когда будет реализовано) `make docs-ops-refresh`
