---
id: '4.4'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Invite-first onboarding. Telegram deeplinks.'
estimated_hours: '6-8'
depends_on: ['4.2', '4.3']
---

# Epic 4.4: InviteLinks + Telegram deeplinks

**Цель.** Реализовать invite-based onboarding: владелец генерирует invite link, делится ею в Telegram, получатель открывает deeplink, видит preview, подтверждает — становится участником.

## Контекст

В Phase 4 единственный invite тип — `organization_join` (решение 6 в phase-card). Это критический flow платформы: без него никак не пригласить людей.

Token: short URL-safe (например, nanoid 10 символов). Hash в БД не делаем — токены одноразового использования или короткоживущие.

Telegram deeplink: `t.me/<bot_username>?start=org_<token>`. Bot обрабатывает `/start`, передаёт `start_param` в Mini App через `?startapp=` (это уже сделано в 3.5.2).

## Definition of Done

- Drizzle schema `invite_links` с полями из DOMAIN.md
- `InviteService` с методами: `createInvite`, `revokeInvite`, `previewInvite`, `acceptInvite`
- Generation token: nanoid 10 chars (URL-safe)
- API endpoints:
  - `POST /api/organizations/:orgId/invites` — создать invite (только owner)
  - `GET /api/organizations/:orgId/invites` — список активных invites
  - `PATCH /api/organizations/:orgId/invites/:inviteId` — revoke (только creator или owner)
  - `GET /api/invites/preview/:token` — preview БЕЗ AUTH (для unauth страницы invite)
  - `POST /api/invites/accept` — принять (требует auth, тело: `{ token }`)
- Bot handler обновлён в `apps/bot/src/handlers/start.ts`:
  - При `/start org_<token>` — парсит token, передаёт в Mini App
  - Bot отвечает coppyable клавиатурой «Открыть Volley Time» с deeplink на `/m/invites/<token>`
- Acceptance flow:
  - User auth'нут → читаем `invite_links` (no revoked, no expired, uses_count < max_uses) → создаём OrganizationMember с role и status из invite
  - При `default_member_status: 'pending'` org — member создаётся в pending, owner получает уведомление
- Invite revoke: `is_revoked: true`, не удаление физически
- Все операции в audit log

## Задачи

| ID                                                   | Задача                                          | Часов |
| ---------------------------------------------------- | ----------------------------------------------- | ----: |
| [4.4.1](../tasks/4-4-1-invite-schema.md)             | Drizzle schema invite_links + миграция          |     1 |
| [4.4.2](../tasks/4-4-2-invite-service.md)            | InviteService (create, revoke, preview, accept) |   2-3 |
| [4.4.3](../tasks/4-4-3-invite-api.md)                | API endpoints (с public preview)                |     2 |
| [4.4.4](../tasks/4-4-4-telegram-deeplink-handler.md) | grammY: обработка `/start org_<token>`          |   1-2 |

## Не делать

- ❌ Не реализовывать event_join / subscription_invite / staff_invite — Phase 5+
- ❌ Не использовать JWT-based tokens — short opaque tokens достаточно
- ❌ Не делать invite to multiple orgs одним токеном
- ❌ Не делать QR-код генератор — Phase 8+ (можно через стандартные библиотеки потом)
- ❌ Не отправлять email с invite — только Telegram-deeplinks
