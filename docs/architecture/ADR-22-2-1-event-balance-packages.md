# ADR 22.2.1 · Каталог пакетов баланса событий в БД (R-02)

- **Статус:** принято решениями владельца 2026-11-19 ([D-18](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-18)); шаг схемы и контракта по правилу 3 [ORCHESTRATION](../ORCHESTRATION.md) (`claude-opus-5-5`) до реализации карточки [22.2.1](../tasks/22-2-1-balance-tariffs.md).
- **Область:** таблица `event_balance_packages`, миграция `0041`, связь заявки с пакетом, контракт `/api/platform/event-balance/packages`, история изменений через `audit_log`, «Дублировать», цена за событие, продажи и выручка по пакету, витрина кабинета организатора.
- **Не область:** блок demo-квоты на экране R-02 и начисления root ([22.2.2](../tasks/22-2-2-grant-balance.md)); онлайн-оплата (D-07); тариф и стартовый баланс при создании организации ([22.1.8](../tasks/22-1-8-root-org-create-plan-credits.md)).

## Контекст

До 22.2.1 каталог — константа `EVENT_BALANCE_PACKAGES` в `packages/core/src/event-balance/config.ts` (`events_10` 10 → 5 000, `events_30` 30 → 12 000 «популярный», `events_100` 100 → 35 000, BYN, minor units; цены подтверждены владельцем 2026-10-14, уточнение к D-11). Заявка `event_balance_purchase_requests` (миграция `0024`) хранит снимок `units`, `amount`, `currency` и не ссылается на пакет; подтверждение root начисляет `units` снимка. Макет R-02 (`handoff/screens-admin.jsx`, экран Credits; `screens-admin-forms.jsx`, `AdminPackCreate`) требует управлять пакетами из Root Admin: создать, скрыть, изменить, дублировать, удалить, видеть «цену за 1», продажи и выручку. Критерий карточки: изменение цены не трогает купленные пакеты.

Терминология — D-10: в интерфейсе «баланс событий», единица — «событие»; слово «credit» из макета не переносится («Количество событий», «Br за событие», «Новый пакет»).

## Решение

### Схема `event_balance_packages` (миграция `0041_event_balance_packages`)

| Колонка       | Тип                                  | Правило                                                                  |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `id`          | `serial` PK                          |                                                                          |
| `code`        | `text NOT NULL`                      | `UNIQUE`; CHECK `code ~ '^[a-z0-9_]{1,64}$'`; не меняется после создания |
| `units`       | `integer NOT NULL`                   | CHECK `units > 0`; не меняется после создания (ниже)                     |
| `amount`      | `integer NOT NULL`                   | minor units; CHECK `amount >= 0`                                         |
| `currency`    | `varchar(8) NOT NULL DEFAULT 'BYN'`  | не меняется после создания                                               |
| `badge`       | `text NULL`                          | CHECK `badge IS NULL OR badge IN ('popular', 'discount', 'best_price')`  |
| `visible`     | `boolean NOT NULL DEFAULT false`     | `false` — черновик/скрыт                                                 |
| `archived_at` | `timestamptz NULL`                   | архив = «Удалить»; CHECK `archived_at IS NULL OR NOT visible`            |
| `sort_order`  | `integer NOT NULL DEFAULT 0`         | порядок в витрине и списке                                               |
| `created_at`  | `timestamptz NOT NULL DEFAULT now()` |                                                                          |
| `updated_at`  | `timestamptz NOT NULL DEFAULT now()` | обновляет приложение; токен оптимистичной блокировки                     |

