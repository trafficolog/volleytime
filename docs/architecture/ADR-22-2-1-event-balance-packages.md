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
| `version`     | `integer NOT NULL DEFAULT 1`         | токен оптимистичной блокировки; `+1` при каждом изменении строки         |
| `updated_at`  | `timestamptz NOT NULL DEFAULT now()` | обновляет приложение; только для отображения, не для блокировки          |

- Частичный уникальный индекс `event_balance_packages_units_currency_active` на `(units, currency) WHERE archived_at IS NULL`: среди неархивных пакетов нет двух с одинаковым количеством событий в одной валюте (черновики тоже участвуют — иначе публикация черновика нарушила бы правило).
- Сид в той же миграции, идемпотентно: `INSERT … VALUES ('events_10', 10, 5000, 'BYN', NULL, true, 10), ('events_30', 30, 12000, 'BYN', 'popular', true, 20), ('events_100', 100, 35000, 'BYN', NULL, true, 30) ON CONFLICT (code) DO NOTHING`.
- `event_balance_purchase_requests.package_id integer NULL REFERENCES event_balance_packages(id) ON DELETE RESTRICT` и индекс по `package_id`. Разовый бэкфилл в той же миграции (решение владельца 2026-11-19, отменяет прежнее «без бэкфилла»): существующие заявки `status IN ('approved', 'pending')` получают `package_id` сидированного пакета, у которого `(units, amount, currency)` точно совпадают со снимком заявки; несовпавшие и `rejected`/`cancelled` остаются `NULL`. Источник истины заявки — по-прежнему снимок `units`, `amount`, `currency`; `package_id` служит только атрибуции продаж.
- Жёсткого удаления пакета нет ни в API, ни в UI; `RESTRICT` страхует ручные операции.

**Почему `units` и `currency` неизменяемы.** Пакет с кодом `events_30` должен всегда означать 30 событий: на этом держатся атрибуция продаж, понятная история и стабильный контракт покупки по коду. Изменить можно цену, бейдж, видимость и порядок. Другое количество — «Дублировать» с новым количеством (или новый пакет) и архив старого.

### Код пакета

- Код генерирует сервер, клиент его не передаёт: `events_<units>`; если такой код уже занят (в т. ч. архивным пакетом), `events_<units>_2`, `_3`, … — первый свободный. Коды не переиспользуются и не меняются.
- Генерация и вставка — в одной транзакции под `pg_advisory_xact_lock` на ключ каталога; дополнительно `UNIQUE (code)` превращает гонку в повтор (до 3 попыток), а не в 500.
- «Дублировать» создаёт **новый черновик** (`visible = false`, `archived_at = NULL`, `badge` копируется, `sort_order` = исходный + 1) с новым кодом по тому же правилу. Поскольку активный пакет с теми же `(units, currency)` уже есть, дубль обязан прийти с другим `units` — запрос «Дублировать» принимает необязательные `units` и `amount`; без них или с занятым количеством — 409 `event_balance_package.units_taken`. «Дублировать» из архивного пакета с тем же `units` разрешено, только если среди неархивных пакетов нет пакета с этими `(units, currency)` (то же правило частичного индекса). В UI «Дублировать» открывает форму «Новый пакет», предзаполненную копией.

### Валидация (Zod, `.strict()`)

- `units`: целое 1…10 000. `amount`: целое 0…10 000 000 minor units (граница как у сумм кассы и цены зала, ADR 21.4.13). `currency`: только `'BYN'` в v0.4.0 (другие валюты — отдельное решение). `badge`: `null | 'popular' | 'discount' | 'best_price'`. `visible`: boolean. `sortOrder`: целое 0…10 000.
- Ввод цены в форме — мажорные единицы, как в ADR 21.4.13 (`^\d+([.,]\d{1,2})?$`, `toMinor`).
- Ошибки: 422 — схема; 409 `event_balance_package.units_taken` — нарушение частичного уникального индекса; 409 `event_balance_package.stale` — переданный `version` не равен текущему; 409 `event_balance_package.archived` — правка или показ архивного пакета; 404 `event_balance_package.not_found` — нет пакета с таким `id` (только для маршрутов с `{id}`, root уже прошёл проверку). Коды `event_balance_package.*` и `event_balance.package_unavailable` добавляются в `apps/web/server/utils/handle-errors.ts`.
- Бейджи в интерфейсе: `popular` — «Популярный», `best_price` — «Лучшая цена», `discount` — фиксированная подпись «Скидка» (решение владельца 2026-11-19). Вычисляемое «−N%» из макета не вводится.

