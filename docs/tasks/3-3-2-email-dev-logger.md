---
id: '3.3.2'
phase: '3'
epic: '3.3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
depends_on:
  - '3.3.1'
estimated_hours: '1'
tags:
  - email
  - dev-tools
---

# Task 3.3.2: Dev email logger + интерфейс провайдера

## Цель

Реализовать `sendCode` функцию, которая в dev печатает код в console.log с яркой пометкой, а в production будет отправлять через Unisender Go (но интеграция — в Phase 9).

## Контекст

Решение из phase-card: в Phase 3 НЕ интегрируем платный email-провайдер. Используем console.log с placeholder для будущей реализации.

Интерфейс должен быть таким, что в Phase 9 мы заменим **только** одну функцию, не трогая всё остальное.

## Что должно быть сделано

1. **`packages/auth/src/email/types.ts`** — общий интерфейс:

   ```ts
   export interface EmailMessage {
     to: string
     subject: string
     text: string
     html?: string
   }

   export interface EmailDriver {
     send: (message: EmailMessage) => Promise<void>
   }
   ```

2. **`packages/auth/src/email/console-driver.ts`** — dev-логгер:

   ```ts
   import type { EmailDriver } from './types'

   export const consoleEmailDriver: EmailDriver = {
     async send(message) {
       const banner = '═'.repeat(60)
       console.log(`\n${banner}`)
       console.log('📧 [DEV EMAIL]')
       console.log(banner)
       console.log(`To:      ${message.to}`)
       console.log(`Subject: ${message.subject}`)
       console.log('---')
       console.log(message.text)
       console.log(`${banner}\n`)
     },
   }
   ```

3. **`packages/auth/src/email/unisender-driver.ts`** — placeholder:

   ```ts
   import type { EmailDriver } from './types'

   export const unisenderEmailDriver: EmailDriver = {
     async send(_message) {
       throw new Error('Unisender Go driver not implemented yet (Phase 9)')
     },
   }
   ```

4. **`packages/auth/src/email/index.ts`** — выбор driver:

   ```ts
   import { consoleEmailDriver } from './console-driver'
   import { unisenderEmailDriver } from './unisender-driver'
   import type { EmailDriver } from './types'

   export function getEmailDriver(): EmailDriver {
     const driver = process.env.EMAIL_DRIVER ?? 'console'
     switch (driver) {
       case 'console':
         return consoleEmailDriver
       case 'unisender':
         return unisenderEmailDriver
       default:
         throw new Error(`Unknown EMAIL_DRIVER: ${driver}`)
     }
   }

   export type { EmailDriver, EmailMessage } from './types'
   ```

5. **Обновить `email-code.ts` plugin (из 3.3.1):**

   ```ts
   import { getEmailDriver } from './email'

   // в emailCode plugin:
   sendCode: async ({ email, code }) => {
     const driver = getEmailDriver()
     await driver.send({
       to: email,
       subject: `Код для входа в Volley Time: ${code}`,
       text: `Ваш код для входа в Volley Time: ${code}\n\nКод действует 10 минут.\nЕсли вы не запрашивали код, проигнорируйте это письмо.`,
     })
   }
   ```

6. **Тест:**
   ```ts
   // packages/auth/src/email/__tests__/console-driver.test.ts
   import { describe, test, expect, vi } from 'vitest'
   import { consoleEmailDriver } from '../console-driver'

   describe('consoleEmailDriver', () => {
     test('prints email to console', async () => {
       const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
       await consoleEmailDriver.send({
         to: 'test@example.com',
         subject: 'Test',
         text: 'Hello',
       })
       expect(spy).toHaveBeenCalled()
       const allOutput = spy.mock.calls.flat().join('\n')
       expect(allOutput).toContain('test@example.com')
       expect(allOutput).toContain('Hello')
       spy.mockRestore()
     })
   })
   ```

## Критерии приёмки

- ✅ В dev (`EMAIL_DRIVER=console` или не задан) при `auth.api.sendCode({ email })` в консоль печатается красивый блок с кодом
- ✅ `consoleEmailDriver.send` — async и не ломает event loop
- ✅ Unit-тест проходит
- ✅ При `EMAIL_DRIVER=unisender` без реализации — понятная ошибка
- ✅ Интерфейс `EmailDriver` достаточно простой, что в Phase 9 легко добавить unisender реализацию

## Подсказки

- Используй `═`, `═`, `─` Unicode-символы для красивого banner в консоли. ASCII (`=`, `-`) тоже подойдут.
- Если хочется ещё красивее — chalk или picocolors для цветного output. Но это лишняя зависимость для MVP.
- Можно дополнительно сохранять все sent emails в массив `globalThis.__sent_emails__` для use в integration тестах (но это можно сделать в 3.7.2 — helpers).

## Не делать

- ❌ Не реализовывать Unisender Go API сейчас (Phase 9)
- ❌ Не подключать SMTP / nodemailer
- ❌ Не отправлять реальные emails в dev
- ❌ Не добавлять HTML-шаблоны — текст достаточен (HTML — Phase 9)