- Частичный уникальный индекс `event_balance_packages_units_currency_active` на `(units, currency) WHERE archived_at IS NULL`: среди неархивных пакетов нет двух с одинаковым количеством событий в одной валюте (черновики тоже участвуют — иначе публикация черновика нарушила бы правило).
- Сид в той же миграции, идемпотентно: `INSERT … VALUES ('events_10', 10, 5000, 'BYN', NULL, true, 10), ('events_30', 30, 12000, 'BYN', 'popular', true, 20), ('events_100', 100, 35000, 'BYN', NULL, true, 30) ON CONFLICT (code) DO NOTHING`.
- `event_balance_purchase_requests.package_id integer NULL REFERENCES event_balance_packages(id) ON DELETE RESTRICT` и индекс по `package_id`. Бэкфилла нет: существующие заявки остаются с `NULL`. Источник истины заявки — по-прежнему снимок `units`, `amount`, `currency`; `package_id` служит только атрибуции продаж.
- Жёсткого удаления пакета нет ни в API, ни в UI; `RESTRICT` страхует ручные операции.

**Почему `units` и `currency` неизменяемы.** Пакет с кодом `events_30` должен всегда означать 30 событий: на этом держатся атрибуция продаж, понятная история и стабильный контракт покупки по коду. Изменить можно цену, бейдж, видимость и порядок. Другое количество — «Дублировать» с новым количеством (или новый пакет) и архив старого.

### Код пакета

- Код генерирует сервер, клиент его не передаёт: `events_<units>`; если такой код уже занят (в т. ч. архивным пакетом), `events_<units>_2`, `_3`, … — первый свободный. Коды не переиспользуются и не меняются.
- Генерация и вставка — в одной транзакции под `pg_advisory_xact_lock` на ключ каталога; дополнительно `UNIQUE (code)` превращает гонку в повтор (до 3 попыток), а не в 500.
- «Дублировать» создаёт **новый черновик** (`visible = false`, `archived_at = NULL`, `badge` копируется, `sort_order` = исходный + 1) с новым кодом по тому же правилу. Поскольку активный пакет с теми же `(units, currency)` уже есть, дубль обязан прийти с другим `units` — запрос «Дублировать» принимает необязательные `units` и `amount`; без них или с занятым количеством — 409 `event_balance_package.units_taken`. В UI «Дублировать» открывает форму «Новый пакет», предзаполненную копией.

### Валидация (Zod, `.strict()`)

- `units`: целое 1…10 000. `amount`: целое 0…10 000 000 minor units (граница как у сумм кассы и цены зала, ADR 21.4.13). `currency`: только `'BYN'` в v0.4.0 (другие валюты — отдельное решение). `badge`: `null | 'popular' | 'discount' | 'best_price'`. `visible`: boolean. `sortOrder`: целое 0…10 000.
- Ввод цены в форме — мажорные единицы, как в ADR 21.4.13 (`^\d+([.,]\d{1,2})?$`, `toMinor`).
- Ошибки: 422 — схема; 409 `event_balance_package.units_taken` — нарушение частичного уникального индекса; 409 `event_balance_package.stale` — устаревший `updatedAt`; 409 `event_balance_package.archived` — правка или показ архивного пакета; 404 — нет пакета.
- Бейджи в интерфейсе: `popular` — «Популярный», `best_price` — «Лучшая цена», `discount` — «Скидка». Вычисляемое «−N%» из макета не вводится (см. вопросы владельцу).

### Покупка и конкуренция

- Контракт покупки организатором не меняется: `{ packageCode: string }`. Схема перестаёт быть `z.enum` констант: `packageCode` — строка `^[a-z0-9_]{1,64}$`, поиск в БД по `code`.
- В транзакции заявки пакет читается `SELECT … FOR SHARE`; если пакета нет, он скрыт или в архиве — типизированная ошибка `EventBalancePackageUnavailableError` (`event_balance.package_unavailable`, 409; несуществующий код — тот же ответ, чтобы не раскрывать черновики). Заявка пишет снимок из строки пакета и `package_id`; аудит `event_balance.purchase_requested` дополнительно пишет `packageId`.
- Правка, скрытие и архив пакета берут `FOR UPDATE` той же строки, поэтому сериализуются с созданием заявки: заявка видит либо старую, либо новую версию целиком.
- **Ожидающая заявка не меняется** при правке цены, скрытии или архиве пакета: подтверждение root начисляет `units` снимка, сумма к оплате — `amount` снимка. Архив пакета не отменяет его заявки.
- Правка — оптимистичная блокировка: `PATCH` несёт `updatedAt`, полученный в списке; несовпадение — 409 `event_balance_package.stale`, UI перечитывает список.
- Константа `EVENT_BALANCE_PACKAGES` уходит из пути выполнения; значения сида живут в SQL миграции. Тесты сида сверяют их с прежними ценами.