### Покупка и конкуренция

- Тело покупки организатором прежнее: `{ packageCode: string }`. Схема перестаёт быть `z.enum` констант: `packageCode` — строка `^[a-z0-9_]{1,64}$`, поиск в БД по `code`. OpenAPI-мета в `apps/web/server/api/organizations/[orgId]/event-balance/purchase-requests.post.ts` (сейчас `enum: ['events_10', 'events_30', 'events_100']`) становится `{ type: 'string', pattern: '^[a-z0-9_]{1,64}$' }`.
- **Изменение поведения контракта:** неизвестный код, прошедший шаблон, раньше давал 422 (схема `z.enum`), теперь — 409 `event_balance.package_unavailable`, как скрытый и архивный пакет. 422 остаётся только для кода, не прошедшего шаблон, и прочих ошибок схемы. Реализация обновляет тесты, ожидающие 422 для неизвестного кода: `packages/core` `event-balance/service.integration.test.ts` (код `'nope'`, около строки 340) и `apps/web` `event-balance.integration.test.ts` (код `events_1000`, около строки 209) — оба ожидают 409 `event_balance.package_unavailable`.
- В транзакции заявки пакет читается `SELECT … FOR SHARE`; если пакета нет, он скрыт или в архиве — типизированная ошибка `EventBalancePackageUnavailableError` (`event_balance.package_unavailable`, 409; несуществующий код — тот же ответ, чтобы не раскрывать черновики). Заявка пишет снимок из строки пакета и `package_id`; аудит `event_balance.purchase_requested` дополнительно пишет `packageId`.
- Правка, скрытие и архив пакета берут `FOR UPDATE` той же строки, поэтому сериализуются с созданием заявки: заявка видит либо старую, либо новую версию целиком.
- **Ожидающая заявка не меняется** при правке цены, скрытии или архиве пакета: подтверждение root начисляет `units` снимка, сумма к оплате — `amount` снимка. Архив пакета не отменяет его заявки.
- Правка — оптимистичная блокировка по целому `version` (не по `updatedAt`: `timestamptz` хранит микросекунды, JS `Date` — миллисекунды, сравнение на равенство ненадёжно). `PATCH`, `archive` и смена видимости несут `version`, полученный в списке; `UPDATE … SET …, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2`; ноль строк при существующем `id` — 409 `event_balance_package.stale`, UI перечитывает список. Ответ возвращает новый `version`.
- Константа `EVENT_BALANCE_PACKAGES` уходит из пути выполнения; значения сида живут в SQL миграции. Тесты сида сверяют их с прежними ценами.

### История изменений (`audit_log`)

- Действия: `event_balance_package.created` (в т. ч. дубль — `newValue.duplicatedFromId`), `.updated` (`oldValue`/`newValue` только изменённых полей: `amount`, `badge`, `sortOrder`), `.visibility_changed` (`visible` было/стало), `.archived`. `entity_type = 'event_balance_package'`, `entity_id = id`, `organization_id = NULL` (платформенная запись), актор — текущий root.
- Запись аудита — в той же транзакции, что изменение пакета; провал аудита откатывает изменение.
- Экран «История изменений» читает эти записи (фильтр `entity_type`), keyset-пагинация как в журнале 22.1.2. Сид миграции записей аудита не создаёт.
- Разархивирования нет в v0.4.0: «Удалить» = архив, необратимо из UI; нужен такой же пакет — «Дублировать» из архивного (список архивных доступен по фильтру).

### Продажи и выручка

