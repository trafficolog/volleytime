---
id: "2.14"
phase: "2.5"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: "Базовые настройки бота меняются через UI без деплоя."
---

# Epic 2.14: Настройки через UI

**Цель.** Перенести часть конфигурации из `.env`/`config.py` в БД и дать админу менять её через admin-меню. Секреты остаются в `.env`.

## Контекст

Настройки типа «базовая цена», «окно записи», «лимиты слотов» сейчас в коде. Менять — деплой. Это неудобно для регулярных правок («давайте с октября подымем цены до 17, окно записи увеличим до 3 ч»).

Решение: новая таблица `app_settings` с key-value хранилищем, сервис `SettingsService` с кешированием в памяти (с инвалидацией при изменении).

## Definition of Done

- Новая модель `AppSetting` в `src/db/models.py`: key, value (string), value_type (int/decimal/bool/string), description, updated_at, updated_by_admin_id
- `SettingsService` с методами `get(key)`, `set(key, value, admin_id)`, `get_all()`, `reload_cache()`
- В кеше держим прочитанные значения, кеш инвалидируется при `set`
- Дефолтные значения настроек создаются при первом запуске:
  - `base_training_price` = 15.00
  - `booking_closes_hours_before` = 2
  - `default_max_main_slots` = 12
  - `default_max_rotation_slots` = 2
  - `pending_payment_ttl_minutes` = 15
  - `cancellation_refund_hours_before` = 24
  - `waitlist_promotion_ttl_minutes` = 30
  - `reminder_24h_enabled` = true
  - `reminder_2h_enabled` = true
- В admin_menu — кнопка «⚙️ Настройки»
- Список настроек по группам: «Цены», «Лимиты», «Тайминги», «Уведомления»
- Клик на настройку → текущее значение + кнопка «изменить» → FSM с валидацией типа
- Изменение пишется в AdminLog
- Защита: secret-настройки (`bot_token`, `bepaid_secret_key`, etc.) **не отображаются** в UI и не сохраняются в `app_settings`

## Задачи

| ID | Задача | Статус |
|----|--------|--------|
| [2.14.1](../tasks/2-14-1-app-settings-model-and-service.md) | Модель AppSetting и SettingsService с кешем | todo |
| [2.14.2](../tasks/2-14-2-settings-ui.md) | UI просмотра и редактирования настроек | todo |
| [2.14.3](../tasks/2-14-3-migrate-config-usages.md) | Перевести услуг на SettingsService | todo |

## Не делать

- Не хранить секреты в БД (BOT_TOKEN, BEPAID_SECRET_KEY).
- Не делать UI для DATABASE_URL, PUBLIC_URL — инфраструктурные, только через `.env`.
- Не делать «restore defaults» в первой итерации — пусть админ помнит, что менял.
- Не валидировать кросс-зависимости (типа «cancellation_refund_hours_before > booking_closes_hours_before») — оставляем на разум админа.
