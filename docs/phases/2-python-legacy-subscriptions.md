---
id: '2'
status: done
sync_state: archived
last_reviewed: 2026-05-25
status_note: 'Python-прототип Phase 2 legacy. Все 21 задача выполнена.'
---

# Phase 2: Subscriptions + Manual Payments (legacy)

**Статус:** ✅ Архивирован в `legacy/python-prototype/`.

**Что было реализовано:**

- Абонементы (4x/8x/12x) с атомарным списанием
- Ручные платежи cash с подтверждением админом
- Касса (Ledger) с категориями доходов и расходов
- Меню игрока (мои абонементы, мои записи)
- Расширенная админ-панель (Phase 2.5 в старой нумерации)
- 7 эпиков, 21 задача, 25 тестов

**Что НЕ переносится в новый стек:**

- Конкретный код, тесты, структура src/
- SQLAlchemy modelи

**Что переносится:**

- Domain knowledge (см. MIGRATION_STRATEGY.md)
- Шаблоны бизнес-логики (slot distribution, FIFO subscription, atomic consume)

Полная история — в `legacy/python-prototype/docs/`.
