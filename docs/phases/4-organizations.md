---
id: '4'
status: todo
sync_state: drifted
last_reviewed: 2026-05-27
status_note: 'Multi-tenancy с первого дня. 8 эпиков, ~28 задач.'
estimated_hours: '40-50'
depends_on: ['3']
---

# Phase 4: Organizations + Members + Invites

**Цель.** Multi-tenancy с первого дня. Любой пользователь может создать организацию, пригласить других через Telegram deeplinks, управлять составом и ролями. Введём audit log для accountability и permissions layer для безопасности.

## Контекст

После Phase 3 пользователь может авторизоваться, но видит только welcome-страницу. Phase 4 даёт ему **что делать**: создать организацию, пригласить друзей, управлять составом. Это первая фаза с реальной бизнес-логикой.

**Принципиальное архитектурное событие Phase 4:** появляется `organization_id` — root tenant. Все последующие сущности (Events, Bookings, Subscriptions, Payments) будут scoped by org. Если в Phase 4 заложим криво — потом будет больно.

## Предусловия

- ✅ Phase 3 завершена: монорепо, Drizzle, better-auth, Nuxt, grammY, Docker, CI
- ✅ Можно зарегистрироваться через email-code или Telegram
- ✅ Тестовая инфраструктура работает (Vitest + integration with PG)
- ✅ Дизайн-референсы доступны: https://volleytime.trafficolog.ru/

## Definition of Done

После выполнения всех задач Phase 4:

1. ✅ Пользователь создаёт организацию, становится owner
2. ✅ В Mini App доступен переключатель организаций (если их у user больше одной)
3. ✅ Owner генерирует invite link с настройками (роль, max_uses, expires_at)
4. ✅ Получатель открывает Telegram deeplink `/start org_<token>` → видит карточку организации → подтверждает → становится участником
5. ✅ В зависимости от `organization.default_member_status`: новый member получает `active` или `pending`
6. ✅ Если `pending` — owner видит pending-заявки и принимает/отклоняет
7. ✅ Owner блокирует / разблокирует участника
8. ✅ Owner назначает другому участнику роль `organizer` (хотя в Phase 4 organizer ничем не отличается от player по правам — это задел на Phase 5)
9. ✅ Permissions middleware блокирует cross-organization доступ (user из org A не видит members org B)
10. ✅ AuditLog ведётся для всех изменений (member added, role changed, blocked, etc.)
11. ✅ Удалить организацию = `status='archived'` (soft-delete)
12. ✅ После archive — организация исчезает из списка user'а, но данные остаются
13. ✅ Все API-endpoints следуют URL pattern `/api/organizations/:orgId/...` с tenant middleware
14. ✅ Empty state: user без организаций видит «Создать организацию» / «У меня есть приглашение»
15. ✅ Security-тесты: user не может видеть members чужой org
16. ✅ Полный invite flow покрыт integration-тестами: создание → preview → принятие → join
17. ✅ Public page заглушка: `/o/<slug>` показывает базовую info без auth (полноценная — Phase 11+)
18. ✅ Mini App + Web имеют все основные страницы

## Архитектура Phase 4

### Новые модели Drizzle

```
packages/db/src/schema/
├── users.ts              # (Phase 3 — без изменений)
├── accounts.ts           # (Phase 3 — без изменений)
├── sessions.ts           # (Phase 3 — без изменений)
├── verification.ts       # (Phase 3 — без изменений)
├── organizations.ts      # ★ NEW
├── organization-members.ts  # ★ NEW
├── invite-links.ts       # ★ NEW
├── audit-log.ts          # ★ NEW
└── relations.ts          # обновляется
```

### Новые модули в apps/web

```
apps/web/modules/
├── organizations/        # ★ NEW
│   ├── service.ts
│   ├── repository.ts
│   ├── schemas.ts
│   ├── permissions.ts
│   └── errors.ts
├── members/              # ★ NEW
│   ├── service.ts
│   ├── repository.ts
│   ├── schemas.ts
│   └── errors.ts
├── invites/              # ★ NEW
│   ├── service.ts
│   ├── repository.ts
│   ├── schemas.ts
│   └── errors.ts
├── permissions/          # ★ NEW (cross-cutting)
│   ├── index.ts
│   ├── policies.ts
│   └── types.ts
└── audit/                # ★ NEW (cross-cutting)
    ├── service.ts
    ├── repository.ts
    └── actions.ts
```

### Новые API endpoints

```
/api/organizations
   POST                    создать организацию
   GET                     список организаций текущего user

/api/organizations/:orgId
   GET                     детали организации
   PATCH                   обновить настройки
   POST archive            archive (soft-delete)

/api/organizations/:orgId/members
   GET                     список members
   POST                    добавить member вручную (Phase 5+, в 4 — только invite)
   PATCH /:memberId        изменить role/status
   DELETE /:memberId       leave (для самого user'a) / kick (для owner)

/api/organizations/:orgId/invites
   POST                    создать invite link
   GET                     список активных invites
   PATCH /:inviteId        revoke

/api/invites/preview/:token   public: предпросмотр invite (без auth)
/api/invites/accept           принять invite (требует auth)

/api/organizations/:orgId/audit
   GET                     список audit-записей (только owner/organizer)

/o/:slug                   public page (заглушка)
/api/public/organizations/:slug   public: базовая info об организации
```

### Telegram deeplinks

```
/start org_<token>            invite в организацию
/start invite_<token>         альтернативный синтаксис (на выбор)
```

Bot ловит `/start`, передаёт `start_param` в Mini App через `?startapp=...` параметр.