### История изменений (`audit_log`)

- Действия: `event_balance_package.created` (в т. ч. дубль — `newValue.duplicatedFromId`), `.updated` (`oldValue`/`newValue` только изменённых полей: `amount`, `badge`, `sortOrder`), `.visibility_changed` (`visible` было/стало), `.archived`. `entity_type = 'event_balance_package'`, `entity_id = id`, `organization_id = NULL` (платформенная запись), актор — текущий root.
- Запись аудита — в той же транзакции, что изменение пакета; провал аудита откатывает изменение.
- Экран «История изменений» читает эти записи (фильтр `entity_type`), keyset-пагинация как в журнале 22.1.2. Сид миграции записей аудита не создаёт.
- Разархивирования нет в v0.4.0: «Удалить» = архив, необратимо из UI; нужен такой же пакет — «Дублировать» из архивного (список архивных доступен по фильтру).

### Продажи и выручка

- Считаются **только заявки `status = 'approved'`**; `pending`, `rejected`, `cancelled` не входят. «Продано» — число заявок, «Выручка» — сумма `amount` снимка, по валюте снимка.
- Атрибуция заявки к пакету, ровно одна или никакой:
  1. `package_id IS NOT NULL` — к этому пакету (все новые заявки).
  2. `package_id IS NULL` (заявки до `0041`) — к пакету, у которого `(units, amount, currency)` **текущей строки** совпадают со снимком заявки. Если таких несколько (архивный и активный), выбирается неархивный, иначе с наименьшим `id`. Совпадения нет — заявка попадает в строку «Без пакета (до каталога)».
- Двойного счёта нет: каждая заявка относится не более чем к одному пакету (правило 1 и 2 взаимоисключающие по `package_id`, в правиле 2 — детерминированный выбор одного кандидата), итог по строкам плюс «Без пакета» равен сумме всех подтверждённых заявок.
- После смены цены пакета старые заявки со снимком прежней цены и `NULL` в `package_id` перестают совпадать с ним и уходят в «Без пакета»; они не прибавляются к пакету по новой цене. Заявки с `package_id` остаются у пакета, их выручка — по снимку (старая цена). Так выручка никогда не пересчитывается по текущей цене.
- Запрос — один агрегат `LEFT JOIN LATERAL` по заявкам; объёмы малы (ручные заявки), материализации не нужно.

### Контракт API (root-only)

Все маршруты — `requireRoot` (не root — 404, как прочие `/api/platform/*`), `Cache-Control: no-store`, мутации с проверкой Origin/CSRF как в 22.1.x.

- `GET /api/platform/event-balance/packages?archived=false|true` → `{ packages: [{ id, code, units, amount, currency, badge, visible, archivedAt, sortOrder, createdAt, updatedAt, pricePerEvent, sold, revenue }], unattributed: { sold, revenue, currency } }`. `pricePerEvent` = `amount / units` в minor units, округление half-up до целого; в UI «N,NN Br за событие». Сортировка: `sort_order`, затем `units`, затем `id`.
- `POST /api/platform/event-balance/packages` `{ units, amount, currency?, badge?, visible?, sortOrder? }` → 201 пакет; `visible` по умолчанию `false`.
- `POST /api/platform/event-balance/packages/{id}/duplicate` `{ units?, amount? }` → 201 новый черновик.
- `PATCH /api/platform/event-balance/packages/{id}` `{ updatedAt, amount?, badge?, visible?, sortOrder? }` → 200; `units`, `currency`, `code` в теле — 422. Изменение `visible` пишет `.visibility_changed`, остальные поля — `.updated` (одна мутация может дать обе записи).
- `POST /api/platform/event-balance/packages/{id}/archive` `{ updatedAt }` → 200; ставит `archived_at = now()`, `visible = false`. Повтор на архивном — 200 без новой записи аудита.
- `GET /api/platform/event-balance/packages/history?cursor=` → записи аудита `entity_type = 'event_balance_package'`.

