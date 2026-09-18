---
id: '8.3.2'
phase: '8'
epic: '8.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - BACK
depends_on:
  - '8.3.1'
estimated_hours: '1'
tags:
  - telegram
  - bot
---

# Task 8.3.2: /help + финализация команд

## Цель

Команда /help (краткая справка). Регистрация команд в Telegram (setMyCommands). Финализация бота для MVP.

## Контекст

Решение 8: минимум команд (/start, /help). Бот — точка входа, работа в Mini App. /help объясняет как пользоваться.

## Что должно быть сделано

1. **Handler `apps/bot/src/handlers/help.ts`:**

   ```ts
   import { Composer } from 'grammy'
   import type { BotContext } from '../types'
   import { buildMiniAppUrl } from '../utils/urls'

   const composer = new Composer<BotContext>()

   composer.command('help', async (ctx) => {
     await ctx.reply(
       '<b>Volley Time</b> 🏐\n\n' +
         'Это приложение для записи на волейбольные тренировки и игры.\n\n' +
         '<b>Что можно делать:</b>\n' +
         '• Записываться на события\n' +
         '• Покупать и использовать абонементы\n' +
         '• Смотреть свои записи\n\n' +
         'Если вы организатор — создавать события, вести состав и кассу.\n\n' +
         'Вся работа происходит в приложении — нажмите кнопку ниже.',
       {
         parse_mode: 'HTML',
         reply_markup: {
           inline_keyboard: [
             [{ text: 'Открыть Volley Time', web_app: { url: buildMiniAppUrl('/m/') } }],
           ],
         },
       },
     )
   })

   export default composer
   ```

2. **Регистрация команд** (setMyCommands) при старте бота `apps/bot/src/index.ts`:

   ```ts
   await bot.api.setMyCommands([
     { command: 'start', description: 'Открыть приложение' },
     { command: 'help', description: 'Справка' },
   ])
   ```

3. **Fallback на неизвестные сообщения:**

   ```ts
   // Composer для прочих сообщений
   composer.on('message', async (ctx) => {
     await ctx.reply('Используйте приложение для записи на события.', {
       reply_markup: {
         inline_keyboard: [
           [{ text: 'Открыть Volley Time', web_app: { url: buildMiniAppUrl('/m/') } }],
         ],
       },
     })
   })
   ```

4. **Сборка бота** `apps/bot/src/index.ts` — подключить composers (start, help, fallback) в правильном порядке:

   ```ts
   bot.use(startComposer)
   bot.use(helpComposer)
   bot.use(fallbackComposer) // последним
   ```

5. **Вынести общие утилиты** (buildMiniAppUrl, escapeHtml) в `apps/bot/src/utils/`.

## Критерии приёмки

- ✅ /help → справка + кнопка Mini App
- ✅ setMyCommands регистрирует /start, /help (видны в меню Telegram)
- ✅ Неизвестное сообщение → подсказка открыть приложение
- ✅ Composers подключены в правильном порядке (fallback последним)
- ✅ Общие утилиты вынесены (DRY с 8.3.1)
- ✅ Long-polling работает

## Подсказки

- **setMyCommands** — команды появляются в меню Telegram (синяя кнопка слева от поля ввода). Только /start и /help для MVP.
- **Fallback последним** — иначе перехватит команды. Порядок composers важен.
- **Минимум команд намеренно** — Mini App основной интерфейс, бот не дублирует функциональность.
- **web_app кнопки везде** — единый способ попасть в приложение.

## Не делать

- ❌ Не добавлять /menu, /myorgs, /events (Mini App — работа)
- ❌ Не делать текстовые команды-действия (запись через текст)
- ❌ Не делать FSM/scenes
- ❌ Не делать многоязычность (русский MVP)
