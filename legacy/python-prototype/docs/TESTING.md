# Тестирование

Стратегия тестов для проекта.

## Пирамида

```
        ┌──────────────┐
        │   E2E (мало) │  Полный путь через Telegram (Фаза 6+)
        └──────────────┘
       ┌────────────────┐
       │  Integration   │  Сервис + БД, webhook + БД
       │   (немного)    │
       └────────────────┘
      ┌──────────────────┐
      │     Unit (много) │  Чистая бизнес-логика
      └──────────────────┘
```

## Что тестируем

### Unit-тесты (приоритет 1)

Изолированно тестируем сервисы (бизнес-логика):

- `BookingService` — распределение слотов, лист ожидания, отмены, окно записи.
- `SubscriptionService` — покупка, списание, FIFO, истёкшие, восстановление.
- `PaymentService` — подтверждение, отклонение, идемпотентность.
- `LedgerService` — баланс на дату, категории, история.

**Покрытие:** все ветки логики, особенно ошибочные сценарии (нет места, нет сессий, истёк срок).

### Integration-тесты (приоритет 2)

Сценарии «несколько сервисов вместе»:

- Запись с абонементом: `SubscriptionService.consume_session` + `BookingService.create_booking` в одной транзакции.
- Подтверждение платежа: `PaymentService.confirm` → активация подписки + бронь + ledger.
- Webhook bePaid: разбор payload + проверка подписи + обновление БД (Фаза 3).

### E2E-тесты (приоритет 3)

Через mock Telegram API. Запускать редко, перед релизами. В Фазе 6.

## Стек

| Инструмент | Зачем |
|------------|-------|
| `pytest` | Test runner |
| `pytest-asyncio` | Поддержка `async def test_…` |
| `sqlalchemy[asyncio]` | In-memory SQLite на каждый тест |
| `freezegun` (опционально) | Заморозка времени для тестов scheduler (Фаза 4) |

## Запуск

```bash
# Все тесты
python -m pytest tests/ -v

# Один файл
python -m pytest tests/test_booking_service.py -v

# Один тест
python -m pytest tests/test_booking_service.py::test_first_player_gets_main_slot -v

# С покрытием
pip install pytest-cov
python -m pytest tests/ --cov=src --cov-report=html
```

## Фикстуры

Общая фикстура — in-memory SQLite на каждый тест:

```python
@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as s:
        yield s
    await engine.dispose()
```

## Соглашения

- Имена тестов читаются как утверждения: `test_first_player_gets_main_slot`.
- Один тест — одно поведение.
- Тесты не зависят друг от друга, порядок не важен.
- `assert` максимально явный, с понятным сообщением при ошибке.
- Для денег — `Decimal`, никогда не `float`.

## Текущее покрытие (на 2026-05-24)

| Модуль | Тестов | Покрытие |
|--------|--------|----------|
| BookingService | 5 | ~85% |
| SubscriptionService | 7 | ~90% |
| LedgerService | — | 0% (todo: 2.7.2) |
| PaymentService | — | 0% (todo: 2.7.3) |
| money utils | smoke | ~70% |
| bePaid signature | — | 0% (todo: 3.5) |

Цель к концу Фазы 3: > 70% покрытия по сервисам.

## CI/CD (Фаза 6)

GitHub Actions:
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: python -m pytest tests/ -v
```

## Что НЕ тестируем (осознанно)

- Сам aiogram (это библиотека).
- Сам SQLAlchemy (это библиотека).
- bePaid API (мокируем).
- Telegram Bot API (мокируем в E2E).
- Внешнюю сеть.
