---
id: '8.3.1'
phase: '8'
epic: '8.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - BACK
depends_on:
  - '3.5.2'
  - '4.4.4'
estimated_hours: '2'
tags:
  - telegram
  - bot
  - deeplinks
---

# Task 8.3.1: /start расширение: event_ deeplink + Mini App кнопки

## Цель

Расширить /start handler: обработка event_<id> deeplink (поделиться событием), кнопки открытия Mini App с правильным контекстом. org_ invite (4.4.4) — проверить работу.

## Контекст

Phase 3 (3.5.2) — базовый /start, Phase 4 (4.4.4) — org_ invite deeplink. Решение 9: добавляем event_ deeplink. `t.me/bot?start=event_<id>` → Mini App открывается на странице события (организатор шлёт ссылку на тренировку в чат группы).

## Что должно быть сделано

1. **Расширить `apps/bot/src/handlers/start.ts`** (из 4.4.4):

   ```ts
   import { Composer } from 'grammy'
   import type { BotContext } from '../types'

   const composer = new Composer<BotContext>()

   composer.command('start', async (ctx) => {
     const payload = ctx.match // часть после /start

     // org_ invite (из 4.4.4 — сохранить логику)
     if (payload?.startsWith('org_')) {
       return handleOrgInvite(ctx, payload.slice(4))
     }

     // event_ deeplink (новое)
     if (payload?.startsWith('event_')) {
       return handleEventDeeplink(ctx, payload.slice(6))
     }

     // обычный /start
     return handleDefaultStart(ctx)
   })

   async function handleEventDeeplink(ctx: BotContext, eventIdRaw: string) {
     const eventId = Number(eventIdRaw)
     if (!Number.isInteger(eventId) || eventId <= 0) {
       return ctx.reply('Ссылка на событие некорректна.')
     }

     // Получить preview события (публичный preview endpoint или через web API)
     const preview = await fetchEventPreview(eventId)
     if (!preview) {
       return ctx.reply('Событие не найдено или недоступно.')
     }

     const miniAppUrl = buildMiniAppUrl(`/m/orgs/${preview.organizationId}/events/${eventId}`)
     await ctx.reply(
       `🏐 <b>${escapeHtml(preview.title)}</b>\n` +
         `📅 ${formatEventDate(preview.startsAt)}\n` +
         (preview.locationText ? `📍 ${escapeHtml(preview.locationText)}\n` : '') +
         `\nОткройте приложение, чтобы записаться:`,
       {
         parse_mode: 'HTML',
         reply_markup: {
           inline_keyboard: [[{ text: 'Открыть событие', web_app: { url: miniAppUrl } }]],
         },
       },
     )
   }

   async function handleDefaultStart(ctx: BotContext) {
     await ctx.reply(
       'Добро пожаловать в Volley Time! 🏐\n\n' +
         'Здесь вы можете записываться на тренировки и игры, ' +
         'управлять абонементами и многое другое.\n\n' +
         'Нажмите кнопку ниже, чтобы открыть приложение.',
       {
         reply_markup: {
           inline_keyboard: [
             [{ text: 'Открыть Volley Time', web_app: { url: buildMiniAppUrl('/m/') } }],
           ],
         },
       },
     )
   }

   export default composer
   ```

2. **fetchEventPreview** — получение данных события для preview:

   ```ts
   // bot обращается к web API. Нужен публичный/lightweight endpoint preview события.
   // Вариант: GET /api/public/events/:id/preview (без auth, минимум данных)
   // Или переиспользовать существующий с сервисным токеном.
   async function fetchEventPreview(eventId: number) {
     const res = await fetch(`${config.webUrl}/api/public/events/${eventId}/preview`)
     if (!res.ok) return null
     return res.json()
   }
   ```

   Потребуется публичный preview endpoint (минимум: title, startsAt, locationText, organizationId; только для published событий). Добавить в web (можно в рамках этой задачи или отметить зависимость).

3. **Публичный preview endpoint** `apps/web/server/api/public/events/[eventId]/preview.get.ts`:

   ```ts
   // БЕЗ auth. Возвращает минимум для preview. Только published события.
   export default defineEventHandler(async (event) => {
     const eventId = Number(getRouterParam(event, 'eventId'))
     const ev = await db.query.events.findFirst({
       where: eq(events.id, eventId),
       columns: {
         id: true,
         title: true,
         startsAt: true,
         locationText: true,
         organizationId: true,
         status: true,
       },
     })
     if (!ev || ev.status !== 'published') {
       throw createError({ statusCode: 404, statusMessage: 'Event not found' })
     }
     return {
       id: ev.id,
       title: ev.title,
       startsAt: ev.startsAt,
       locationText: ev.locationText,
       organizationId: ev.organizationId,
     }
   })
   ```

4. **buildMiniAppUrl helper** — формирует URL Mini App с deep path:

   ```ts
   function buildMiniAppUrl(path: string): string {
     // Telegram web_app url должен быть на домене, настроенном в BotFather
     return `${config.miniAppBaseUrl}${path}`
   }
   ```

5. **escapeHtml** для безопасной вставки в HTML parse_mode.

## Критерии приёмки

- ✅ /start без payload → приветствие + кнопка «Открыть Volley Time» (Mini App /m/)
- ✅ /start org_<token> → invite preview (4.4.4, работает)
- ✅ /start event_<id> → preview события (название, дата, место) + кнопка открытия на странице события
- ✅ event_ невалидный/не найден/не published → понятное сообщение
- ✅ Публичный preview endpoint (без auth, только published)
- ✅ web_app кнопки ведут на правильные deep paths
- ✅ HTML экранирование (title, location)
- ✅ Long-polling режим

## Подсказки

- **web_app кнопки** открывают Mini App на указанном URL (deep path /m/orgs/X/events/Y). Telegram сам передаст initData.
- **Публичный preview** — без auth, т.к. ссылку шлют в чат, получатель ещё не залогинен. Минимум данных, только published (не светим draft/cancelled).
- **Домен Mini App** настраивается в BotFather (web_app domain). miniAppBaseUrl из конфига.
- **org\_ из 4.4.4 не ломать** — сохранить существующую логику invite preview.

## Не делать

- ❌ Не делать auth для preview (публичный)
- ❌ Не светить непубличные события
- ❌ Не делать webhook — long-polling (Phase 9 webhook)
- ❌ Не делать inline-режим