- Считаются **только заявки `status = 'approved'`**; `pending`, `rejected`, `cancelled` не входят. «Продано» — число заявок, «Выручка» — сумма `amount` снимка; обе величины группируются по валюте снимка (`revenue` — массив `{ currency, sold, amount }`), суммы в разных валютах не складываются.
- Атрибуция заявки к пакету, ровно одна или никакой:
  1. `package_id IS NOT NULL` — к этому пакету (все новые заявки и заявки, связанные бэкфиллом `0041`).
  2. `package_id IS NULL` (заявки до `0041`, не совпавшие с сидом при бэкфилле) — к пакету, у которого `(units, amount, currency)` **текущей строки** совпадают со снимком заявки. Если таких несколько (архивный и активный), выбирается неархивный, иначе с наименьшим `id`. Совпадения нет — заявка попадает в строку «Без пакета (до каталога)».
- Двойного счёта нет: каждая заявка относится не более чем к одному пакету (правило 1 и 2 взаимоисключающие по `package_id`, в правиле 2 — детерминированный выбор одного кандидата), итог по строкам плюс «Без пакета» равен сумме всех подтверждённых заявок.
- Благодаря бэкфиллу подтверждённые заявки сидированных пакетов сохраняют привязку после смены цены. Для оставшихся с `NULL`: после смены цены пакета заявки со снимком прежней цены перестают совпадать с ним и уходят в «Без пакета»; они не прибавляются к пакету по новой цене. Заявки с `package_id` остаются у пакета, их выручка — по снимку (старая цена). Так выручка никогда не пересчитывается по текущей цене.
- Запрос — один агрегат `LEFT JOIN LATERAL` по заявкам; объёмы малы (ручные заявки), материализации не нужно.

### Контракт API (root-only)

Все маршруты — `requireRoot` по конвенции `apps/web/server/utils/root-admin.ts`: без сессии — 401, сессия без `users.is_root_admin` — 403 `forbidden.root_only`. 404 `event_balance_package.not_found` — только несуществующий `id` пакета. `Cache-Control: no-store`, мутации с проверкой Origin/CSRF как в 22.1.x.

- `GET /api/platform/event-balance/packages?archived=false|true` → `{ packages: [{ id, code, units, amount, currency, badge, visible, archivedAt, sortOrder, version, createdAt, updatedAt, pricePerEvent, sales: [{ currency, sold, revenue }] }], unattributed: [{ currency, sold, revenue }] }`. `pricePerEvent` = `amount / units` в minor units, округление half-up до целого; в UI «N,NN Br за событие». Сортировка: `sort_order`, затем `units`, затем `id`.
- `POST /api/platform/event-balance/packages` `{ units, amount, currency?, badge?, visible?, sortOrder? }` → 201 пакет; `visible` по умолчанию `false`.
- `POST /api/platform/event-balance/packages/{id}/duplicate` `{ units?, amount? }` → 201 новый черновик.
- `PATCH /api/platform/event-balance/packages/{id}` `{ version, amount?, badge?, visible?, sortOrder? }` → 200; `units`, `currency`, `code` в теле — 422. Изменение `visible` пишет `.visibility_changed`, остальные поля — `.updated` (одна мутация может дать обе записи).
- `POST /api/platform/event-balance/packages/{id}/archive` `{ version }` → 200; ставит `archived_at = now()`, `visible = false`. Повтор на архивном — 200 без новой записи аудита.
- `GET /api/platform/event-balance/packages/history?cursor=` → записи аудита `entity_type = 'event_balance_package'`.

### Витрина организатора

Кабинет (W-12, 21.2.8) и существующий `GET` баланса группы возвращают `packages` из БД: `visible = true AND archived_at IS NULL`, сортировка `sort_order, units, id`; поля `code, units, amount, currency, badge` (`popular` сохраняется как производное `badge = 'popular'` для совместимости ответа). Черновики, скрытые и архивные пакеты организатор не видит; пустой каталог — витрина «Пакеты временно недоступны».

### Миграция и откат

