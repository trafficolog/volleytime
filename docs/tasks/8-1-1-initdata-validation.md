---
id: '8.1.1'
phase: '8'
epic: '8.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.3.3'
estimated_hours: '2-3'
tags:
  - telegram
  - auth
  - security
---

# Task 8.1.1: initData валидация (HMAC) + endpoint

## Цель

Серверная валидация Telegram WebApp initData по официальному алгоритму (HMAC-SHA256). Endpoint, принимающий initData и проверяющий подпись.

## Контекст

Telegram Mini App при открытии передаёт `window.Telegram.WebApp.initData` — строку с данными пользователя, подписанную ботом. Сервер обязан проверить подпись, иначе любой может подделать identity.

Алгоритм (официальный Telegram): secret_key = HMAC-SHA256("WebAppData", bot_token); вычислить HMAC-SHA256 от data-check-string с secret_key; сравнить с hash из initData.

## Что должно быть сделано

1. **Утилита валидации `apps/web/server/utils/telegram-initdata.ts`:**

   ```ts
   import { createHmac } from 'node:crypto'

   export interface TelegramInitData {
     user?: {
       id: number
       first_name: string
       last_name?: string
       username?: string
       language_code?: string
       photo_url?: string
     }
     auth_date: number
     hash: string
     query_id?: string
     [key: string]: unknown
   }

   /**
    * Валидирует Telegram WebApp initData.
    * @param initData - raw query string из window.Telegram.WebApp.initData
    * @param botToken - токен бота
    * @param maxAgeSeconds - макс возраст (защита от replay), default 24ч
    * @returns распарсенные данные если валидны, иначе null
    */
   export function validateInitData(
     initData: string,
     botToken: string,
     maxAgeSeconds = 86400,
   ): TelegramInitData | null {
     const params = new URLSearchParams(initData)
     const hash = params.get('hash')
     if (!hash) return null

     // data-check-string: все поля кроме hash, отсортированы, key=value через \n
     params.delete('hash')
     const dataCheckString = [...params.entries()]
       .map(([k, v]) => `${k}=${v}`)
       .sort()
       .join('\n')

     // secret_key = HMAC-SHA256("WebAppData", botToken) — botToken как KEY... нет:
     // По спеке: secret_key = HMAC_SHA256(key="WebAppData", message=botToken)? Нет.
     // Корректно: secret_key = HMAC-SHA256(botToken, "WebAppData")
     //   где "WebAppData" — KEY, botToken — message. Сверять с docs.
     const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
     const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

     if (computedHash !== hash) return null

     // auth_date проверка (replay protection)
     const authDate = Number(params.get('auth_date'))
     if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null

     // Парсим user
     const userRaw = params.get('user')
     const user = userRaw ? JSON.parse(userRaw) : undefined

     return {
       user,
       auth_date: authDate,
       hash,
       query_id: params.get('query_id') ?? undefined,
     }
   }
   ```

   **ВАЖНО — точный алгоритм:** по официальной документации Telegram:

   ```
   secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
   ```

   где ключ = "WebAppData", сообщение = bot_token. То есть `createHmac('sha256', 'WebAppData').update(botToken)`. Проверить против актуальной документации https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app при реализации (алгоритм критичен для безопасности).

2. **Endpoint `apps/web/server/api/auth/telegram-miniapp.post.ts`** (валидация, без сессии пока — сессия в 8.1.2):

   ```ts
   import { validateInitData } from '~/server/utils/telegram-initdata'

   export default defineEventHandler(async (event) => {
     const body = await readBody(event)
     const initData = body?.initData
     if (!initData || typeof initData !== 'string') {
       throw createError({ statusCode: 400, statusMessage: 'initData required' })
     }

     const botToken = useRuntimeConfig().telegramBotToken
     const validated = validateInitData(initData, botToken)
     if (!validated || !validated.user) {
       throw createError({ statusCode: 401, statusMessage: 'Invalid initData' })
     }

     // user создаётся/находится + сессия — в 8.1.2
     return { telegramUser: validated.user } // временно, до 8.1.2
   })
   ```

