---
id: '5'
status: todo
sync_state: drifted
last_reviewed: 2026-05-28
status_note: 'Полностью расписана: backend (5.1-5.8) и UI (5.9-5.12). 38 задач.'
estimated_hours: '50-70'
depends_on: ['4']
---

# Phase 5: Events + Bookings + Subscriptions

**Цель.** Ядро функциональности платформы: создание событий с площадками, запись игроков (capacity + waitlist), абонементы со списанием сессий, отмена с восстановлением. Порт проверенной бизнес-логики из Python-прототипа на новый стек.

## Контекст

После Phase 4 у нас есть организации, члены, приглашения. Но платформа пока не делает того, ради чего создавалась — **не позволяет записываться на тренировки**. Phase 5 это исправляет.

Здесь оживает ядро, отлаженное в Python-прототипе за два месяца реальной эксплуатации:

- Запись с распределением (capacity → waitlist)
- Атомарное списание сессии абонемента
- FIFO-выбор абонемента по сроку истечения
- Автоматическое продвижение из waitlist при отмене
- Восстановление сессии при отмене брони

**Важное упрощение относительно прототипа:** отказались от концепции `rotation`. В прототипе были main/rotation слоты, но на практике ротация — это организационный момент внутри тренировки (игроки меняются по ходу розыгрыша очков), а не отдельная категория записи. В Phase 5: единый `capacity` + неограниченный `waitlist`.

## Предусловия

- ✅ Phase 4 завершена: organizations, members, invites, permissions, tenant middleware, audit
- ✅ Tenant middleware наполняет `event.context` с org/member/user
- ✅ Permissions module (canX/requireX) работает
- ✅ Тестовая инфраструктура (Vitest + integration PG)

## Definition of Done

### Backend (эта сессия — эпики 5.1-5.8, 5.12)

1. ✅ Owner/organizer создаёт venue (площадку) или указывает текстовый адрес
2. ✅ Owner/organizer создаёт событие (type: training/open_game) с capacity, ценой, временем, deadline отмены
3. ✅ Игрок записывается → попадает в `confirmed` (если есть место) или `waitlisted` (если capacity заполнен)
4. ✅ Запись возможна двумя способами: списание абонемента (atomic) ИЛИ pending_payment (оплата позже в Phase 6)
5. ✅ При списании абонемента — FIFO по expires_at, атомарный consume
6. ✅ Игрок отменяет бронь → если был с абонемента, сессия восстанавливается; первый из waitlist продвигается в confirmed
7. ✅ Booking lifecycle: pending_payment → confirmed → attended/no_show, + cancelled
8. ✅ Owner создаёт subscription plans (total_sessions + опциональный validity_days + цена)
9. ✅ Игрок «покупает» абонемент → subscription создаётся pending (активация при оплате — Phase 6)
10. ✅ Concurrency: последний слот при одновременной записи — ровно один проходит
11. ✅ Cancellation deadline настраивается per-event, после deadline отмена блокируется
12. ✅ Все мутации в audit log
13. ✅ ≥ 30 backend-тестов (integration + race conditions)

### UI (следующая сессия — эпики 5.9-5.11)

14. ✅ Список событий, страница события с записью (sheet выбора метода)
15. ✅ Мои записи, мои абонементы (остаток, срок)
16. ✅ Admin: создание/редактирование события, управление планами, bulk attendance

## Архитектура Phase 5

### Новые модели Drizzle

```
packages/db/src/schema/
├── venues.ts              # ★ площадки (опционально на org)
├── events.ts              # ★ события (training/open_game)
├── bookings.ts            # ★ записи игроков на события
├── subscription-plans.ts  # ★ планы абонементов (per-org)
├── subscriptions.ts       # ★ купленные абонементы игроков
└── relations.ts           # обновляется
```

### Новые модули

```
apps/web/modules/
├── venues/
├── events/
├── bookings/              # ядро: запись, отмена, waitlist promotion
├── subscription-plans/
└── subscriptions/         # consume_session (atomic), FIFO selection
```

### API endpoints (backend этой сессии)

```
/api/organizations/:orgId/venues          GET, POST
/api/organizations/:orgId/venues/:id       GET, PATCH, DELETE

/api/organizations/:orgId/events           GET (list), POST (create)
/api/organizations/:orgId/events/:id        GET, PATCH, POST cancel
/api/organizations/:orgId/events/:id/bookings  GET (список записей события)

/api/organizations/:orgId/events/:id/book   POST (записаться)
/api/organizations/:orgId/bookings/:id       DELETE (отменить свою бронь)
/api/organizations/:orgId/my/bookings        GET (мои записи)

/api/organizations/:orgId/subscription-plans  GET, POST
/api/organizations/:orgId/subscription-plans/:id  PATCH, DELETE

/api/organizations/:orgId/subscriptions       POST (купить/получить)
/api/organizations/:orgId/my/subscriptions    GET (мои абонементы)
```

## Эпики

