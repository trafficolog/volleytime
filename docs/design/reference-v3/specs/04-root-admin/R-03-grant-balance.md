# R-03 · Выдача баланса

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Root Admin | Ф2 · Кабинет, Mini App организатора, Root Admin | M | Sonnet | Opus |

## Цель

Ручное начисление баланса организации.

## Макет

- 7 Root Admin → Выдать

## Объём

- Выбор организации
- Количество и причина
- Запись в журнал

## Критерии приёмки

- [ ] Без причины начисление невозможно

## Зависимости

**Нужно до начала:** [P-08](../01-platform/P-08-event-balance.md) Баланс событий, [R-07](../04-root-admin/R-07-audit-log.md) Журнал действий

**Ждут эту задачу:** нет

## Общий функционал

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08](../01-platform/P-08-event-balance.md), [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [P-06](../01-platform/P-06-event-series.md), [W-05](../03-organizer-web/W-05-event-card.md), [R-02](../04-root-admin/R-02-balance-tariffs.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md), [R-08](../04-root-admin/R-08-rename-credits.md). [Подробнее](../links.md#balance)
- **Доступ и аудит** — Права и журнал для всех интерфейсов. С этим связаны: [P-11](../01-platform/P-11-auth-roles.md), [W-16](../03-organizer-web/W-16-auth.md), [M-01](../02-mini-app/M-01-telegram-shell.md), [R-05](../04-root-admin/R-05-platform-settings.md), [R-07](../04-root-admin/R-07-audit-log.md). [Подробнее](../links.md#auth)