3. **Тесты `apps/web/server/utils/__tests__/telegram-initdata.test.ts`:**
   ```ts
   import { describe, test, expect } from 'vitest'
   import { validateInitData } from '../telegram-initdata'
   import { createHmac } from 'node:crypto'

   const BOT_TOKEN = '123456:TEST_TOKEN'

   function signInitData(params: Record<string, string>, token: string): string {
     const dataCheckString = Object.entries(params)
       .map(([k, v]) => `${k}=${v}`)
       .sort()
       .join('\n')
     const secretKey = createHmac('sha256', 'WebAppData').update(token).digest()
     const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
     const sp = new URLSearchParams(params)
     sp.set('hash', hash)
     return sp.toString()
   }

   describe('validateInitData', () => {
     test('valid initData passes', () => {
       const now = Math.floor(Date.now() / 1000)
       const initData = signInitData(
         {
           user: JSON.stringify({ id: 42, first_name: 'Test' }),
           auth_date: String(now),
         },
         BOT_TOKEN,
       )
       const result = validateInitData(initData, BOT_TOKEN)
       expect(result).not.toBeNull()
       expect(result?.user?.id).toBe(42)
     })

     test('tampered data fails', () => {
       const now = Math.floor(Date.now() / 1000)
       let initData = signInitData(
         { user: JSON.stringify({ id: 42, first_name: 'Test' }), auth_date: String(now) },
         BOT_TOKEN,
       )
       initData = initData.replace('42', '99') // подмена
       expect(validateInitData(initData, BOT_TOKEN)).toBeNull()
     })

     test('wrong token fails', () => {
       const now = Math.floor(Date.now() / 1000)
       const initData = signInitData(
         { user: JSON.stringify({ id: 42, first_name: 'T' }), auth_date: String(now) },
         BOT_TOKEN,
       )
       expect(validateInitData(initData, 'WRONG_TOKEN')).toBeNull()
     })

     test('expired auth_date fails', () => {
       const old = Math.floor(Date.now() / 1000) - 100000
       const initData = signInitData(
         { user: JSON.stringify({ id: 42, first_name: 'T' }), auth_date: String(old) },
         BOT_TOKEN,
       )
       expect(validateInitData(initData, BOT_TOKEN, 86400)).toBeNull()
     })

     test('missing hash fails', () => {
       expect(validateInitData('user=%7B%7D&auth_date=123', BOT_TOKEN)).toBeNull()
     })
   })
   ```

## Критерии приёмки

- ✅ validateInitData реализует официальный Telegram алгоритм (HMAC-SHA256)
- ✅ Валидный initData → распарсенные данные (user, auth_date)
- ✅ Подделанные данные → null
- ✅ Неверный токен → null
- ✅ Просроченный auth_date (> maxAge) → null (replay protection)
- ✅ Отсутствует hash → null
- ✅ Endpoint /api/auth/telegram-miniapp принимает initData, возвращает 401 при невалидном
- ✅ Тесты покрывают valid/tampered/wrong-token/expired/missing-hash

## Подсказки

- **Алгоритм критичен** — сверить с https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app. Ошибка = дыра в безопасности. Ключ для secret_key = строка "WebAppData", сообщение = bot token.
- **auth_date replay protection** — 24ч разумно для Mini App (сессия живёт долго). Можно меньше для строгости.
- **Timing-safe сравнение:** для hash сравнения можно использовать `crypto.timingSafeEqual` против timing attacks, но для hex строк одинаковой длины обычное === приемлемо в MVP. Отметить как улучшение.
- **botToken из runtimeConfig** — серверный секрет, не public.

## Не делать

- ❌ Не доверять initData без валидации подписи
- ❌ Не логировать bot token
- ❌ Не хранить initData (валидируем и отбрасываем)
- ❌ Не создавать сессию здесь (8.1.2)
