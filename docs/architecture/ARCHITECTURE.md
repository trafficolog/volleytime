# 🏗 Architecture

> **Last updated:** 2026-05-25
> Высокоуровневое описание архитектуры платформы Volley Time.

---

## Общая схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Пользователи                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Игрок        │  │ Организатор  │  │ Зритель      │               │
│  │ (Mini App)   │  │ (Mini App +  │  │ (публичная   │               │
│  │              │  │  Web)        │  │  страница)   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Точки входа                                   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Telegram Bot │  │ Mini App     │  │ Web App      │               │
│  │ (grammY)     │  │ (Nuxt 4 +    │  │ (Nuxt 4)     │               │
│  │              │  │  Telegram    │  │              │               │
│  │              │  │  WebApp API) │  │              │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Nitro API (Nuxt 4 server routes)                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ better-auth middleware                                        │  │
│  │ tenant resolution middleware                                  │  │
│  │ permission middleware                                         │  │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Modulith services (модули)                       │  │
│  │  organizations | members | invites | events | bookings        │  │
│  │  subscriptions | payments | ledger | credits | contributions  │  │
│  │  notifications | reports | reminders | matches | tournaments  │  │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            Drizzle ORM (typed query layer)                    │  │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Data Layer                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ PostgreSQL       │  │ Redis            │  │ Object Storage   │   │
│  │ (main DB)        │  │ (sessions,       │  │ (S3-compatible,  │   │
│  │                  │  │  job queue)      │  │  для evidence,   │   │
│  │                  │  │                  │  │  Phase 9+)       │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Внешние сервисы                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Telegram Bot │  │ bePaid       │  │ Email        │               │
│  │ API          │  │ (Phase 12+)  │  │ (Resend or   │               │
│  │              │  │              │  │  SES)        │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Структура монорепозитория

```
volley_time_platform/
├── apps/
│   ├── web/                       # Nuxt 4 (web + Mini App)
│   │   ├── app.vue
│   │   ├── pages/
│   │   │   ├── index.vue
│   │   │   ├── organizations/
│   │   │   ├── events/
│   │   │   ├── m/                 # Mini App routes (/m/*)
│   │   │   └── ...
│   │   ├── server/
│   │   │   ├── api/               # /api/* endpoints
│   │   │   ├── routes/            # /webhooks/bepaid, /webhooks/telegram
│   │   │   ├── middleware/
│   │   │   └── plugins/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── modules/               # modulith services
│   │   │   ├── organizations/
│   │   │   ├── members/
│   │   │   ├── invites/
│   │   │   ├── events/
│   │   │   ├── bookings/
│   │   │   ├── subscriptions/
│   │   │   ├── payments/
│   │   │   ├── ledger/
│   │   │   ├── credits/
│   │   │   └── ...
│   │   ├── nuxt.config.ts
│   │   └── package.json
│   │
│   └── bot/                       # grammY Telegram bot
│       ├── src/
│       │   ├── index.ts
│       │   ├── handlers/
│       │   │   ├── start.ts
│       │   │   ├── invites.ts
│       │   │   └── notifications.ts
│       │   ├── middlewares/
│       │   └── client.ts
│       └── package.json
│
├── packages/
│   ├── db/                        # Drizzle schema + миграции
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── user.ts
│   │   │   │   ├── organization.ts
│   │   │   │   ├── event.ts
│   │   │   │   └── ...
│   │   │   ├── index.ts           # экспорт schema и client
│   │   │   └── client.ts          # Drizzle client setup
│   │   ├── migrations/
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── auth/                      # better-auth setup
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── providers/
│   │   │   │   ├── email-code.ts
│   │   │   │   └── telegram.ts
│   │   │   └── permissions.ts
│   │   └── package.json
│   │
│   └── shared/                    # общие типы и утилиты
│       ├── src/
│       │   ├── types/
│       │   ├── money.ts
│       │   ├── time.ts
│       │   └── slot-distribution.ts
│       └── package.json
│
├── docker-compose.yml             # dev: postgres + redis
├── docker-compose.prod.yml        # prod: + caddy, app, bot
├── Caddyfile                      # HTTPS reverse proxy
├── pnpm-workspace.yaml
├── package.json                   # root: scripts, workspaces
├── tsconfig.json                  # root tsconfig
├── .env.example
├── README.md
├── docs/                          # все docs
└── legacy/                        # архив Python и Laravel
```

