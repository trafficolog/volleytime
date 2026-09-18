# Архитектура

Высокоуровневое описание компонентов и потоков данных.

## Общая схема

```
┌─────────────────┐         ┌──────────────────┐
│  Telegram User  │ ◄─────► │  Telegram Bot    │
└─────────────────┘         │   (aiogram 3)    │
                            └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │   Middlewares    │
                            │ DB, User,        │
                            │ Notifier         │
                            └────────┬─────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
         ┌────────▼──────┐  ┌────────▼──────┐  ┌────────▼──────┐
         │  Handlers     │  │   Services    │  │ Repositories  │
         │ (player/admin)│ →│ booking,      │ →│  User,        │
         │               │  │ subscription, │  │  Training, …  │
         │               │  │ ledger,       │  │               │
         │               │  │ payments,     │  │               │
         │               │  │ notifier      │  │               │
         └───────────────┘  └───────────────┘  └───────┬───────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │   Database       │
                                              │  (SQLite/PG)     │
                                              └──────────────────┘

                            ┌──────────────────┐
              bePaid ─────► │  aiohttp server  │  (Фаза 3)
              webhook       │  /webhooks/bepaid│
                            └────────┬─────────┘
                                     │ verify RSA
                                     │ update Payment
                                     │ confirm Booking
                                     ▼
                            ┌──────────────────┐
                            │   Same DB        │
                            └──────────────────┘

                            ┌──────────────────┐
                            │  APScheduler     │  (Фаза 4)
                            │ - reminders      │
                            │ - close bookings │
                            │ - cleanup        │
                            └──────────────────┘
```

## Слои

### Handlers (presentation)
Получают апдейты Telegram, валидируют входные данные, вызывают сервисы, формируют ответ.

**Правило:** в хендлерах нет бизнес-логики. Только:
- разбор апдейта,
- вызов сервиса,
- формирование текста и клавиатуры.

### Services (business logic)
Чистая бизнес-логика, не зависит от Telegram. Можно тестировать без бота.

Примеры: «можно ли записаться», «есть ли активный абонемент», «списать сессию».

### Repositories (data access)
Запросы к БД. Возвращают модели или примитивы. Не знают про Telegram.

### Models (data)
SQLAlchemy 2.0 ORM, async. Decimal для денег, DateTime(timezone=True) для времени.

## Ключевые решения

### 1. Async везде
Используем `aiogram 3` + `SQLAlchemy 2.0 async` + `aiohttp`. Один event loop, один процесс.

### 2. SQLite → PostgreSQL
Для разработки достаточно SQLite (нулевой setup). В проде — PostgreSQL: транзакции, индексы, конкурентный доступ.

Переключение через `DATABASE_URL` в `.env`:
```
DATABASE_URL=sqlite+aiosqlite:///./volleyball.db
# или
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
```

### 3. Money = Decimal
Никогда не `float`. Везде `Decimal` с округлением до копеек. См. `utils/money.py`.

bePaid принимает суммы в минимальных единицах (копейках): 15.00 BYN → 1500.

### 4. Time = aware datetime
Все `datetime` в БД и коде с явной таймзоной. По умолчанию — `Europe/Minsk`.

### 5. Идемпотентность
Любой обработчик, который меняет состояние от внешнего события (webhook bePaid, повторный клик пользователя), должен быть идемпотентным.

Реализация: уникальные индексы на `bepaid_uid`, на `(user_id, training_id)`.

### 6. Чёткие границы ошибок
Бизнес-логика бросает доменные исключения (`BookingError`, `AlreadyBookedError`, `TrainingClosedError`, `SubscriptionDepletedError`, `PaymentError`). Хендлеры ловят их и показывают пользователю понятный текст. Системные ошибки логируются и идут в Sentry (Фаза 6).

### 7. Long polling в dev, webhook в prod
Long polling — нулевая инфраструктура для разработки.
Webhook — масштабируемее в проде (Telegram сам стучится к нам через HTTPS).

### 8. Cassa (Ledger) отдельной сущностью
Не складываем баланс из платежей на лету. Каждое движение денег — отдельная запись в `LedgerEntry`. Это даёт:
- историю,
- возможность ввести расходы (аренда, мячи) без привязки к платежу,
- лёгкий аудит для налоговой.

### 9. Атомарное списание сессии
`SubscriptionService.consume_session` использует SQL `UPDATE ... WHERE used_sessions < total_sessions`. Если rowcount = 0 → бросаем `SubscriptionDepletedError`. Это защищает от гонок — одну сессию не списать дважды.

## Потоки данных (sequence)

### Запись на тренировку с абонементом

```
User → Bot:           [Записаться]
Bot → BookingService: propose_slot(training_id, user_id)
                      → возвращает SlotType.main + цена
Bot → User:           [Списать с абонемента (3 осталось)] / [Наличными]
User → Bot:           [Списать с абонемента]
Bot → SubscriptionSvc: consume_session(sub_id)  (атомарно)
Bot → BookingService:  create_booking(slot=main, status=confirmed, subscription_id=X)
Bot → User:           "Записаны! Осталось 2 сессии."
```

### Запись наличными (Фаза 2)

```
User → Bot:               [Наличными]
Bot → BookingService:     create_booking(status=pending_payment)
Bot → PaymentService:     create_for_booking(method=cash, status=pending)
Bot → User:               "Бронь создана, принесите N BYN на тренировку"
Bot → Notifier:           уведомление админам с кнопкой [Подтвердить]
...
Admin → Bot:              [Подтвердить #42]
Bot → PaymentService:     confirm(42, admin_id=user.id)
                          → status=succeeded
                          → booking.status=confirmed
                          → ledger.record_income()
Bot → Notifier:           уведомление игроку "оплата подтверждена"
```

### Оплата через bePaid (Фаза 3)

```
User → Bot:                [Оплатить картой]
Bot  → BePaidService:      create_payment_token(amount, order_id=payment_id)
                            → возвращает payment_url
Bot  → User:               кнопка с payment_url
User → bePaid (browser):   вводит карту, оплачивает
bePaid → WebhookServer:    POST /webhooks/bepaid (с RSA-подписью)
WebhookServer:             1. verify signature
                           2. проверить idempotency по bepaid_uid
                           3. UPDATE Payment SET status=succeeded
                           4. confirm Booking / activate Subscription
                           5. record_income в ledger
                           6. notify user через Telegram Bot API
```

## Что не делаем (анти-цели)

- **Не пишем свой UI веб-кабинета.** Всё через Telegram.
- **Не делаем мобильное приложение.** Telegram-бот покрывает 100% потребностей.
- **Не хранимем сами данные карт.** Никогда. Только bePaid.
- **Не используем `print()`.** Только `logging` (структурно).
- **Не используем `float` для денег.** Никогда.

## Конкурентность

### Гонки записи
Между двумя одновременными попытками записаться может возникнуть гонка («дважды занятый последний слот»).

Защиты:
1. Уникальный индекс `(user_id, training_id)` — игрок не запишется дважды.
2. SERIALIZABLE-транзакция в `create_booking` (для PG) или повторная проверка счётчиков (для SQLite).
3. На критичных операциях — `SELECT ... FOR UPDATE` (PG).

В Фазе 2 защиты уровня 1 + 2 достаточно. В Фазе 6 (PG) добавим уровень 3.

### Гонки списания абонемента
Один и тот же абонемент не должен дать 9 записей при наличии 8 сессий.

Защита: атомарный SQL `UPDATE ... SET used_sessions = used_sessions + 1 WHERE id = X AND used_sessions < total_sessions`. Если затронуло 0 строк → бросаем `SubscriptionDepleted`.
