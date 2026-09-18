---
id: "2.14.1"
phase: "2.5"
epic: "2.14"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - DB
depends_on: []
estimated_hours: "2-3"
tags:
  - admin
  - settings
  - infrastructure
---

# Task 2.14.1: Модель AppSetting и SettingsService с кешем

## Цель

Создать модель `AppSetting` в БД (key-value-type) и сервис `SettingsService` с кешированием в памяти. Это база для всего Epic 2.14.

## Контекст

Сейчас настройки в `src/config.py` — нельзя менять без деплоя. Перенос в БД:
- Создать модель и сервис с кешем (эта задача)
- Сделать UI (Task 2.14.2)
- Переключить все usages на сервис (Task 2.14.3)

## Что должно быть сделано

- Новая модель `AppSetting` в `src/db/models.py`:
  ```python
  class AppSetting(Base):
      __tablename__ = "app_settings"

      key: Mapped[str] = mapped_column(String(64), primary_key=True)
      value: Mapped[str] = mapped_column(Text)  # хранится как строка
      value_type: Mapped[str] = mapped_column(String(16))  # int/decimal/bool/string
      description: Mapped[str] = mapped_column(String(255))
      group_name: Mapped[str] = mapped_column(String(32), default="general")
      sort_order: Mapped[int] = mapped_column(Integer, default=0)
      updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
      updated_by_admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
  ```
- Новый сервис `src/services/settings.py`:
  ```python
  class SettingsService:
      _cache: dict[str, Any] = {}
      _loaded: bool = False

      def __init__(self, session: AsyncSession):
          self.session = session

      async def get(self, key: str) -> Any:
          await self._ensure_loaded()
          return self._cache[key]

      async def set(self, key: str, value: Any, admin_id: int) -> None:
          # 1. конвертирует value → string в соответствии с value_type
          # 2. UPDATE в БД
          # 3. обновляет cache
          # 4. AdminLog

      async def get_all(self) -> list[AppSetting]:
          ...

      async def reload_cache(self) -> None:
          # пересчитать кеш из БД
  ```
- Конверторы типов:
  - int: `int(value_str)`
  - decimal: `Decimal(value_str)`
  - bool: `value_str == "true"`
  - string: `value_str`
- Seed-функция `seed_default_settings(session)` для первого запуска. Все 9 настроек из `phases/2-5-extended-admin-panel.md`:
  - `base_training_price` (decimal, 15.00, "Цены")
  - `booking_closes_hours_before` (int, 2, "Тайминги")
  - `default_max_main_slots` (int, 12, "Лимиты")
  - `default_max_rotation_slots` (int, 2, "Лимиты")
  - `pending_payment_ttl_minutes` (int, 15, "Тайминги")
  - `cancellation_refund_hours_before` (int, 24, "Тайминги")
  - `waitlist_promotion_ttl_minutes` (int, 30, "Тайминги")
  - `reminder_24h_enabled` (bool, true, "Уведомления")
  - `reminder_2h_enabled` (bool, true, "Уведомления")
- В `src/bot/main.py` после init_db — вызов `seed_default_settings`

## Критерии приёмки

- Модель создаётся при первом запуске
- Seed выполнен idempotent (повторный запуск не создаёт дублей)
- `await settings.get("base_training_price")` возвращает `Decimal("15.00")`
- После `await settings.set("base_training_price", Decimal("17.00"), admin_id=1)` — следующий `get` возвращает `17.00`
- Изменение пишет в AdminLog
- Тесты: get/set, конвертеры типов, idempotent seed

## Подсказки

- Cache singleton: можно через class-level dict, можно через `lru_cache` или просто `dict` в модуле.
- При первой загрузке `get()` подтягивает все настройки одним запросом, дальше работает с памятью.
- Для конкурентного доступа кеш можно держать в `asyncio.Lock`, но для простоты — read-once-then-cache достаточно.

## Не делать

- Не хранить секреты (BOT_TOKEN, BEPAID_SECRET_KEY) в этой таблице.
- Не делать UI для `value_type` — он задан при создании настройки разработчиком.
- Не давать создавать произвольные настройки через UI — только редактирование тех, что есть в seed.
