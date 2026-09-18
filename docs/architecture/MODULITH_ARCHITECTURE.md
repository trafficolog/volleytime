# 🧩 Modulith Architecture

> **Last updated:** 2026-05-25
> Детали модульной архитектуры платформы. Что такое модуль, какие правила, как модули общаются.

---

## Что такое modulith

Modulith (modular monolith) — это монолит, разделённый внутри на чёткие модули с явными границами. Один deploy, одна БД, но **бизнес-логика разделена по доменам**, как если бы каждый модуль был сервисом.

**Главное преимущество перед микросервисами на нашей стадии:**

- Один deploy = простой operations
- Одна БД = транзакции работают, no eventual consistency
- Один процесс = нет network overhead
- Но: если когда-то понадобится вынести модуль в сервис — границы уже есть

---

## Структура одного модуля

```
apps/web/modules/<module-name>/
├── service.ts          # публичный API модуля
├── repository.ts       # Drizzle queries
├── schemas.ts          # Zod / Valibot валидация
├── permissions.ts      # проверки доступа
├── errors.ts           # доменные исключения
├── types.ts            # внутренние типы
└── __tests__/
    └── service.test.ts
```

### service.ts — публичный API

Экспортирует функции, которые могут вызываться из:

- API endpoints (`server/api/**`)
- Других модулей
- Scheduler-jobs (Phase 15)

```typescript
// modules/bookings/service.ts
export async function proposeSlot(
  ctx: ServiceContext,
  params: { eventId: number, userId: number }
): Promise<BookingProposal> { ... }

export async function createBooking(
  ctx: ServiceContext,
  params: CreateBookingInput
): Promise<Booking> { ... }
```

### repository.ts — БД-уровень

```typescript
// modules/bookings/repository.ts
export async function getBookingsByEvent(ctx: ServiceContext, eventId: number): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.organizationId, ctx.org.id), // tenant scoping!
      ),
    )
}
```

### schemas.ts — валидация

```typescript
import { z } from 'zod'

export const CreateBookingInput = z.object({
  eventId: z.number().int().positive(),
  userId: z.number().int().positive(),
  paymentMethod: z.enum(['subscription', 'cash', 'online']),
})

export type CreateBookingInput = z.infer<typeof CreateBookingInput>
```

### permissions.ts

```typescript
export async function canManageBooking(user: User, booking: Booking): Promise<boolean> {
  // owner of booking can cancel own
  if (booking.userId === user.id) return true
  // org organizers can manage any
  return await isOrgOrganizer(user, booking.organizationId)
}
```

### errors.ts

```typescript
export class BookingError extends Error {}
export class AlreadyBookedError extends BookingError {
  code = 'booking.already_booked'
}
export class EventClosedError extends BookingError {
  code = 'booking.event_closed'
}
```

---

## ServiceContext

Каждая service-функция принимает `ServiceContext` как первый параметр. Это:

- Текущий пользователь
- Текущая организация (tenant)
- Объект транзакции БД (если внутри tx)
- request ID для трассировки

```typescript
type ServiceContext = {
  user: User
  org: Organization
  db: DrizzleTransactionOrDb // в обычном случае — db; в tx — tx
  requestId: string
}
```

Это даёт:

- Автоматический tenant-scoping (org всегда известен)
- Audit trail (user известен)
- Composable transactions (можно вызывать другие service внутри tx)

---

## Список модулей

