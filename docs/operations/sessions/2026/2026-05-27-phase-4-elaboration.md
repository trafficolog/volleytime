---
date: 2026-05-27
duration_hours: 4
session_type: phase-elaboration
phase: '4'
goals:
  - 'Детально расписать Phase 4: Organizations + Members + Invites'
  - '8 эпиков, 28 задач — каждая готова к работе'
  - 'Учесть дизайн-референсы с volleytime.trafficolog.ru'
outcomes:
  - 'Phase 4 расширенная phase-card (18 DoD критериев, архитектура, 15 решений)'
  - '8 эпиков с DoD и списком задач'
  - '28 задач полного формата (frontmatter + 6 секций, 6368 строк)'
  - 'Multi-tenancy архитектура заложена: Organization root tenant + permissions layer + tenant middleware'
---

# Сессия 2026-05-27: детальная проработка Phase 4

## Контекст

После Phase 3 (Foundation, 22 задачи) — детализация Phase 4, первой фазы с реальной бизнес-логикой и multi-tenancy.

## Утверждённые решения (15 вопросов)

1. **Безлимит организаций** на user (A)
2. **Только owner + player** используются; organizer/assistant в enum для будущего (B)
3. **Soft-delete** через status='archived', без transfer ownership, без физ удаления (C)
4. **Empty state** «Создать» / «Есть приглашение», без forced onboarding (B)
5. **Multi-org** с переключателем в Mini App (A)
6. **Только organization_join** invite тип; event/staff/subscription — Phase 5+ (A)
7. **Default member status настраиваемо per-org** (active по умолчанию) (C)
8. **UI на основе референсов** volleytime.trafficolog.ru (B)
9. **Audit log: только изменения**, не просмотры (A)
10. **Tenant resolution URL-based** /api/organizations/:orgId/* (A)
11. **Public pages: subpath** /o/<slug>, заглушка в Phase 4 (A)
12. **Не создаём events** — Phase 5
13. **Tests: smoke + security-critical** (B+C)
14. **Permissions: отдельный модуль** с canX/requireX (B)
15. **Полная Phase 4 в одной сессии** (A)

## Дизайн-референсы

Изучены https://volleytime.trafficolog.ru/ :

- Mini App (Player/Organizer переключатель, 7+5 экранов)
- Web SaaS (Кабинет/Root Admin, 7+6 экранов)
- Brand & System: Space Grotesk + Manrope, синий primary + оранжевый accent
- Public pages с QR-кодом

Применено в эпике 4.7 (UI).

## 8 эпиков Phase 4

| ID  | Эпик                             | Задач | Часов |
| --- | -------------------------------- | ----: | ----: |
| 4.1 | Organizations CRUD               |     4 |   5-6 |
| 4.2 | OrganizationMembers management   |     4 |   5-7 |
| 4.3 | Permissions / Policy layer       |     3 |   4-5 |
| 4.4 | InviteLinks + Telegram deeplinks |     4 |   6-8 |
| 4.5 | Tenant resolution middleware     |     2 |   3-4 |
| 4.6 | AuditLog                         |     3 |   3-4 |
| 4.7 | UI (Mini App + Web)              |     5 |  8-10 |
| 4.8 | Tests (smoke + security)         |     3 |   4-6 |

**Итого:** 28 задач, 40-50 часов, 6368 строк task-карточек.

## Полный список задач

**Epic 4.1 (Organizations):**

- 4.1.1 schema organizations + миграция
- 4.1.2 OrganizationService (create транзакционно создаёт org + owner member)
- 4.1.3 API endpoints (CRUD + archive)
- 4.1.4 slug generation (транслитерация кириллицы + uniqueness)

**Epic 4.2 (Members):**

- 4.2.1 schema organization_members (unique org+user)
- 4.2.2 MemberService (add с reactivation, role, block/unblock, leave)
- 4.2.3 API endpoints (list, get, patch, delete=leave/kick)
- 4.2.4 leave flow + edge cases + 5 integration тестов

**Epic 4.3 (Permissions):**

- 4.3.1 canX/requireX функции (isOrgOwner, requireOrgMember, etc.)
- 4.3.2 ForbiddenError + error handler integration
- 4.3.3 unit-тесты (~30-40 тестов, edge cases)

**Epic 4.4 (Invites):**

- 4.4.1 schema invite_links + FK в organization_members
- 4.4.2 InviteService (create, revoke, preview, accept — атомарно с race-safe increment)
- 4.4.3 API (с public preview без auth)
- 4.4.4 grammY обработка /start org_<token>

**Epic 4.5 (Tenant middleware):**

- 4.5.1 middleware (parse orgId → load org/member → 404/410/401/403 → context)
- 4.5.2 ServiceContext type unification

**Epic 4.6 (Audit):**

- 4.6.1 schema audit_log + AuditService (fire-and-forget)
- 4.6.2 actions каталог + интеграция в endpoints + diffObjects
- 4.6.3 API с фильтрами и pagination

**Epic 4.7 (UI):**

- 4.7.1 empty state + список org + переключатель
- 4.7.2 форма создания организации
- 4.7.3 members list + member card (role/block/leave)
- 4.7.4 invites manager + accept page
- 4.7.5 dashboard + audit log + settings + archive

**Epic 4.8 (Tests):**

- 4.8.1 integration tests (org lifecycle, invite flow, member mgmt) — ~15 тестов
- 4.8.2 security tests (cross-org isolation) — критические
- 4.8.3 race condition tests (concurrent invite accept)

## Ключевые архитектурные паттерны Phase 4

### Multi-tenancy через 3 слоя

1. **Organization** — root tenant. Все будущие сущности → organization_id.
2. **Tenant middleware** (4.5.1) — для /api/organizations/:orgId/* автоматически проверяет membership, наполняет context.
3. **Permissions module** (4.3) — canX/requireX функции, переиспользуемые везде.

### Транзакционное создание org

organizationService.create — в одной транзакции создаёт organization + owner OrganizationMember. Rollback при ошибке.

### Reactivation pattern

memberService.addMember находит существующего left/rejected member и реактивирует (вместо дубля). Решает проблему unique constraint при rejoin.

### Race-safe invite acceptance

inviteService.acceptInvite:

- Атомарный UPDATE usesCount WHERE usesCount < maxUses RETURNING
- Транзакция: validate → increment → addMember
- Защита от двойного membership через unique constraint
- Тесты concurrency (4.8.3) подтверждают: maxUses=1 + 2 concurrent = ровно 1 успех

### Audit fire-and-forget

auditService.log не блокирует основную операцию: ошибка записи логируется, но не выбрасывается. Вызывается из endpoints (после успеха), не из services.

### Public endpoints вне tenant scope

/api/invites/preview/:token и /api/invites/accept — НЕ под /api/organizations/, поэтому tenant middleware не применяется (preview без membership логичен).

## Что НЕ делалось (отложено)

- Events / Bookings / Subscriptions — Phase 5
- Transfer ownership — Phase 11+
- Физическое удаление org — Phase 14+
- Subdomain support — Phase 14+
- Полноценная public page — Phase 11+ (в Phase 4 заглушка)
- QR-код для invites — Phase 8+
- Фильтры audit в UI — Phase 14+ (API поддерживает)

## Метрики сессии

- Phase 4 task cards: 28 шт, 6368 строк, среднее 227 строк/задача
- Все 28 с корректным frontmatter + 6 секций
- Security-critical задачи (4.8.2) документированы как invariants
- Race conditions (4.8.3) с объяснением механизма защиты

## Что дальше

### Реализация

Phase 3 → Phase 4 последовательно. Phase 4 начинать с 4.1.1 (schema) после завершения Phase 3.

### Следующая сессия планирования

Phase 5 (Events + Bookings + Subscriptions) — крупнейшая фаза (50-70 часов). Здесь оживёт ядро из Python-прототипа: slot distribution, атомарное consume_session, FIFO subscription, waitlist promotion.

### Параллельно

- Трек A: юридическое (МНС/ФНС)
- Трек B: Python-прототип в реальной группе
