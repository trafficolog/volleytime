# Матрица прав v3

- **Статус:** принято (задача [19.3.1](../tasks/19-3-1-auth-roles.md), `P-11`), 2026-10-13.
- **Область:** кто что может в API — для существующих эндпоинтов и для ресурсов v3 из [ADR v3](./ADR-v3-domain.md#соглашения-api-для-новых-ресурсов). Это контракт: карточка, которая добавляет эндпоинт, реализует строку этой матрицы и добавляет его в IDOR-таблицу. Изменение права — правка этого документа в той же PR.
- **Не область:** UI-состояния входа и «нет доступа» ([20.5.1](../tasks/20-5-1-auth.md)), журнал действий root ([22.1.2](../tasks/22-1-2-audit-log.md)).

## Роли

| Референс (P-11)  | В коде                                                 | Где хранится                |
| ---------------- | ------------------------------------------------------ | --------------------------- |
| игрок            | `player`                                               | `organization_members.role` |
| помощник         | `assistant` — права игрока, модерируется организатором | `organization_members.role` |
| организатор      | `organizer`                                            | `organization_members.role` |
| админ группы     | `owner` — один на группу                               | `organization_members.role` |
| root (платформа) | `users.is_root_admin = true`                           | `users`; не роль в группе   |

Роль в группе действует только при `organization_members.status = 'active'`. Заявка (`pending`) — не участник: видит карточку группы и может выйти (`POST …/members/leave`), остальное — 403 `forbidden.pending_approval`. `blocked`, `left`, `rejected` и отсутствие строки — 403 из tenant middleware (`permission.*`).

**Root не обходит tenant.** У root нет неявного членства: `/api/organizations/{orgId}/…` для него — как для любого не-участника (403). Root-операции живут только под `/api/platform/…` и проходят через `requireRootAdmin(event)` (`apps/web/server/utils/root-admin.ts`), который читает `users.is_root_admin` из базы на каждый запрос: снятие флага действует сразу.

Обозначения уровней ниже:

- **tenant** — любая не снятая связь с группой, включая `pending`;
- **member** — активный участник любой роли (`requireOrgMember`);
- **manager** — `owner` + `organizer` (`requireCanManageContent`, `requireCanManageMembers`);
- **owner** — только `owner` (`requireOrgOwner`);
- **self** — только владелец ресурса (своя запись, своё уведомление); manager — там, где указано;
- **root** — `users.is_root_admin`;
- **auth** — любой вошедший пользователь.

## Общие правила

1. Порядок проверок org-эндпоинта: сессия (401) → tenant middleware: группа существует и активна, пользователь в ней (403/404/410) → роль из матрицы (403 `forbidden.*`) → принадлежность вложенного ресурса группе из пути.
2. **IDOR.** Ресурс из пути или тела (`eventId`, `bookingId`, `paymentId`, `planId`, `venueId`, `subscriptionId`, `inviteId`, `memberId`, …) обязан принадлежать группе из пути. Чужой ресурс неотличим от несуществующего: 404 (или 403 по роли), без названий и данных другой группы, без изменений в базе.
3. Права не кешируются в сессии: роль и статус читаются из базы на каждый запрос (tenant middleware, `requireRootAdmin`).
4. Ответы не раскрывают `email`, `phone`, `telegramUserId`, `isRootAdmin` других пользователей (5.13.2).
5. **Обязательное покрытие.** Каждый файл в `apps/web/server/api/organizations/[orgId]/**` описан в таблице `ROUTES` теста [`idor.integration.test.ts`](../../apps/web/server/__tests__/idor.integration.test.ts) с минимальным уровнем из этой матрицы. Тест проверяет: участник другой группы и root получают 403; чужой вложенный ресурс через свой путь — 403/404 без изменений; роль ниже минимума — 403; положительный контроль — минимальная роль с тем же телом проходит проверку доступа (не 401/403/404). «Без изменений» доказывается снимком строк группы, всего `audit_log` и всех `users`. Новый роут без строки в таблице роняет тест. Эндпоинты вне tenant-префикса (`/api/notifications`, `/api/platform/…`, `/api/levels`) покрывает своим IDOR-тестом карточка-владелец.

## Вход (D-05)

| Способ                       | Где      | Эндпоинт                                 | Проверка                                                                                                                                                                                                                   |
| ---------------------------- | -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telegram Mini App `initData` | Mini App | `POST /api/auth/sign-in/telegram`        | HMAC `WebAppData`, `auth_date` не старше `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` (по умолчанию 3600)                                                                                                                          |
| Привязка Telegram            | Mini App | `POST /api/auth/link/telegram`           | то же + сессия; конфликт — 409 (3.3.4, 3.9.8)                                                                                                                                                                              |
| Email-код                    | веб      | `POST /api/auth/email-otp/…`             | 6 цифр, 5 минут, хеш в базе                                                                                                                                                                                                |
| Telegram Login Widget        | веб      | `POST /api/auth/sign-in/telegram-widget` | `SHA256(bot_token)`-ключ, HMAC полей; `auth_date` не старше `TELEGRAM_LOGIN_WIDGET_MAX_AGE_SECONDS`; выключен, пока `TELEGRAM_LOGIN_WIDGET_ENABLED` не `true`: 404 на любой запрос до разбора тела и проверки конфигурации |

Mini App и Login Widget сходятся в одну Telegram-личность: один `telegram_user_id` — один пользователь, в том числе при одновременном первом входе (проигравший вставку перечитывает созданного пользователя). Если Telegram привязан к email-аккаунту, вход через виджет открывает этот аккаунт. Неверное значение переменных Telegram-входа — ошибка конфигурации: в production сервер не стартует, запрос входа получает 500 и не создаёт сессию. «Код из бота» отложен (D-05).

## Существующие ресурсы (`main`, R0.7 + 19.2.2)

| Ресурс           | Действие и эндпоинт `/api/organizations/{orgId}/…`               | Уровень | Примечание                                                  |
| ---------------- | ---------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| Группа           | `GET /`                                                          | tenant  |                                                             |
|                  | `PATCH /`, `POST /archive`                                       | owner   |                                                             |
| Настройки группы | `GET /settings`                                                  | manager | 19.2.2                                                      |
|                  | `PATCH /settings`                                                | owner   | история в `audit_log`                                       |
| Участники        | `GET /members`                                                   | member  | статусы кроме `active` — manager                            |
|                  | `POST /members/{id}/approve\|reject\|block\|unblock`             | manager | organizer — только `player`/`assistant`; не себя и не owner |
|                  | `PATCH /members/{id}` (роль)                                     | owner   | owner не назначается                                        |
|                  | `PATCH /members/{id}/level` (уровень В1–В4+)                     | manager | только участник своей группы; чужой id — 404                |
|                  | `POST /members/leave`                                            | tenant  | owner не может выйти                                        |
| Приглашения      | `GET /invites`, `POST /invites/{id}/revoke`                      | manager |                                                             |
|                  | `POST /invites`                                                  | manager | роль `organizer`/`assistant` — только owner                 |
| Залы             | `GET /venues`                                                    | member  |                                                             |
|                  | `POST /venues`                                                   | manager |                                                             |
| События          | `GET /events`, `GET /events/{id}`                                | member  | черновики и денежные поля — manager                         |
|                  | `POST /events`, `PATCH /events/{id}`, `POST /events/{id}/cancel` | manager | `venueId` из тела — только своей группы                     |
|                  | `POST /events/{id}/settle`, `POST /events/{id}/attendance`       | manager | `bookingId` из тела — только этого события                  |
| Записи           | `POST /events/{id}/bookings`                                     | member  | `subscriptionId` — только свой и своей группы               |
|                  | `GET /events/{id}/bookings`                                      | manager | без приватных полей                                         |
|                  | `GET /bookings/my`                                               | member  | только свои                                                 |
|                  | `POST /bookings/{id}/cancel`                                     | self    | manager — любую запись группы                               |
| Планы            | `GET /plans`                                                     | member  |                                                             |
|                  | `POST /plans`, `PATCH /plans/{id}`, `POST /plans/{id}/archive`   | manager |                                                             |
| Абонементы       | `POST /subscriptions`, `GET /subscriptions/my`                   | member  | `planId` — только своей группы                              |
| Платежи          | `GET /payments`, `GET /payments/history`                         | manager |                                                             |
|                  | `POST /payments/{id}/confirm\|reject`                            | manager |                                                             |
| Касса            | `GET /ledger`, `POST /ledger/income\|expense`                    | manager | `eventId` из тела — только своей группы                     |
| Журнал           | `GET /audit`                                                     | manager |                                                             |
| Дашборд          | `GET /dashboard`                                                 | member  | денежные блоки — manager                                    |

Вне tenant-префикса: `GET/POST /api/organizations` — auth (свои группы, создание); `GET /api/invites/{token}`, `POST /api/invites/{token}/redeem` — auth; `GET /api/events/{id}/locate` — member группы события, иначе 404; `/api/internal/**` — общий секрет бота, не пользовательская сессия.

## Ресурсы v3 (карточки-владельцы реализуют)

Пути — из [ADR v3](./ADR-v3-domain.md#пути-и-именование).

| Ресурс                    | Действие и эндпоинт                                                                                                                             | Уровень         | Карточка          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------- |
| Уровни В1–В4+             | `GET /api/levels` (справочник)                                                                                                                  | auth            | 19.2.3            |
|                           | уровень участника `PATCH …/members/{id}` `{level}`, уровни группы в `PATCH …/settings`                                                          | manager / owner | 19.2.3            |
| Цена и места              | `GET …/events/{id}/price?seats=N` — реализовано, в IDOR-таблице; черновик — manager                                                             | member          | 20.1.1            |
|                           | `PATCH …/bookings/{id}` `{seats}` — реализовано, в IDOR-таблице; чужая запись группы — 403                                                      | self            | 20.1.2            |
| Приглашение на событие    | `POST …/events/{id}/invites` — реализовано, в IDOR-таблице                                                                                      | manager         | 20.1.3            |
|                           | `POST …/events/{id}/invite-requests` — реализовано, в IDOR-таблице                                                                              | member          | 20.1.3            |
|                           | `GET …/invite-requests`, `POST …/{requestId}/approve\|decline` — реализовано, в IDOR                                                            | manager         | 20.1.3            |
| Предложение места (оффер) | принять / отказаться                                                                                                                            | self            | 20.3.1            |
| Баланс событий            | `GET …/event-balance`, `GET …/event-balance/entries`                                                                                            | manager         | 20.2.1            |
|                           | `POST …/event-balance/purchase-requests`                                                                                                        | owner           | 20.2.1, UI 21.2.8 |
|                           | начисление, исправление, решение по заявке — операторская команда `db:event-balance`                                                            | root            | 20.2.1, UI 22.2.2 |
| Серии и черновики         | `POST …/series/preview`, `POST …/series`, `GET …/series/{id}`, `PATCH …/series/{id}`, `POST …/series/{id}/cancel` — реализовано, в IDOR-таблице | manager         | 20.2.2            |
| Уведомления               | `GET /api/notifications`, `POST /api/notifications/read`                                                                                        | self            | 20.3.2            |
| Сборы                     | `GET …/collections`, `GET …/collections/{id}`                                                                                                   | member          | 21.2.4            |
|                           | `POST/PATCH …/collections`, закрыть, отменить                                                                                                   | manager         | 21.2.4            |
|                           | `POST …/collections/{id}/contributions` (свой взнос)                                                                                            | member          | 21.2.4            |
|                           | подтвердить / отклонить взнос                                                                                                                   | manager         | 21.2.4            |
| Root Admin                | `/api/platform/**`: группы, баланс и гранты, заявки на покупку, настройки, журнал                                                               | root            | 22.x              |

Правила для v3:

- **Уведомления** — только свои (`recipient_user_id = session.user`): чужой `notificationId` — 404 `notification.not_found`; фильтр `organizationId` не расширяет выборку за пределы своих уведомлений.
- **Цена** (20.1.1) — событие чужой группы и черновик для роли ниже manager — 404 `event.not_found`, без суммы и названия; ответ содержит только цену и долю самого запрашивающего, чужие доли не раскрываются.
- **Приглашение на событие** (20.1.3) — событие и запрос другой группы или другого события неотличимы от несуществующих (404 `event.not_found` / `invite_request.not_found`); черновик скрыт от игрока. Токен — 24 символа nanoid (≈144 бита), однократный, со сроком не позже начала события; неизвестный, чужой, отозванный или использованный токен даёт один и тот же 403 `booking.invite_required` (без перечисления), просроченная ссылка этого события — 410 `invite.expired`. Токен приглашения на событие не принимается `GET/POST /api/invites/{token}` (не даёт членства в группе) и не показывается в `GET …/invites`. Список запросов отдаёт игрока только как `{ id, name, telegramUsername, image }`.
- **Серии** (20.2.2) — только manager: серия видит черновики и списывает баланс. Серия другой группы неотличима от несуществующей (404 `series.not_found`); нечисловой id — 404. `venueId` шаблона — только своей группы (422 `event.venue_not_in_org` в предпросмотре и создании, без записи). Даты серии — обычные события: игрок видит опубликованные даты по правилам `GET …/events`, черновики скрыты.
- **Оффер, места, взнос** — действие игрока над своей записью или своим платежом; чужая запись своей группы — 403 (`booking.cannot_cancel_others` и аналоги), чужой группы — 404.
- **Баланс** списывается и возвращается только сервисом (публикация и отмена события); прямой записи в журнал через API нет ни у одной роли, кроме root-грантов 22.2.2 с обязательным комментарием. До 22.2.2 начисления, исправления и решения по заявкам выполняет операторская команда `pnpm db:event-balance` (`packages/db/src/event-balance-operator.ts`, 20.2.1): автор — пользователь с `users.is_root_admin`, проверяется в базе на каждый запуск; причина (комментарий) обязательна для начисления, исправления и отказа; каждое действие пишет строку журнала баланса и `audit_log`. Журнал баланса (`GET …/event-balance/entries`) показывает автора только как `{ id, name }` и события только своей группы.
- **Root** не получает доступа к данным игроков через `/api/organizations/…`; всё, что root видит о группе, отдаёт `/api/platform/…`, и каждое изменяющее действие root пишется в `audit_log` (22.1.2).