### UI routes (Mini App + Web)

```
Mini App (/m/*):
   /m/                        список организаций / empty state
   /m/orgs/new                создать организацию
   /m/orgs/[orgId]            dashboard организации
   /m/orgs/[orgId]/members    список members
   /m/orgs/[orgId]/members/[memberId]   карточка member
   /m/orgs/[orgId]/invites    invites manager (создать, отозвать)
   /m/orgs/[orgId]/audit      audit log
   /m/orgs/[orgId]/settings   настройки org
   /m/invites/[token]         принять invite

Web (/):
   /orgs                      список организаций
   /orgs/new                  создать
   /orgs/[orgId]              dashboard
   /orgs/[orgId]/members      и т.д. (параллельный набор)
   /o/[slug]                  public page (заглушка)
```

## Эпики

| ID                                       | Эпик                             | Задач | Часов |
| ---------------------------------------- | -------------------------------- | ----: | ----: |
| [4.1](../epics/4-1-organizations.md)     | Organizations CRUD               |     4 |   5-6 |
| [4.2](../epics/4-2-members.md)           | OrganizationMembers management   |     4 |   5-7 |
| [4.3](../epics/4-3-permissions.md)       | Permissions / Policy layer       |     3 |   4-5 |
| [4.4](../epics/4-4-invites.md)           | InviteLinks + Telegram deeplinks |     4 |   6-8 |
| [4.5](../epics/4-5-tenant-middleware.md) | Tenant resolution middleware     |     2 |   3-4 |
| [4.6](../epics/4-6-audit-log.md)         | AuditLog                         |     3 |   3-4 |
| [4.7](../epics/4-7-ui.md)                | UI (Mini App + Web)              |     5 |  8-10 |
| [4.8](../epics/4-8-tests.md)             | Tests (smoke + security)         |     3 |   4-6 |
| [4.9](../epics/4-9-review-fixes.md)      | **Исправления по ревью v0.1.0**  |    18 | 26-36 |

**Итого:** 8 эпиков, 28 задач, **40-50 часов**.

## Технические заметки

### Утверждённые решения

1. **Безлимит организаций на user** — без ограничений в Phase 4
2. **Только owner + player роли используются** — organizer/assistant в enum для будущего, но в Phase 4 ничем не отличаются от player
3. **Soft-delete через `status='archived'`** — нет физического удаления, нет transfer ownership
4. **Empty state** — «Создать организацию» / «У меня есть приглашение». Никаких forced onboarding
5. **Multi-org** — user может быть в нескольких организациях. Переключатель в Mini App
6. **Только `organization_join` invite тип** — event/subscription/staff — Phase 5+
7. **Default member status настраиваемо per-org** — owner выбирает `active` или `pending`. По умолчанию `active`
8. **UI на основе референсов** с https://volleytime.trafficolog.ru/ (Mini App + Web SaaS)
9. **Audit log: только изменения**, не просмотры
10. **Tenant resolution: URL-based** — `/api/organizations/:orgId/...`. Middleware парсит, проверяет, прокидывает в context
11. **Public pages: subpath** `/o/<slug>`. Subdomain — Phase 14+ если потребуется
12. **Не создаём events таблицу** — это Phase 5
13. **Tests: smoke + critical security tests**
14. **Permissions: отдельный модуль `permissions/`** с canX/requireX функциями
15. **Полная Phase 4 в одной сессии**

### Что НЕ делаем в Phase 4

- ❌ Events / Bookings / Subscriptions — Phase 5
- ❌ Payments / Ledger — Phase 6
- ❌ Event Credits — Phase 7
- ❌ Transfer ownership UI — Phase 11+
- ❌ Полное удаление организации (только soft-delete) — Phase 14+
- ❌ Subdomain support — Phase 14+
- ❌ Полноценная public page — Phase 11+ (в Phase 4 — заглушка)
- ❌ Custom roles (за пределами owner/organizer/assistant/player)
- ❌ Membership tiers внутри одной организации
- ❌ Multi-org bulk операции (типа «удалить меня из всех org»)

### Открытые вопросы

- **Slug uniqueness** — глобальный или per-platform? Решение: **глобальный** (для public pages `/o/<slug>` чтобы не было коллизий).
- **Slug generation** — auto от name + ручная коррекция, или только ручной? Решение: **auto от name + опциональный override** при создании.
- **Что делать при удалении user'а** (на самом деле — никогда не удаляем в Phase 4, soft-delete) если он owner организации? Решение: организация остаётся, но без owner — в Phase 11+ это будет проблемой и решаем там. Сейчас: блокируем удаление owner-аккаунта на уровне permissions.

### Дизайн-референсы

Все UI-задачи в эпике 4.7 опираются на:

- https://volleytime.trafficolog.ru/mini-app.php (Mini App, переключатель Player/Organizer)
- https://volleytime.trafficolog.ru/web-saas.php (Web SaaS, переключатель Кабинет/Root Admin)
- https://volleytime.trafficolog.ru/brand-system.php (Brand & System — токены, типографика)
- https://volleytime.trafficolog.ru/public-pages.php (Public page паттерны)

Шрифты: Space Grotesk (заголовки) + Manrope (тело).
Цвета: синий (primary) + оранжевый (accent).

## Ссылки

- [PLATFORM_VISION.md](../PLATFORM_VISION.md)
- [DOMAIN.md](../DOMAIN.md)
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [MODULITH_ARCHITECTURE.md](../architecture/MODULITH_ARCHITECTURE.md)
- [INVITES_AND_MEMBERSHIP.md](../strategy/INVITES_AND_MEMBERSHIP.md)