- `0041` — expand-only: новая таблица, сид, nullable колонка и FK, затем разовый бэкфилл: `UPDATE event_balance_purchase_requests r SET package_id = p.id FROM event_balance_packages p WHERE r.package_id IS NULL AND r.status IN ('approved', 'pending') AND p.code IN ('events_10', 'events_30', 'events_100') AND (p.units, p.amount, p.currency) = (r.units, r.amount, r.currency)`. Совпадение точное, по одному сидированному пакету на тройку (частичный индекс исключает два кандидата); несовпавшие строки остаются `NULL`. Предварительной проверки не нужно: FK ссылается только на только что вставленные строки сида. Миграционный тест проверяет бэкфилл: совпавшие `approved`/`pending` связаны, несовпавшие и `rejected`/`cancelled` — `NULL`, повторный прогон ничего не меняет.
- **Откат приложения на предыдущий релиз (v0.3.x) разрешён без флага, capability label и расширения rollback guard** (принято владельцем 2026-11-19). Старый код не читает таблицу, вставляет заявку без `package_id` (`NULL`) и продаёт по константе. Ограничение, которое фиксируется в runbook: после отката витрина показывает цены константы, а не правки из Root Admin, и пакеты, созданные в Root Admin, недоступны; ожидающие заявки с `package_id` подтверждаются старым кодом по снимку корректно. Это допустимо, потому что оплата ручная и root видит сумму заявки до подтверждения.
- `packages/db/rollback/0041_event_balance_packages.sql` по образцу 0040. Правило: down разрешён, только если каталог в точности равен сиду и все связи заявок — от бэкфилла; тогда снятие колонки теряет лишь восстановимую бэкфиллом информацию. Момент миграции — `created_at` строк сида (`m = (SELECT min(created_at) FROM event_balance_packages WHERE code IN ('events_10','events_30','events_100'))`). Guard отказывает (`RAISE EXCEPTION`), если истинно любое:
  1. в таблице строк не три, или есть код вне `('events_10','events_30','events_100')`;
  2. для какого-либо из трёх кодов хотя бы одна колонка отличается от значения сида — сравнение по каждому коду через `IS DISTINCT FROM` (NULL-безопасно, важно для `badge`) по `units`, `amount`, `currency`, `badge`, `visible`, `archived_at` (сид — `NULL`), `sort_order` (10/20/30) и `version` (сид — 1);
  3. есть заявка с `package_id IS NOT NULL` и `created_at >= m` (связь создана после миграции новым кодом), или связанная заявка, чей снимок `(units, amount, currency)` `IS DISTINCT FROM` сида пакета по `package_id`.

  Иначе снимает FK, колонку и таблицу. Реализация обязана добавить тест rollback: down проходит на чистом сиде с бэкфиллом и отказывает по каждому из условий 1–3 (лишняя строка, изменённый `badge` на `NULL`→значение и обратно, изменённый `sort_order`, заявка с `package_id` после миграции). Обход — решение владельца после `pg_dump -t event_balance_packages -t event_balance_purchase_requests`, затем `pnpm db:rollback` в одной транзакции.

- Реализация добавляет в [deploy runbook](../operations/runbooks/deploy.md) раздел «v0.4.0 event balance packages: no flag, no guard extension (Task 22.2.1)» по образцу раздела 0040 и миграционный тест: старый путь вставки (без `package_id`) работает на новой схеме, сид идемпотентен, CHECK и частичный индекс отказывают.

## Последствия

- `+` Root управляет ценами без деплоя; купленные и ожидающие заявки защищены снимком; история в общем журнале платформы.
- `+` Откат приложения свободен; откат схемы безопасен, пока каталог не трогали.
- `+` Бэкфилл сохраняет привязку подтверждённых и ожидающих заявок сидированных пакетов после смены цены.
- `−` Заявки до `0041`, не совпавшие с сидом, атрибутируются по текущему снимку и после смены цены уходят в «Без пакета».
- `−` После отката приложения витрина возвращается к ценам константы, пакеты Root Admin скрыты.

## Решения владельца (2026-11-19, в чате)

1. `units` и `currency` неизменяемы после создания; другое количество — через «Дублировать» и архив. Подтверждено.
2. Бейдж `discount` — фиксированная подпись «Скидка» вместо вычисляемого «−N%» макета. Подтверждено.
3. Отмена «без бэкфилла»: миграция `0041` выполняет разовый бэкфилл `package_id` для `approved` и `pending` заявок по точному совпадению `(units, amount, currency)` с сидом; несовпавшие остаются `NULL`, атрибуция по снимку — только для них.
4. Откат приложения на v0.3.x с возвратом цен константы и скрытием пакетов, созданных в Root Admin, принят.
