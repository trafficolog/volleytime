import {
  eventService,
  memberService,
  organizationService,
  setNotifierTransport,
  DeliveryError,
  type NotifyPayload,
} from '@volley-time/core'
import {
  auditLog,
  closeDb,
  db,
  eq,
  organizations,
  organizationTelegramChats,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * 20.3.4: привязка Telegram-чата организатором (кабинет) и ботом (внутренний канал), статус,
 * отвязка и анонс события. Права по матрице — в IDOR-таблице; здесь сквозной сценарий и граница
 * бота: секрет проверяется раньше разбора тела, код одноразовый, токены и коды не утекают.
 */
describe('telegram chat link API (20.3.4)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  const secret = { 'x-internal-secret': 'dev-internal-secret' }
  let ownerId: number, organizerId: number, playerId: number, outsiderId: number
  let orgId: number, otherOrgId: number
  const sent: NotifyPayload[] = []
  let failNext: Error | null = null
  // свой чат на тест: лимит попыток привязки считается по чату
  let chatId = ''
  let adminTg = ''
  let chatSeq = 0

  const mk = async (name: string) =>
    (
      await db
        .insert(users)
        .values({ email: `${name}-${Math.random()}@t.by`, name })
        .returning()
    )[0]!.id

  const bot = (path: string, body: unknown, headers: Record<string, string> = secret) =>
    request('POST', `/api/internal/bot/${path}`, { body, headers })

  const issue = async (user = organizerId, org = orgId) => {
    const res = await request('POST', `/api/organizations/${org}/telegram-chat/link-code`, {
      user,
      body: {},
    })
    return res
  }

  const claim = (code: string, over: Record<string, unknown> = {}) =>
    bot('chat-link', {
      verdict: 'admin',
      code,
      chatId: chatId,
      chatType: 'supergroup',
      title: 'Чат',
      botCanPost: true,
      confirmedByTelegramId: adminTg,
      ...over,
    })

  beforeAll(async () => {
    request = await createTestApi()
    setNotifierTransport({
      async send(p) {
        if (failNext) {
          const e = failNext
          failNext = null
          throw e
        }
        sent.push(p)
      },
    })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
  beforeEach(async () => {
    sent.length = 0
    failNext = null
    chatId = `-100${5_000_000_000 + ++chatSeq}`
    adminTg = `${6_000_000 + chatSeq}`
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await mk('owner')
    organizerId = await mk('organizer')
    playerId = await mk('player')
    outsiderId = await mk('outsider')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Чат Орг' })).id
    otherOrgId = (await organizationService.create({ userId: outsiderId }, { name: 'Чужая' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  it('the organizer issues a one-time code; a player and an outsider cannot', async () => {
    const res = await issue()
    expect(res.status).toBe(200)
    const body = res.body as { code: string; expiresAt: string; command: string }
    expect(body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(body.command).toBe(`/link ${body.code}`)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await issue(playerId)).status).toBe(403)
    expect((await issue(outsiderId)).status).toBe(403)
    expect((await issue(outsiderId, otherOrgId)).status).toBe(200)
  })

  it('full flow: code in the cabinet -> bot claim -> status -> announce -> unlink', async () => {
    const { code } = (await issue()).body as { code: string }
    const claimed = await claim(code)
    expect(claimed.status).toBe(200)
    expect(claimed.body).toEqual({
      outcome: 'linked',
      organizationName: 'Чат Орг',
      botCanPost: true,
    })

    const statusRes = await request('GET', `/api/organizations/${orgId}/telegram-chat`, {
      user: organizerId,
    })
    expect(statusRes.status).toBe(200)
    expect(statusRes.body).toMatchObject({
      link: { status: 'active', title: 'Чат', botCanPost: true, invalidReason: null },
      pendingCode: null,
    })
    // ни кода, ни id чата и администратора
    expect(statusRes.text).not.toContain(code.replace('-', ''))
    expect(statusRes.text).not.toContain(chatId.slice(1))
    expect(statusRes.text).not.toContain(adminTg)

    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Вечерняя игра',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 12,
      price: 0,
    })
    const announce = await request(
      'POST',
      `/api/organizations/${orgId}/events/${ev.id}/telegram-announce`,
      { user: organizerId, body: {} },
    )
    expect(announce.status).toBe(200)
    expect(announce.body).toEqual({ announced: true })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.telegramId).toBe(chatId)
    expect(sent[0]!.text).toContain('Вечерняя игра')
    expect(sent[0]!.text).toContain('Свободно 12 из 12 мест.')
    for (const b of sent[0]!.keyboard!.flat()) {
      expect(b.url).toBe(`https://t.me/volleytime_test_bot?startapp=event_${ev.id}`)
      expect(b.webAppUrl).toBeUndefined()
    }
    // тело запроса анонс не определяет: лишние поля игнорируются, подмена текста невозможна
    sent.length = 0
    await request('POST', `/api/organizations/${orgId}/events/${ev.id}/telegram-announce`, {
      user: organizerId,
      body: {
        text: 'Подмена',
        telegramId: '999',
        keyboard: [[{ text: 'x', webAppUrl: 'https://e' }]],
      },
    })
    expect(sent[0]!.telegramId).toBe(chatId)
    expect(sent[0]!.text).not.toContain('Подмена')

    const del = await request('DELETE', `/api/organizations/${orgId}/telegram-chat`, {
      user: organizerId,
    })
    expect(del.body).toEqual({ unlinked: true })
    const again = await request(
      'POST',
      `/api/organizations/${orgId}/events/${ev.id}/telegram-announce`,
      { user: organizerId, body: {} },
    )
    expect(again.status).toBe(409)
    expect((again.body as { data: { code: string } }).data.code).toBe('telegram_chat.not_linked')
    const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'telegram_chat.code_issued',
        'telegram_chat.linked',
        'telegram_chat.event_announced',
        'telegram_chat.unlinked',
      ]),
    )
    expect(JSON.stringify(audit)).not.toContain(code.replace('-', ''))
  })

  it('a code of one group cannot link, announce into or unlink the chat of another group', async () => {
    const { code } = (await issue(outsiderId, otherOrgId)).body as { code: string }
    await claim(code)
    const foreignEv = await eventService.create({ userId: outsiderId }, otherOrgId, {
      title: 'Чужая игра',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 5,
      price: 0,
    })
    // событие чужой группы по своему пути — 404, в чужой чат ничего не уходит
    const res = await request(
      'POST',
      `/api/organizations/${orgId}/events/${foreignEv.id}/telegram-announce`,
      { user: ownerId, body: {} },
    )
    expect(res.status).toBe(404)
    expect(sent).toHaveLength(0)
    // отвязка по своему пути не трогает чужую привязку
    await request('DELETE', `/api/organizations/${orgId}/telegram-chat`, { user: ownerId })
    const rows = await db.select().from(organizationTelegramChats)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.organizationId).toBe(otherOrgId)
    expect(rows[0]!.status).toBe('active')
  })

  it('the bot gets a clear outcome for a reused, wrong or conflicting code; a conflict burns the code', async () => {
    const { code } = (await issue()).body as { code: string }
    expect((await claim(code)).body).toMatchObject({ outcome: 'linked' })
    expect((await claim(code)).body).toEqual({ outcome: 'code_invalid' })
    expect((await claim('ZZZZ-ZZZZ')).body).toEqual({ outcome: 'code_invalid' })
    const other = (await issue(outsiderId, otherOrgId)).body as { code: string }
    expect((await claim(other.code)).body).toEqual({ outcome: 'chat_taken' })
    expect((await claim(other.code, { chatId: '-1007654321' })).body).toEqual({
      outcome: 'code_invalid',
    })
  })

  it('a code posted by a non-administrator is burned through the rejected verdict', async () => {
    const { code } = (await issue()).body as { code: string }
    const rejected = await bot('chat-link', {
      verdict: 'rejected',
      code,
      chatId: chatId,
    })
    expect(rejected.body).toEqual({ outcome: 'rejected' })
    expect((await claim(code)).body).toEqual({ outcome: 'code_invalid' })
    // лишние поля и чужой формат отклоняются до базы
    expect(
      (await bot('chat-link', { verdict: 'rejected', code, chatId: '-1001', title: 'x' })).status,
    ).toBe(422)
  })

  it('burning codes does not use the claim limit: a stranger cannot block /link for the admin', async () => {
    for (let i = 0; i < 25; i++) {
      const res = await bot('chat-link', { verdict: 'rejected', code: 'ZZZZ-ZZZZ', chatId })
      expect(res.status).toBe(200)
    }
    const { code } = (await issue()).body as { code: string }
    const claimed = await claim(code)
    expect(claimed.status).toBe(200)
    expect(claimed.body).toMatchObject({ outcome: 'linked' })
  })

  it('too many code issues or announcements answer telegram_chat.rate_limited', async () => {
    let last = await issue()
    for (let i = 0; i < 10; i++) last = await issue()
    // выдача кода уже начиналась с 200; после лимита — 429 с доменным кодом
    expect(last.status).toBe(429)
    expect((last.body as { data: { code: string } }).data.code).toBe('telegram_chat.rate_limited')
  })

  it('the secret is checked before the body is parsed on every new internal route', async () => {
    for (const path of ['chat-link', 'chat-member']) {
      for (const headers of [{}, { 'x-internal-secret': 'nope' }]) {
        expect((await bot(path, { chatId: 'abc' }, headers)).status, path).toBe(401)
        expect((await bot(path, 'not-json{', headers)).status, path).toBe(401)
        expect((await bot(path, null, headers)).status, path).toBe(401)
      }
    }
    expect((await bot('chat-link', { chatId: 'abc' })).status).toBe(422)
    expect((await bot('chat-member', { chatId: '12', status: 'member' })).status).toBe(422)
    // личный чат (положительный id) привязать нельзя
    expect(
      (
        await claim('ABCD-EFGH', {
          chatId: '1234',
          chatType: 'supergroup',
        })
      ).status,
    ).toBe(422)
    expect((await claim('ABCD-EFGH', { chatType: 'private' })).status).toBe(422)
    expect((await claim('ABCD-EFGH', { extra: 'field' })).status).toBe(422)
  })

  it('limits code guessing per chat admin', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      statuses.push(
        (await claim('ABCD-EFGH', { confirmedByTelegramId: '9100', chatId: '-1009999999999' }))
          .status,
      )
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
    expect(statuses.slice(10)).toEqual([429, 429])
  })

  it('chat-member: losing the right to post invalidates and restores; removal frees the chat for good', async () => {
    const { code } = (await issue()).body as { code: string }
    await claim(code)
    const upd = (status: string, canPost: boolean) =>
      bot('chat-member', {
        chatId: chatId,
        chatType: 'supergroup',
        status,
        canPost,
      })
    const getStatus = async () =>
      (await request('GET', `/api/organizations/${orgId}/telegram-chat`, { user: ownerId }))
        .body as {
        link: { status: string; invalidReason: string | null } | null
        released: { reason: string } | null
      }
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Игра',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 5,
      price: 0,
    })
    const announce = () =>
      request('POST', `/api/organizations/${orgId}/events/${ev.id}/telegram-announce`, {
        user: ownerId,
        body: {},
      })

    expect((await upd('restricted', false)).body).toEqual({ matched: true })
    expect((await getStatus()).link).toMatchObject({
      status: 'invalid',
      invalidReason: 'no_rights',
    })
    const refused = await announce()
    expect(refused.status).toBe(409)
    expect((refused.body as { data: { code: string } }).data.code).toBe('telegram_chat.no_rights')
    expect(sent).toHaveLength(0)
    await upd('member', true)
    expect((await getStatus()).link!.status).toBe('active')

    // бота исключили: привязка снята, причина видна организатору, возвращение бота не оживляет
    expect((await upd('kicked', false)).body).toEqual({ matched: true })
    const after = await getStatus()
    expect(after.link).toBeNull()
    expect(after.released).toMatchObject({ reason: 'bot_removed' })
    expect((await upd('member', true)).body).toEqual({ matched: false })
    expect((await getStatus()).link).toBeNull()
    expect(((await announce()).body as { data: { code: string } }).data.code).toBe(
      'telegram_chat.not_linked',
    )
    // чат свободен: другая группа привязывает его новым кодом
    const other = (await issue(outsiderId, otherOrgId)).body as { code: string }
    expect((await claim(other.code)).body).toMatchObject({ outcome: 'linked' })
    // чат без привязки не создаётся из my_chat_member
    expect(
      (
        await bot('chat-member', {
          chatId: '-100999',
          chatType: 'group',
          status: 'member',
          canPost: true,
        })
      ).body,
    ).toEqual({ matched: false })
  })

  it('Bot API failures reach the organizer as clear codes without tokens or internals', async () => {
    const { code } = (await issue()).body as { code: string }
    await claim(code)
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Игра',
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 5,
      price: 0,
    })
    const announce = () =>
      request('POST', `/api/organizations/${orgId}/events/${ev.id}/telegram-announce`, {
        user: organizerId,
        body: {},
      })
    failNext = new Error('Bad Request: 123456:SECRET-BOT-TOKEN http://bot:3001')
    const transient = await announce()
    expect(transient.status, transient.text).toBe(502)
    expect(transient.text).not.toContain('SECRET-BOT-TOKEN')
    expect(transient.text).not.toContain('bot:3001')
    failNext = new DeliveryError('rate_limited', 5000)
    expect((await announce()).status).toBe(429)
    failNext = new DeliveryError('blocked', undefined, 'no_rights')
    const noRights = await announce()
    expect(noRights.status).toBe(409)
    expect((noRights.body as { data: { code: string } }).data.code).toBe('telegram_chat.no_rights')
    // теперь привязка недействительна: следующий вызов не доходит до бота
    const next = await announce()
    expect((next.body as { data: { code: string } }).data.code).toBe('telegram_chat.no_rights')
    expect(sent).toHaveLength(0)
  })
})
