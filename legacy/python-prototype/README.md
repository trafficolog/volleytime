# 🏐 Volleyball Booking Bot

Telegram-бот для записи на волейбольные тренировки в Беларуси.

## Что умеет (Phase 1 + Phase 2)

- ✅ Запись на тренировки с распределением слотов: **12 основных + 2 ротация + waitlist**
- ✅ Автоматическое продвижение из листа ожидания при отмене
- ✅ Покупка абонементов (4 / 8 / 12 сессий) с разной ценой за тренировку
- ✅ Атомарное списание сессий с абонемента (защита от гонок)
- ✅ Оплата записи: с абонемента или наличными на тренировке
- ✅ Касса (Ledger): доходы и расходы с категориями, баланс на любую дату
- ✅ Подтверждение/отклонение pending-платежей админом
- ✅ Отметка посещаемости после тренировки
- ✅ Отмена тренировки админом с массовым refund и уведомлениями
- ✅ Меню «Мои абонементы» и «Мои записи» для игрока

## Что будет (Phase 3+)

- ⚪ Оплата картой и через ЕРИП (bePaid) — Phase 3
- ⚪ Автоматические напоминания за 24 ч / 2 ч (APScheduler) — Phase 4
- ⚪ Отчёты и CSV-экспорт для НПД — Phase 5
- ⚪ Production-деплой 24/7 (Docker, PostgreSQL, Caddy) — Phase 6

Подробнее в **[docs/ROADMAP.md](docs/ROADMAP.md)**.

## Документация

Полная документация в [docs/](docs/). Точки входа:

- **[docs/README.md](docs/README.md)** — навигация
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — что сделано, что дальше
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — компоненты и потоки данных
- **[docs/DOMAIN.md](docs/DOMAIN.md)** — предметная область
- **[docs/TAXES_BY.md](docs/TAXES_BY.md)** — налоги РБ + шаблон обращения в МНС
- **[docs/BEPAID.md](docs/BEPAID.md)** — интеграция с bePaid
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — варианты хостинга
- **[docs/operations/status/current-state.md](docs/operations/status/current-state.md)** — текущее состояние проекта

Документация организована по двухслойной схеме:
- **Canonical product docs:** `phases/` → `epics/` → `tasks/` (источник истины о том, что строим)
- **Operations:** `operations/sessions/` + `iterations/` + `status/` (журнал работы и сводки)

## Технологический стек

- Python 3.11+, async везде
- **aiogram 3.13** — Telegram Bot API
- **SQLAlchemy 2.0 async** — ORM
- **SQLite** (dev) / **PostgreSQL** (prod)
- **aiohttp** — приём webhook от bePaid
- **APScheduler** — напоминания (Phase 4)
- **Pydantic Settings** — конфигурация
- **pytest + pytest-asyncio** — тесты

## Запуск локально

```bash
# 1. Зависимости
python -m venv .venv
source .venv/bin/activate   # на Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Конфигурация
cp .env.example .env
# отредактируйте .env: BOT_TOKEN, ADMIN_TELEGRAM_IDS

# 3. Запуск
python -m src.bot.main
```

## Тесты

```bash
python -m pytest tests/ -v
```

На сейчас: **25 тестов проходят** (BookingService 5, SubscriptionService 7, LedgerService 8, payment_flow 4).

## Структура проекта

```
volleyball_bot/
├── src/
│   ├── bot/                     # aiogram-хендлеры, middleware, клавиатуры
│   ├── services/                # бизнес-логика (booking, subscription, ledger, payments)
│   ├── db/                      # модели, репозитории, сессия
│   ├── web/                     # aiohttp для webhook (Phase 3)
│   ├── utils/                   # money, time
│   └── config.py
├── tests/                       # юнит и интеграционные тесты
├── docs/                        # документация (см. docs/README.md)
├── alembic/                     # миграции (Phase 6)
├── requirements.txt
├── .env.example
└── README.md
```

## Лицензия

Личный проект, MIT.