---

## Слои приложения

### 1. Точки входа (entry points)

#### Telegram Bot (`apps/bot`)

Лёгкий процесс на grammY. Основные функции:

- Принимает `/start` с deeplink-токеном (`org_<token>`, `event_<token>`)
- Показывает inline-кнопку «Открыть приложение» с ссылкой на Mini App
- Принимает webhook от Telegram (production) или long-polling (dev)
- Отправляет уведомления пользователям

**Бизнес-логики в боте минимум.** Бот делегирует всё в API.

#### Mini App (`apps/web/pages/m/*`)

Те же Nuxt-страницы, что и web, но:

- Под `/m/*` префиксом
- Слой адаптации к Telegram WebApp API: `tg.initDataUnsafe`, `tg.MainButton`, `tg.expand()`, цветовая тема
- Auth через `initData` (валидация HMAC на сервере) → создание/связывание User
- Mobile-first layout
- Без header / footer как в обычном web

#### Web App (`apps/web/pages/**`)

Полноценный desktop UI:

- Для администраторов платформы (root)
- Для организаторов на десктопе
- Публичные страницы событий (без auth)
- Live scoreboard (Phase 16) — на проекторе

### 2. API Layer (Nuxt server routes)

`apps/web/server/api/**` — Nitro endpoints.

**Middleware order:**

1. CORS (если нужен — для Mini App в WebApp обычно не нужен)
2. Rate limiting (для auth endpoints)
3. better-auth session validation
4. Tenant resolution (определяем `organization_id` из URL, headers или session)
5. Permission check (роль в организации, или root)

**Конвенция URL:**

- `/api/auth/*` — better-auth
- `/api/users/*` — глобальный
- `/api/organizations/:orgId/*` — scoped
- `/api/organizations/:orgId/events/:eventId/*` — nested
- `/api/platform/*` — root-only

### 3. Modulith Services

`apps/web/modules/*` — бизнес-логика по доменам.

Каждый модуль содержит:

- `service.ts` — публичный API модуля (вызываемый из API endpoints и других модулей)
- `repository.ts` — Drizzle queries
- `schemas.ts` — Zod / Valibot валидация input/output
- `permissions.ts` — proверки доступа
- `errors.ts` — доменные исключения

**Правило:** модуль обращается к другому модулю **только через public service**, не напрямую в его таблицы.

Подробно — в [MODULITH_ARCHITECTURE.md](./MODULITH_ARCHITECTURE.md).

### 4. Data Layer

- **PostgreSQL** — основная БД. В dev — через Docker, в prod — managed (Hetzner / Railway) или Docker.
- **Drizzle ORM** — type-safe queries, schema-first. Все типы генерируются автоматически.
- **Redis** — сессии better-auth (опционально), job queue (BullMQ в Phase 15).
- **Object Storage (S3-compatible)** — для evidence-фото расходов, аватаров. Подключается в Phase 9+.

---

## Стек: ключевые решения

### Почему Nuxt 4 (а не Next.js / SvelteKit / Remix)

- Full-stack из коробки (Nitro server routes)
- File-based routing
- Зрелая экосистема Vue
- Хорошая поддержка SSR и SPA-mode (для Mini App может быть лучше SPA)
- Стабильная версия на момент 2026-05

### Почему Drizzle (а не Prisma)

