---
id: '3.7.3'
phase: '3'
epic: '3.7'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - QA
depends_on:
  - '3.7.2'
  - '3.3.4'
  - '3.4.3'
  - '3.5.2'
estimated_hours: '1-2'
tags:
  - tests
  - smoke
---

# Task 3.7.3: Smoke-тесты для всех пакетов

## Цель

Написать минимальные smoke-тесты для каждого пакета, чтобы убедиться, что все компоненты собраны правильно и работают вместе.

## Контекст

Smoke-тесты — это не полное покрытие. Это базовая проверка: «всё ли подключено? компилируется? базовый flow проходит?»

Цель — после Phase 3 запустить `pnpm test && pnpm test:integration` и видеть зелёные галочки. Это даёт уверенность что foundation работает.

## Что должно быть сделано

### 1. packages/db (integration)

```ts
// packages/db/src/__tests__/users.integration.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, type TestDb } from '../test-utils'
import { users } from '../schema'

describe('users table (integration)', () => {
  let testDb: TestDb

  beforeAll(async () => {
    testDb = await createTestDb()
  })

  afterAll(async () => {
    await testDb.close()
  })

  beforeEach(async () => {
    await testDb.truncate()
  })

  test('creates user with email', async () => {
    const [user] = await testDb.db
      .insert(users)
      .values({
        email: 'foo@example.com',
        name: 'Foo',
      })
      .returning()
    expect(user?.id).toBeGreaterThan(0)
    expect(user?.email).toBe('foo@example.com')
  })

  test('email is unique', async () => {
    await testDb.db.insert(users).values({ email: 'dup@example.com', name: 'A' })
    await expect(
      testDb.db.insert(users).values({ email: 'dup@example.com', name: 'B' }),
    ).rejects.toThrow()
  })

  test('telegram_user_id is unique', async () => {
    await testDb.db.insert(users).values({ telegramUserId: 123n, name: 'A' })
    await expect(
      testDb.db.insert(users).values({ telegramUserId: 123n, name: 'B' }),
    ).rejects.toThrow()
  })
})
```

### 2. packages/auth — Telegram validation (unit)

```ts
// packages/auth/src/telegram/__tests__/validate.test.ts
import { describe, test, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { validateInitData, TelegramAuthError } from '../validate'

const TEST_BOT_TOKEN = '1234567890:TEST_TOKEN'

function makeInitData(userId: number, authDate: number, botToken = TEST_BOT_TOKEN): string {
  const params = new URLSearchParams()
  params.set('auth_date', String(authDate))
  params.set('user', JSON.stringify({ id: userId, first_name: 'Test' }))

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  params.set('hash', hash)
  return params.toString()
}

describe('validateInitData', () => {
  test('accepts valid initData', () => {
    const authDate = Math.floor(Date.now() / 1000)
    const initData = makeInitData(42, authDate)
    const result = validateInitData(initData, TEST_BOT_TOKEN)
    expect(result.user.id).toBe(42n)
    expect(result.auth_date).toBe(authDate)
  })

  test('rejects tampered hash', () => {
    const authDate = Math.floor(Date.now() / 1000)
    const initData = makeInitData(42, authDate).replace(/hash=[a-f0-9]+/, 'hash=deadbeef')
    expect(() => validateInitData(initData, TEST_BOT_TOKEN)).toThrow(TelegramAuthError)
  })

  test('rejects expired initData (>24h)', () => {
    const authDate = Math.floor(Date.now() / 1000) - 25 * 60 * 60
    const initData = makeInitData(42, authDate)
    expect(() => validateInitData(initData, TEST_BOT_TOKEN)).toThrow(/expired/)
  })

  test('rejects wrong bot token', () => {
    const initData = makeInitData(42, Math.floor(Date.now() / 1000), 'one-token')
    expect(() => validateInitData(initData, 'other-token')).toThrow(TelegramAuthError)
  })
})
```

### 3. packages/auth — email-code driver (unit)

```ts
// packages/auth/src/email/__tests__/console-driver.test.ts
import { describe, test, expect, vi } from 'vitest'
import { consoleEmailDriver } from '../console-driver'

describe('consoleEmailDriver', () => {
  test('prints email content to console', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await consoleEmailDriver.send({
      to: 'foo@example.com',
      subject: 'Тест',
      text: 'Hello world',
    })
    const out = spy.mock.calls.flat().join('\n')
    expect(out).toContain('foo@example.com')
    expect(out).toContain('Тест')
    expect(out).toContain('Hello world')
    spy.mockRestore()
  })
})
```

### 4. packages/auth — account linking (integration)

```ts
// packages/auth/src/__tests__/linking.integration.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
import { linkTelegramToUser, AccountLinkedToOtherUserError } from '../linking'

// Helpers to make initData (same as in 3-7-3 above)
const TEST_BOT_TOKEN = '1234567890:TEST_TOKEN'
function makeInitData(/* ... */): string {
  /* реализация */
}

describe('linkTelegramToUser (integration)', () => {
  let testDb: TestDb

  beforeAll(async () => {
    testDb = await createTestDb()
  })
  afterAll(async () => {
    await testDb.close()
  })
  beforeEach(async () => {
    await testDb.truncate()
  })

  test('links Telegram to email-only user', async () => {
    const user = await createTestUser(testDb.db, { email: 'a@b.c' })
    const initData = makeInitData(42, Math.floor(Date.now() / 1000))
    const result = await linkTelegramToUser(user.id, initData, TEST_BOT_TOKEN)
    expect(result.linkedTelegramId).toBe(42n)
  })

  test('throws if Telegram linked to another user', async () => {
    // ... сценарий с двумя users
  })
})
```

### 5. apps/web — render index (unit)

```ts
// apps/web/__tests__/index.test.ts
// Минимальный тест: компонент рендерится без ошибок
import { describe, test, expect } from 'vitest'

describe('web app sanity', () => {
  test('Nuxt config loads', async () => {
    const { default: config } = await import('../nuxt.config')
    expect(config).toBeDefined()
  })
})
```

(Полноценные Vue-тесты — позже. Для Phase 3 — sanity достаточен.)

### 6. apps/bot — start handler (unit)

```ts
// apps/bot/src/handlers/__tests__/start.test.ts
import { describe, test, expect } from 'vitest'
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

## Критерии приёмки

- ✅ `pnpm test` — все unit-тесты проходят
- ✅ `pnpm test:integration` — все integration-тесты проходят
- ✅ Покрытие:
  - `packages/db`: 2-3 теста (users table)
  - `packages/auth`: 5-7 тестов (validate, driver, linking)
  - `apps/web`: 1-2 sanity
  - `apps/bot`: 1 sanity
- ✅ Total время unit-тестов < 10 секунд
- ✅ Total время integration < 30 секунд
- ✅ Все тесты detеrministic (нет flaky)

## Подсказки

- **Не тестируй фреймворки** — например, не пиши тест «Drizzle insert работает». Пиши тест «наша таблица users имеет unique constraint на email».
- **Smoke ≠ полное покрытие.** Полное — в фазах 5+ когда есть бизнес-логика.
- **Vitest watch mode** даёт быструю обратную связь — используй пока разрабатываешь.

## Не делать

- ❌ Не делать E2E с реальным Telegram API
- ❌ Не делать UI-тесты с happy-dom / jsdom — пока не нужны
- ❌ Не покрывать каждую строчку — Phase 3 это foundation, тесты — sanity
- ❌ Не делать performance benchmarks
