---
id: '4.4.4'
phase: '4'
epic: '4.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
depends_on:
  - '4.4.3'
  - '3.5.2'
estimated_hours: '1-2'
tags:
  - grammy
  - telegram
  - invites
---

# Task 4.4.4: grammY обработка `/start org_<token>`

## Цель

Расширить grammY bot из Phase 3 чтобы:

1. Парсить `/start org_<token>` параметр
2. Через web API получать invite preview
3. Показывать пользователю карточку организации с кнопкой «Открыть Volley Time» (deeplink на Mini App `/m/invites/<token>`)

## Контекст

Bot — отдельный процесс, не имеет прямого доступа к БД. Общается с `apps/web` через REST.

При нажатии inline-кнопки «Открыть Volley Time» — пользователь попадает в Mini App, где видит invite preview и может accept (требует auth — Mini App auth через initData из Phase 3).

## Что должно быть сделано

1. **Обновить `apps/bot/src/env.ts`** — добавить WEB_URL:

   ```ts
   export const env = {
     TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
     TELEGRAM_BOT_USERNAME: required('TELEGRAM_BOT_USERNAME'),
     WEB_URL: optional('WEB_URL') ?? optional('BETTER_AUTH_URL') ?? 'http://localhost:3000',
   } as const
   ```

2. **Создать `apps/bot/src/api/invites.ts`** — HTTP client:

   ```ts
   import { env } from '../env'

   export interface InvitePreview {
     token: string
     organization: {
       id: number
       slug: string
       name: string
       description: string | null
       city: string | null
     }
     roleToAssign: string
     defaultMemberStatus: string
     expiresAt: string | null
     maxUses: number | null
     usesCount: number
   }

   export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
     const url = `${env.WEB_URL}/api/invites/preview/${encodeURIComponent(token)}`
     try {
       const res = await fetch(url, {
         method: 'GET',
         headers: { Accept: 'application/json' },
       })
       if (!res.ok) {
         return null
       }
       const data = (await res.json()) as { preview: InvitePreview }
       return data.preview
     } catch (e) {
       console.error('[bot] failed to fetch invite preview', e)
       return null
     }
   }
   ```

3. **Обновить `apps/bot/src/handlers/start.ts`:**

   ```ts
   import { Bot, InlineKeyboard } from 'grammy'
   import { env } from '../env'
   import { fetchInvitePreview } from '../api/invites'

   const ORG_INVITE_PREFIX = 'org_'

   export function registerStartHandler(bot: Bot) {
     bot.command('start', async (ctx) => {
       const startParam = ctx.match // например: "org_aBc123xyz" или ""
       const user = ctx.from
       if (!user) {
         await ctx.reply('Не удалось определить пользователя')
         return
       }
       const userName = user.first_name

       // Case 1: organization invite
       if (startParam?.startsWith(ORG_INVITE_PREFIX)) {
         const token = startParam.slice(ORG_INVITE_PREFIX.length)
         await handleOrgInvite(ctx, token, userName)
         return
       }

       // Case 2: regular /start
       await sendWelcome(ctx, userName)
     })

     bot.command('help', async (ctx) => {
       await ctx.reply(
         `Volley Time — платформа для спортивных событий.\n\n` +
           `Команды:\n` +
           `/start — открыть приложение\n` +
           `/help — эта подсказка`,
       )
     })

     bot.on('message', async (ctx) => {
       await ctx.reply(
         `Я понимаю только команды.\n\nНажми /start чтобы открыть приложение или /help для подсказки.`,
       )
     })
   }

   async function sendWelcome(ctx: any, userName: string) {
     const miniAppUrl = `${env.WEB_URL}/m/`
     const keyboard = new InlineKeyboard().webApp('🏐 Открыть Volley Time', miniAppUrl)

     await ctx.reply(
       `Привет, ${userName}! 🏐\n\n` +
         `Volley Time — платформа для организации волейбольных тренировок, открытых игр и (в будущем) турниров.\n\n` +
         `Нажми кнопку ниже, чтобы открыть приложение.`,
       { reply_markup: keyboard },
     )
   }

   async function handleOrgInvite(ctx: any, token: string, userName: string) {
     const preview = await fetchInvitePreview(token)

     if (!preview) {
       await ctx.reply(
         `Привет, ${userName}!\n\n` +
           `❌ Ссылка-приглашение недействительна или истекла.\n\n` +
           `Попроси организатора прислать новую ссылку или нажми /start чтобы открыть приложение.`,
       )
       return
     }

     const org = preview.organization
     const lines = [`🏐 Тебя приглашают в организацию:`, ``, `*${org.name}*`]
     if (org.city) lines.push(`📍 ${org.city}`)
     if (org.description) lines.push(``, org.description)
     lines.push(``)

     if (preview.defaultMemberStatus === 'pending') {
       lines.push(`⚠️ После вступления организатор должен подтвердить твою заявку.`)
     }

     const miniAppUrl = `${env.WEB_URL}/m/invites/${encodeURIComponent(token)}`
     const keyboard = new InlineKeyboard().webApp('🏐 Открыть и присоединиться', miniAppUrl)

     await ctx.reply(lines.join('\n'), {
       parse_mode: 'Markdown',
       reply_markup: keyboard,
     })

     console.log(
       `[bot] org invite preview shown to user=${ctx.from.id} token=${token.slice(0, 8)}...`,
     )
   }
   ```

4. **Unit-тест** `apps/bot/src/handlers/__tests__/start.test.ts`:

   ```ts
   import { describe, test, expect, vi } from 'vitest'
   import { Bot } from 'grammy'
   import { registerStartHandler } from '../start'

   describe('start handler', () => {
     test('registers without errors', () => {
       const bot = new Bot('1234:fake-token', {
         client: { canUseWebhookReply: () => false },
       })
       expect(() => registerStartHandler(bot)).not.toThrow()
     })
   })
   ```

   (Полноценный mock Telegram updates с invite — сложно, отложим до Phase 8 e2e.)

## Критерии приёмки

- ✅ `/start` без параметра — welcome + Mini App кнопка
- ✅ `/start org_<valid_token>` — preview карточка с названием org, городом, кнопкой
- ✅ `/start org_<invalid_token>` — сообщение «ссылка недействительна»
- ✅ `/start org_<revoked_token>` — то же сообщение
- ✅ `/start org_<expired_token>` — то же сообщение
- ✅ Кнопка ведёт на `WEB_URL/m/invites/<token>` через webApp
- ✅ Если default_member_status = pending — текст содержит warning о необходимости подтверждения
- ✅ Логирование показывает invite preview attempts
- ✅ Если web недоступен — не падает, отвечает «ссылка недействительна»

## Подсказки

- **`startParam.slice(ORG_INVITE_PREFIX.length)`** — извлекает token из `org_<token>`. Telegram передаёт всё после `/start ` как один параметр.
- **`parse_mode: 'Markdown'`** для красивого форматирования. Если строки содержат спец-символы (`_`, `*`, `[`), нужно экранировать.
- **encodeURIComponent для token** — на всякий случай, хотя nanoid даёт URL-safe alphabet.

## Не делать

- ❌ Не показывать кнопку «Принять» прямо в боте — accept требует auth, который делается через Mini App
- ❌ Не парсить event_/subscription_invite_ — Phase 5+
- ❌ Не делать FSM / scenes — start handler stateless
- ❌ Не делать webhook mode здесь — long-polling, переключение в Phase 9
