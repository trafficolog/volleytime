---
id: '4.5'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'URL-based tenant resolution. Прокидывает org/member в context.'
estimated_hours: '3-4'
depends_on: ['4.2', '4.3']
---

# Epic 4.5: Tenant resolution middleware

**Цель.** Создать Nuxt middleware (server-side), которое для всех routes под `/api/organizations/:orgId/*` автоматически:

1. Парсит `orgId` из URL
2. Проверяет, что user является активным membership-ом этой организации
3. Загружает Organization и OrganizationMember в `event.context`
4. Возвращает 404 если org не найден, 403 если user не член

## Контекст

Решение 10 в phase-card: URL-based tenant resolution. Это самый явный и testable подход.

Без middleware каждый API endpoint должен повторять одно и то же:

```ts
const orgId = Number(getRouterParam(event, 'orgId'))
const org = await getOrgById(orgId)
if (!org) throw 404
const member = await getMember(user.id, orgId)
if (!member || member.status !== 'active') throw 403
// ... сама логика
```

С middleware всё это делается один раз, endpoint получает готовый `event.context.organization` и `event.context.member`.

## Definition of Done

- Создан `apps/web/server/middleware/tenant.ts`
- Применяется на routes под `/api/organizations/:orgId/*`
- При успехе: `event.context.organization`, `event.context.member`, `event.context.user` заполнены
- При неудаче: понятные HTTP status codes:
  - 404 если orgId не найдено
  - 410 если org.status === 'archived' (gone)
  - 401 если user не аутентифицирован
  - 403 если user не член, или blocked, или left
- Тесты:
  - 404 для несуществующей org
  - 403 для не-члена
  - 403 для blocked member
  - 200 OK для active member
- Все service-функции, использующие orgId, получают org/member через ServiceContext (вместо параметров)

## Задачи

| ID                                           | Задача                             | Часов |
| -------------------------------------------- | ---------------------------------- | ----: |
| [4.5.1](../tasks/4-5-1-tenant-middleware.md) | Middleware tenant.ts + integration |     2 |
| [4.5.2](../tasks/4-5-2-service-context.md)   | ServiceContext type + utility      |   1-2 |

## Не делать

- ❌ Не делать middleware для всех auth routes (auth уже отдельно)
- ❌ Не делать subdomain-based tenant resolution — Phase 14+
- ❌ Не делать caching org/member в Redis — на MVP БД-запрос быстрый
- ❌ Не делать middleware для public routes (`/o/:slug`) — отдельная логика
