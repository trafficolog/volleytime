---
id: '3.5.2'
phase: '3'
epic: '3.5'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
depends_on:
  - '3.5.1'
estimated_hours: '1-2'
tags:
  - grammy
  - telegram
  - bot
---

# Task 3.5.2: /start handler с Mini App button

## Цель

Реализовать `/start` команду бота. Отвечает приветственным сообщением + inline-кнопкой «Открыть Volley Time» с deeplink на Mini App. Сохраняет `start_param` (для Phase 4 invite flow), но пока не обрабатывает его.

## Контекст

`/start` — главная точка входа в бот. Telegram автоматически подставляет всё после `/start` как параметр: `t.me/volleytime_bot?start=org_xyz` → `/start org_xyz`.

В Phase 3 мы **парсим** `start_param`, но **не обрабатываем** — это Phase 4 (invite flow).

Mini App открывается через специальную кнопку с `web_app` параметром.

## Что должно быть сделано

1. **`apps/bot/src/handlers/start.ts`:**

   ```ts
   import { Bot, InlineKeyboard } from 'grammy'
   import { env } from '../env'

   export function registerStartHandler(bot: Bot) {
     bot.command('start', async (ctx) => {
       const startParam = ctx.match // например: "org_aBc123" или ""
       const user = ctx.from

       if (!user) {
         await ctx.reply('Не удалось определить пользователя')
         return
       }

       const userName = user.first_name

       // Базовое приветственное сообщение
       let text =
         `Привет, ${userName}! 🏐\n\n` +
         `Volley Time — платформа для организации волейбольных тренировок, открытых игр и (в будущем) турниров.\n\n` +
         `Нажми кнопку ниже, чтобы открыть приложение.`

       // Если есть start_param — упоминаем что есть invite
       if (startParam) {
         text =
           `Привет, ${userName}! 🏐\n\n` +
           `Ты перешёл по специальной ссылке. После открытия приложения мы покажем детали.\n\n` +
           `(Обработка приглашений будет добавлена в следующей версии — Phase 4.)`
       }

       // Mini App URL
       const miniAppUrl = `${env.WEB_URL}/m/${startParam ? `?start_param=${encodeURIComponent(startParam)}` : ''}`

       const keyboard = new InlineKeyboard().webApp('🏐 Открыть Volley Time', miniAppUrl)

       await ctx.reply(text, { reply_markup: keyboard })

       // Логируем для будущей обработки
       console.log(`[bot] /start from user=${user.id} (@${user.username}) param="${startParam}"`)
     })
   }
   ```

2. **Дополнительная команда `/help`:**

   ```ts
   bot.command('help', async (ctx) => {
     await ctx.reply(
       `Volley Time — платформа для спортивных событий.\n\n` +
         `Команды:\n` +
         `/start — открыть приложение\n` +
         `/help — эта подсказка\n\n` +
         `Все операции внутри приложения. Нажми /start чтобы начать.`,
     )
   })
   ```

3. **Handler для неизвестных сообщений:**

   ```ts
   bot.on('message', async (ctx) => {
     await ctx.reply(
       `Я понимаю только команды.\n\n` +
         `Нажми /start чтобы открыть приложение или /help для подсказки.`,
     )
   })
   ```

4. **Обновить `index.ts`** чтобы зарегистрировать всё:

   ```ts
   import { registerStartHandler } from './handlers/start'
   // ...
   registerStartHandler(bot)
   ```

5. **Тест (минимальный, через mock):**
   ```ts
   // apps/bot/src/handlers/__tests__/start.test.ts
   import { describe, test, expect, vi } from 'vitest'
   import { Bot } from 'grammy'
   import { registerStartHandler } from '../start'

   describe('/start handler', () => {
     test('replies with Mini App button', async () => {
       // Простой smoke-test: handler registers без ошибок
       const bot = new Bot('1234:fake-token', {
         client: { canUseWebhookReply: () => false },
       })
       expect(() => registerStartHandler(bot)).not.toThrow()
       // Полноценный E2E с моком updates — Phase 8
     })
   })
   ```

## Критерии приёмки

- ✅ `/start` в боте отвечает приветствием + кнопкой «Открыть Volley Time»
- ✅ Клик по кнопке открывает Mini App в Telegram (если бот настроен с domain через BotFather)
- ✅ `/start org_abc123` — текст содержит упоминание про invite (но обработки нет, это Phase 4)
- ✅ `/help` показывает help
- ✅ Любое другое сообщение → «я понимаю только команды»
- ✅ Логи бота показывают каждый `/start` с user_id и start_param
- ✅ Smoke-test проходит

## Подсказки

- **`InlineKeyboard.webApp(text, url)`** — специальный тип кнопки, открывает Mini App внутри Telegram. URL должен быть HTTPS (для prod) или whitelist'нут в BotFather settings (для dev через ngrok).
- **Локальная разработка Mini App:** в BotFather → `/setdomain` → указать ngrok URL (например `xxx.ngrok-free.app`). Тогда `webApp(url)` примет http-URL для тестов.
- **Альтернатива в dev** — открывать обычной `url` кнопкой (не webApp). Тогда URL открывается в браузере, не в Telegram WebApp. Меньше функционала, но проще для разработки.
- **ctx.match** в grammY — то, что после команды. Для `/start abc123` — `ctx.match === 'abc123'`.

## Не делать

- ❌ Не обрабатывать `start_param` (org_, event_) — это Phase 4
- ❌ Не делать FSM / wizards
- ❌ Не отправлять уведомления — Phase 8
- ❌ Не делать `/menu` команду — Phase 8 (когда Mini App обогатится)
- ❌ Не интегрировать с user db в боте — все аутентификации через Mini App initData