- TypeScript-first, без code generation
- SQL-like API (близко к написанию запросов вручную)
- Хорошая производительность
- Удобные миграции
- Поддержка PostgreSQL-фич (jsonb, partial indexes, raw SQL escape)

### Почему better-auth (а не Auth.js / Lucia)

- Email-code passwordless из коробки
- Hooks для кастомных providers (Telegram identity)
- TypeScript-first
- Active maintenance (на момент 2026-05)
- Простая интеграция с Nuxt через middleware

**Fallback:** если в Phase 3 better-auth не подойдёт (issues с Telegram identity), переходим на Lucia + кастомная Telegram-стратегия.

### Почему grammY (а не Telegraf / node-telegram-bot-api)

- Современная TypeScript-first библиотека
- Хорошие типы для Telegram Bot API
- Поддержка inline-keyboards, WebApp
- Активная разработка

### Почему PostgreSQL (а не MySQL / SQLite)

- Транзакции
- jsonb (для AuditLog, settings)
- Partial indexes
- Materialized views (для standings в Phase 16)
- Numeric type (для денег)
- Стандарт индустрии

### Почему монорепо (а не отдельные репозитории)

- Один deploy
- Shared types между web и bot
- Один pipeline тестов
- Drizzle schema используется обоими apps

---

## Authentication & Authorization

### Auth providers (через better-auth)

1. **Email-code (passwordless):**
   - Запрос: `POST /api/auth/send-code { email }`
   - Email с 6-значным кодом (TTL 10 мин)
   - Подтверждение: `POST /api/auth/verify-code { email, code }`
   - Rate limit: 1 код / 60 сек, 5 попыток на код
   - Заимствовано из Volley Time auth flow

2. **Telegram identity:**
   - Запрос из бота: пользователь жмёт `/start` → бот выдаёт one-time link или код
   - Or: Mini App с `initData` → серверная валидация HMAC → создание/связывание сессии
   - Связывание с email-аккаунтом, если email подтверждён ранее

3. **Account linking:**
   - Один User может иметь и email, и telegram_user_id
   - Связывание через UI: «привязать Telegram» / «привязать email»

### Authorization (permissions)

Иерархия:

| Уровень      | Сущность                                 | Где определяется                                         |
| ------------ | ---------------------------------------- | -------------------------------------------------------- |
| Platform     | `is_root_admin`                          | поле User, через ENV или seed                            |
| Organization | `OrganizationMember.role`                | per organization: owner / organizer / assistant / player |
| Event        | назначения через `EventStaff` (Phase 16) | per event: judge, event_admin                            |

**Проверка доступа в API:**

```typescript
// Псевдокод middleware
await requireUser(event)
const org = await resolveOrganization(event)
const member = await requireMember(user, org)

// Для admin-операции:
await requireRole(member, ['owner', 'organizer'])

// Для event-операции:
await requireEventStaff(user, event, ['judge', 'event_admin'])
```

### Multi-tenancy enforcement

**Все** queries фильтруются по `organization_id`. Это enforced двумя способами:

1. **Конвенция:** все методы service-слоя принимают `organizationId` первым параметром.
2. **Repository helper:** базовая обёртка `scopedQuery(org, ...)` добавляет `where organization_id = org.id` к каждому запросу.

В Phase 3 закладываем эту инфраструктуру, чтобы не было соблазна делать «глобальный поиск без скоупа».

---

## Money & Time

### Money

- В БД: `numeric(10, 2)`.
- В TypeScript: `string` или Decimal.js (выбор финализируется в Phase 3).
- Никогда не `number` / `bigint`.
- bePaid принимает копейки: `15.00 BYN → 1500`. Конвертация в `packages/shared/money.ts`.

### Time

- В БД: `timestamp with time zone`.
- В TypeScript: ISO 8601 string или Date.
- В представлении: конвертация в `Europe/Minsk` через `Intl.DateTimeFormat`.
- Все scheduler-jobs работают в UTC, формирование текста в локальном времени.

### Currency