| Phase | Модуль             | Назначение                                       | Зависит от                      |
| ----: | ------------------ | ------------------------------------------------ | ------------------------------- |
|     3 | `auth`             | better-auth integration                          | —                               |
|     3 | `users`            | глобальные user CRUD                             | auth                            |
|     4 | `organizations`    | organization CRUD, settings                      | users                           |
|     4 | `members`          | OrganizationMember management, roles             | organizations                   |
|     4 | `invites`          | InviteLink, deeplinks, onboarding flow           | members                         |
|     4 | `audit`            | AuditLog для всех действий                       | —                               |
|     5 | `venues`           | venue CRUD                                       | organizations                   |
|     5 | `events`           | event CRUD, statuses, slot limits                | organizations, venues           |
|     5 | `bookings`         | booking, slot distribution, waitlist             | events, members                 |
|     5 | `subscriptions`    | subscription + plans CRUD, consume_session, FIFO | events, payments                |
|     6 | `payments`         | payment lifecycle, confirm/fail                  | bookings, subscriptions         |
|     6 | `ledger`           | LedgerEntry, balance, corrections                | payments                        |
|     7 | `credits`          | EventCredit accounts, transactions               | organizations                   |
|     7 | `platform-billing` | platform-level admin, plans, addons              | credits                         |
|     8 | `notifications`    | Telegram-уведомления                             | (используется всеми)            |
|    11 | `contributions`    | ContributionCampaign + Contribution              | organizations, ledger           |
| 12-13 | `online-payments`  | bePaid integration, webhook                      | payments                        |
|    14 | `reports`          | отчёты, CSV-экспорт                              | ledger, bookings, subscriptions |
|    15 | `scheduler`        | job runner, reminders, TTL                       | (используется всеми)            |
|    16 | `matches`          | Match, sets, score actions, timeline             | events                          |
|    16 | `event-staff`      | назначение судей на события                      | members, events                 |
|    16 | `mvp-voting`       | MVP voting                                       | matches                         |
|    16 | `standings`        | расчёт турнирной таблицы                         | matches                         |
|    17 | `tournaments`      | Tournament CRUD, schedule generation             | matches, events                 |
|    17 | `teams`            | TournamentTeam, generation algorithms            | tournaments                     |
|    18 | `crm`              | PlayerProfile, notes, tags, segments             | members                         |

---

## Правила взаимодействия модулей

### Правило 1: только через public service

❌ **Плохо:**

```typescript
// modules/bookings/service.ts
import { subscriptions } from '@/packages/db/schema'

async function createBookingWithSubscription(...) {
  // прямой UPDATE на чужой таблице
  await db.update(subscriptions).set({ usedSessions: ... }).where(...)
}
```

✅ **Хорошо:**

```typescript
// modules/bookings/service.ts
import { subscriptionService } from '@/modules/subscriptions'

async function createBookingWithSubscription(ctx, params) {
  await subscriptionService.consumeSession(ctx, params.subscriptionId)
  // ...
}
```

### Правило 2: transactions через ServiceContext

❌ **Плохо:**

```typescript
async function createBookingWithSubscription(params) {
  await db.transaction(async (tx) => {
    await subscriptionService.consumeSession(tx, ...)  // tx прокинут как arg
    await bookingRepository.create(tx, ...)            // tx прокинут как arg
  })
}
```

✅ **Хорошо:**

```typescript
async function createBookingWithSubscription(ctx, params) {
  await db.transaction(async (tx) => {
    const txCtx = { ...ctx, db: tx }
    await subscriptionService.consumeSession(txCtx, ...)
    await bookingRepository.create(txCtx, ...)
  })
}
```

Это работает потому, что `ctx.db` подменяется на транзакцию, а все downstream-вызовы используют `ctx.db`.

### Правило 3: типы из @/packages/shared

Если несколько модулей используют один тип (например, `Money`, `BookingStatus`) — он живёт в `packages/shared`, а не в одном из модулей.

### Правило 4: cross-module events опционально

В Phase 3-15 — нет event bus, всё синхронно. Один модуль вызывает другой через прямой вызов service.

В Phase 16+ может появиться event bus для:

- асинхронных side-effects (например, notification при confirm)
- интеграции с внешними системами

Но это **решение Phase 16**, не сейчас.

### Правило 5: модуль не знает о HTTP

Модули не зависят от Nitro / H3 / request / response. Только pure functions с `ServiceContext` на входе.

Это даёт:

- Тестируемость без HTTP
- Возможность вызвать из CLI / scheduler / bot

---

## Tenant boundary

Каждый модуль, работающий с organization-scoped данными, **обязан** фильтровать по `organization_id`.

Чтобы не было ошибок, в Phase 3 закладываем helper:

