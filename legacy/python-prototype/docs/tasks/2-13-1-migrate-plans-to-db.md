---
id: "2.13.1"
phase: "2.5"
epic: "2.13"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - DB
depends_on: []
estimated_hours: "2"
tags:
  - admin
  - subscriptions
  - migration
  - plans
---

# Task 2.13.1: Миграция планов абонементов в БД

## Цель

Перенести Python-константы `DEFAULT_PLANS` из `services/subscription.py` в таблицу `subscription_plans` в БД. При первом запуске бота — автозаполнение тремя дефолтными планами.

## Контекст

Сейчас в `services/subscription.py`:
```python
DEFAULT_PLANS = [
    SubscriptionPlan(code="4x", total_sessions=4, price=Decimal("56.00"), ...),
    SubscriptionPlan(code="8x", ...),
    SubscriptionPlan(code="12x", ...),
]
```

Эти константы используются для UX и для логики. После миграции — все источники должны читать из БД.

## Что должно быть сделано

- Новая модель `SubscriptionPlan` в `src/db/models.py`:
  ```python
  class SubscriptionPlan(Base):
      __tablename__ = "subscription_plans"

      id: Mapped[int] = mapped_column(primary_key=True)
      code: Mapped[str] = mapped_column(String(16), unique=True)
      title: Mapped[str] = mapped_column(String(100))
      total_sessions: Mapped[int] = mapped_column(Integer)
      price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
      valid_days: Mapped[int] = mapped_column(Integer)
      is_active: Mapped[bool] = mapped_column(Boolean, default=True)
      sort_order: Mapped[int] = mapped_column(Integer, default=0)
      created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
      updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
  ```
- Переименовать существующий dataclass `SubscriptionPlan` в `SubscriptionPlanData` (или сделать его TypedDict), чтобы не конфликтовать с моделью
- Новый репозиторий `src/db/repositories/subscription_plan.py`:
  - `list_all(only_active: bool = False) -> list[SubscriptionPlan]`
  - `get_by_code(code: str) -> SubscriptionPlan | None`
  - `create(...)`, `update(...)`, `set_active(id, value)`
- При запуске бота (в `src/bot/main.py` после `init_db`):
  - Проверить: если в `subscription_plans` нет записей — заполнить тремя дефолтными
  - Если есть — ничего не делать (idempotent seed)
- В `services/subscription.py` функция `get_plan(code)` теперь берёт из БД через `SubscriptionPlanRepository`, а не из константы
- Все вызовы `DEFAULT_PLANS` в UX (keyboards.py, handlers) — заменить на `await repo.list_all(only_active=True)`
- Поле `Subscription.price` (уже есть) — остаётся как «зафиксированная цена на момент покупки», не зависит от изменений плана

## Критерии приёмки

- Модель `SubscriptionPlan` создаётся в БД при первом запуске
- При первом запуске — три плана в БД (4x/8x/12x с правильными ценами)
- При повторном запуске — дубликатов не создаётся (idempotent)
- Существующий тест `test_plans_consistent` адаптирован под чтение из БД
- Покупка абонемента работает (через flow Phase 2)
- Уже купленные абонементы сохраняют свою price даже если план изменился

## Подсказки

- Seed-функция: `async def seed_default_plans(session): existing = await session.scalar(select(func.count(SubscriptionPlan.id))); if existing == 0: session.add_all([...]); await session.commit()`.
- Не использовать `INSERT OR IGNORE` (специфично для SQLite). Лучше `SELECT COUNT` + `INSERT` в одной транзакции.

## Не делать

- Не делать Alembic-миграцию в этой задаче (Phase 6). `Base.metadata.create_all` справится.
- Не менять схему `Subscription` — она и так нормальная (price зафиксирован).
- Не удалять старые `DEFAULT_PLANS` константы — переименовать в `LEGACY_DEFAULT_PLANS` или удалить совсем после полного перевода.