- Default: `BYN`.
- Phase 11+ возможна поддержка нескольких валют.

---

## Идемпотентность

Любой обработчик, который меняет состояние от внешнего события, должен быть идемпотентным:

1. **bePaid webhook** — через unique `payment.bepaid_uid`.
2. **Telegram повторные нажатия** — через unique `(user_id, event_id)` для bookings.
3. **Scheduler jobs** — через флаги `reminder_24h_sent_at`, `reminder_2h_sent_at`.
4. **better-auth sessions** — встроенная идемпотентность.

---

## Конкурентность

### Гонки записи (booking)

- Защита 1: unique `(user_id, event_id)` — игрок не запишется дважды.
- Защита 2: транзакция с `SELECT ... FOR UPDATE` на event при подсчёте занятых слотов (PostgreSQL поддерживает).
- Защита 3: проверка лимита в составе транзакции.

### Гонки списания абонемента

- Атомарный SQL `UPDATE subscription SET used_sessions = used_sessions + 1 WHERE id = X AND used_sessions < total_sessions RETURNING *`.
- Если `rowcount = 0` → бросаем `SubscriptionDepletedError`.

### Live scoring (Phase 16)

- Optimistic locking через `match.version`.
- При update: `UPDATE match SET ... version = version + 1 WHERE id = X AND version = :expected_version`.
- Если `rowcount = 0` → 409 Conflict.

---

## Errors

Доменные ошибки (bubble up из service в API):

- `OrganizationNotFoundError`
- `UnauthorizedError`
- `ForbiddenError`
- `BookingConflictError`
- `EventClosedError`
- `SubscriptionDepletedError`
- `SubscriptionExpiredError`
- `PaymentNotFoundError`
- `InsufficientCreditsError`
- `InviteRevokedError`
- ...

В API middleware конвертируется в HTTP-status + JSON-body:

```json
{
  "error": "subscription_depleted",
  "message": "На абонементе закончились сессии"
}
```

---

## Деплой (overview)

Подробности — в [docs/guides/DEPLOY.md](../guides/DEPLOY.md) (Phase 9).

```
┌───────────────────────────────────────────────────────────┐
│                Российский VPS (Selectel / Timeweb)        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Caddy        │  │ apps/web     │  │ apps/bot     │     │
│  │ (HTTPS)      │  │ (Nuxt 4)     │  │ (grammY)     │     │
│  │ :443         │→│  :3000        │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                           │                   │           │
│                           └────────┬──────────┘           │
│                                    ▼                      │
│                           ┌──────────────────┐            │
│                           │ PostgreSQL       │            │
│                           │ + Redis          │            │
│                           └──────────────────┘            │
└───────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ S3-compatible    │
                           │ (Selectel Object │
                           │  Storage)        │
                           └──────────────────┘
```

**Домены:**

- `volleytime.by` — production
- При ребрендинге (Phase 10+): `vtempe.by` / `vtempe.ru`

---

## Что не делаем (анти-цели в архитектуре)

- **Микросервисы.** Один deploy, один процесс на app.
- **Event sourcing.** Append-only для финансов и журналов — да, но без полноценного ES.
- **GraphQL.** REST через Nitro server routes достаточно.
- **CQRS.** Простая ORM через Drizzle.
- **WebSockets** на старте. Polling каждые 5 сек (как в Volley Time) подойдёт для live scoreboard.
- **Native mobile apps.** Telegram Mini App покрывает 100% потребностей в мобильном.
- **Свой UI веб-кабинета сложнее, чем нужно.** Tailwind + headless UI компоненты.

---

## Ссылки

- [MODULITH_ARCHITECTURE.md](./MODULITH_ARCHITECTURE.md) — модули в деталях
- [STACK_DECISIONS.md](./STACK_DECISIONS.md) — обоснование выбора стека
- [../DOMAIN.md](../DOMAIN.md) — модель данных
- [../ROADMAP.md](../ROADMAP.md)