```typescript
// packages/db/src/scoped.ts
export function orgScope<T>(
  ctx: ServiceContext,
  query: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return query.where(eq(tablename.organizationId, ctx.org.id))
}

// usage in repository
async function listEvents(ctx: ServiceContext) {
  return orgScope(ctx, db.select().from(events))
}
```

ESLint правило (опционально): запрет на select из organization-scoped таблиц без orgScope.

---

## Feature entitlements

Перед каждой операцией, требующей feature, проверяется `OrganizationFeature`:

```typescript
async function createMatch(ctx, params) {
  await requireFeature(ctx, 'matches') // throws if not enabled
  // ...
}
```

Реализация `requireFeature`:

```typescript
async function requireFeature(ctx: ServiceContext, featureCode: string): Promise<void> {
  const enabled = await db.query.organizationFeatures.findFirst({
    where: and(
      eq(organizationFeatures.organizationId, ctx.org.id),
      eq(organizationFeatures.featureCode, featureCode),
      eq(organizationFeatures.enabled, true),
      or(isNull(organizationFeatures.endsAt), gt(organizationFeatures.endsAt, sql`now()`)),
    ),
  })
  if (!enabled) throw new FeatureNotEnabledError(featureCode)
}
```

---

## Тестирование модуля

Каждый модуль имеет `__tests__/`:

```typescript
// modules/bookings/__tests__/service.test.ts
import { describe, test, expect, beforeEach } from 'vitest'
import { createTestDb, seedOrg, seedUser } from '@/test-helpers'
import { bookingService } from '../service'

describe('bookingService.createBooking', () => {
  let ctx, event

  beforeEach(async () => {
    const db = await createTestDb()
    const org = await seedOrg(db)
    const user = await seedUser(db, org)
    ctx = { user, org, db, requestId: 'test' }
    event = await seedEvent(db, org)
  })

  test('first player gets main slot', async () => {
    const booking = await bookingService.createBooking(ctx, { eventId: event.id })
    expect(booking.slotType).toBe('main')
  })

  test('cannot book twice', async () => {
    await bookingService.createBooking(ctx, { eventId: event.id })
    await expect(bookingService.createBooking(ctx, { eventId: event.id })).rejects.toThrow(
      AlreadyBookedError,
    )
  })
})
```

Тестовая БД — отдельная PostgreSQL (Docker), не in-memory.

---

## Куда что класть (рекомендации)

| Что                                             | Где                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Логика бронирования                             | `modules/bookings/service.ts`                                      |
| SQL-запросы                                     | `modules/bookings/repository.ts`                                   |
| Доменная константа (например, `MAX_MAIN_SLOTS`) | `modules/bookings/constants.ts`                                    |
| Тип, используемый только модулем                | `modules/bookings/types.ts`                                        |
| Тип, используемый и web, и bot                  | `packages/shared/src/types/booking.ts`                             |
| Drizzle schema                                  | `packages/db/src/schema/bookings.ts`                               |
| API endpoint                                    | `apps/web/server/api/organizations/[orgId]/bookings/index.post.ts` |
| Telegram handler                                | `apps/bot/src/handlers/bookings.ts`                                |
| UI page                                         | `apps/web/pages/m/events/[eventId]/book.vue`                       |
| UI компонент                                    | `apps/web/components/BookingCard.vue`                              |
| Тест service                                    | `apps/web/modules/bookings/__tests__/service.test.ts`              |
| E2E тест                                        | `apps/web/e2e/booking-flow.spec.ts` (Phase 9+)                     |

---

## Эволюция в сервис (опционально, Phase 100+)

Если когда-то понадобится вынести модуль в отдельный сервис:

1. У модуля уже есть public service interface.
2. У модуля уже есть Drizzle schema, можно вынести в отдельную БД.
3. Заменяем in-process вызов на HTTP-вызов (тот же service interface, другая имплементация).
4. Tenant boundary не меняется — `organization_id` остаётся.

Это **не цель** на ближайшие годы, но modulith даёт такую возможность без переписывания.

---

## Ссылки

- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура
- [STACK_DECISIONS.md](./STACK_DECISIONS.md)
- [../DOMAIN.md](../DOMAIN.md)