| ID                                           | Эпик                                       | Задач | Часов | Сессия  |
| -------------------------------------------- | ------------------------------------------ | ----: | ----: | ------- |
| [5.1](../epics/5-1-venues.md)                | Venues CRUD                                |     2 |   2-3 | backend |
| [5.2](../epics/5-2-events.md)                | Events CRUD                                |     4 |   6-8 | backend |
| [5.3](../epics/5-3-bookings-core.md)         | Bookings core (запись, capacity, waitlist) |     5 |  8-10 | backend |
| [5.4](../epics/5-4-subscription-plans.md)    | Subscription plans CRUD                    |     2 |   3-4 | backend |
| [5.5](../epics/5-5-subscriptions.md)         | Subscriptions (consume, FIFO)              |     4 |   6-8 | backend |
| [5.6](../epics/5-6-cancellation-waitlist.md) | Cancellation + waitlist promotion          |     3 |   4-6 | backend |
| [5.7](../epics/5-7-booking-api.md)           | Booking/subscription API endpoints         |     3 |   4-5 | backend |
| [5.8](../epics/5-8-backend-tests.md)         | Backend tests (flows + race)               |     3 |   5-7 | backend |
| [5.9](../epics/5-9-ui-player.md)             | UI player (события, запись, мои записи)    |     5 |  8-10 | UI      |
| [5.10](../epics/5-10-ui-admin.md)            | UI admin (создание событий, планы)         |     3 |   5-6 | UI      |
| [5.11](../epics/5-11-ui-subscriptions.md)    | UI subscriptions (покупка, мои абонементы) |     2 |   3-4 | UI      |
| [5.12](../epics/5-12-integration-tests.md)   | Финальные integration tests                |     2 |   3-4 | UI      |
| [5.13](../epics/5-13-review-fixes.md)        | **Исправления по ревью v0.1.0**            |    20 | 34-46 |
| [5.14](../epics/5-14-review2-fixes.md)       | **Исправления по повторному ревью v0.1.1** |     1 |     1 |

**Итого:** 12 эпиков, ~38 задач, 50-70 часов. Backend (5.1-5.8): ~26 задач. UI (5.9-5.12): ~12 задач.

## Технические заметки

### Утверждённые решения

1. **Event types:** training + open_game (идентичное поведение), tournament_match/custom в enum но не используются
2. **Только одиночные события** — recurring в Phase 15
3. **Слоты: capacity + waitlist** — НЕТ main/rotation (отказались). Окно закрытия записи до старта — Phase 15; в MVP запись закрывается в момент начала события (решение 2026-09-17, Task 5.13.15)
4. **Booking методы в Phase 5:** subscription consume + pending_payment. Cash/transfer — Phase 6, online — Phase 12
5. **Booking методы — технические коды на backend, русские названия статусов в UI**
6. **Booking lifecycle:** pending_payment → confirmed → attended/no_show, + cancelled
7. **pending_payment занимает слот сразу** (TTL-отмена — Phase 15)
8. **Subscription plans scoped by org** — глобальных нет. Возможны бесплатные планы (госорганизации)
9. **Subscription consume атомарно:** `UPDATE SET used = used + 1 WHERE used < total RETURNING`
10. **FIFO по expires_at** (раньше истекающий — первым)
11. **Subscription plan:** total_sessions (обязательно) + validity_days (опционально, null=бессрочно) + price
12. **Subscription создаётся pending**, активируется при оплате (Phase 6). В dev можно сразу active
13. **Waitlist promotion synchronous** без уведомлений (уведомления Phase 8, TTL-подтверждение Phase 15)
14. **Cancellation deadline настраивается per-event** (cancellation_deadline_hours, null = без дедлайна)
15. **Concurrency:** atomic slot increment + unique (user_id, event_id)
16. **Venue:** event.location_text (всегда) + опциональный event.venue_id
17. **Объём:** backend сейчас (5.1-5.8), UI отдельной сессией (5.9-5.12)

### Что НЕ делаем в Phase 5

- ❌ Payments confirm (cash/transfer) — Phase 6
- ❌ Online payments (bePaid) — Phase 12
- ❌ Event credits (платформенная монетизация) — Phase 7
- ❌ Recurring events — Phase 15
- ❌ Waitlist promotion с TTL-подтверждением — Phase 15
- ❌ Уведомления о записи/отмене — Phase 8
- ❌ Полная аналитика посещаемости — Phase 14
- ❌ tournament_match поведение — Phase 16
- ❌ Reminders за 24ч/2ч — Phase 15

### Что переносим из Python-прототипа

- Capacity + waitlist распределение (упрощённая версия main/rotation/waitlist)
- Unique индекс (user_id, event_id) — нельзя записаться дважды
- Атомарное consume_session через `UPDATE ... WHERE used < total RETURNING`
- FIFO subscription selection по expires_at
- Booking lifecycle: pending_payment → confirmed → attended/no_show
- Promote from waitlist при отмене
- Restore session при отмене брони с абонемента

## Ссылки

- [DOMAIN.md](../DOMAIN.md)
- [MIGRATION_STRATEGY.md](../MIGRATION_STRATEGY.md) — что переносим из прототипа
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [4-organizations.md](./4-organizations.md) — предыдущая фаза