### Витрина организатора

Кабинет (W-12, 21.2.8) и существующий `GET` баланса группы возвращают `packages` из БД: `visible = true AND archived_at IS NULL`, сортировка `sort_order, units, id`; поля `code, units, amount, currency, badge` (`popular` сохраняется как производное `badge = 'popular'` для совместимости ответа). Черновики, скрытые и архивные пакеты организатор не видит; пустой каталог — витрина «Пакеты временно недоступны».

### Миграция и откат

- `0041` — expand-only: новая таблица, сид, nullable колонка и FK без бэкфилла. Предварительной проверки не нужно: `package_id` во всех строках `NULL`, FK выполняется.
- **Откат приложения на предыдущий релиз (v0.3.x) разрешён без флага, capability label и расширения rollback guard.** Старый код не читает таблицу, вставляет заявку без `package_id` (`NULL`) и продаёт по константе. Ограничение, которое фиксируется в runbook: после отката витрина показывает цены константы, а не правки из Root Admin, и пакеты, созданные в Root Admin, недоступны; ожидающие заявки с `package_id` подтверждаются старым кодом по снимку корректно. Это допустимо, потому что оплата ручная и root видит сумму заявки до подтверждения.
- `packages/db/rollback/0041_event_balance_packages.sql` по образцу 0040: отказывает (`RAISE EXCEPTION`), пока `SELECT EXISTS (SELECT 1 FROM event_balance_purchase_requests WHERE package_id IS NOT NULL) OR EXISTS (SELECT 1 FROM event_balance_packages WHERE code NOT IN ('events_10','events_30','events_100') OR archived_at IS NOT NULL OR (code, units, amount, currency, badge, visible) NOT IN (сид))` истинно — атрибуция и правки каталога не восстанавливаются. Иначе снимает FK, колонку и таблицу. Обход — решение владельца после `pg_dump -t event_balance_packages -t event_balance_purchase_requests`, затем `pnpm db:rollback` в одной транзакции.
- Реализация добавляет в [deploy runbook](../operations/runbooks/deploy.md) раздел «v0.4.0 event balance packages: no flag, no guard extension (Task 22.2.1)» по образцу раздела 0040 и миграционный тест: старый путь вставки (без `package_id`) работает на новой схеме, сид идемпотентен, CHECK и частичный индекс отказывают.

## Последствия

- `+` Root управляет ценами без деплоя; купленные и ожидающие заявки защищены снимком; история в общем журнале платформы.
- `+` Откат приложения свободен; откат схемы безопасен, пока каталог не трогали.
- `−` Атрибуция заявок до `0041` после первой смены цены пакета уходит в «Без пакета» (бэкфилла нет по решению владельца).
- `−` После отката приложения витрина возвращается к ценам константы.

## Вопросы владельцу (не блокируют реализацию)

1. Неизменяемость `units` и `currency` у созданного пакета (другое количество — через «Дублировать» и архив).
2. Бейдж `discount` — фиксированная подпись «Скидка» вместо вычисляемого «−N%» макета.
3. Без бэкфилла `package_id` старые подтверждённые заявки теряют привязку к пакету после смены его цены; разовый бэкфилл по совпадению снимка в миграции убрал бы это, но противоречит решению «no backfill».
