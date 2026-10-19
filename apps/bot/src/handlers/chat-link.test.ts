import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTestBot, messageUpdate, myChatMemberUpdate, type ApiCall } from '../test-bot'
import { claimChatLink, syncChatMembership } from '../web-client'

import {
  ANONYMOUS_TEXT,
  CODE_INVALID_TEXT,
  CHAT_TAKEN_TEXT,
  GROUP_HAS_CHAT_TEXT,
  NOT_ADMIN_TEXT,
  NO_RIGHTS_TEXT,
  PRIVATE_TEXT,
  UNAVAILABLE_TEXT,
  USAGE_TEXT,
  canPostMessages,
  registerChatLinkHandler,
} from './chat-link'
import { registerMyChatMemberHandler } from './my-chat-member'

vi.mock('../web-client', () => ({
  claimChatLink: vi.fn(),
  syncChatMembership: vi.fn(),
  markUserReachable: vi.fn(),
}))
const claim = vi.mocked(claimChatLink)
const sync = vi.mocked(syncChatMembership)

const GROUP = -1001234567890
const of = (calls: ApiCall[], m: string) => calls.filter((c) => c.method === m)

/** Администратор чата и бот с правом писать — обычный случай. */
function members(over: { sender?: unknown; bot?: unknown } = {}) {
  return (call: ApiCall) => {
    if (call.method !== 'getChatMember') return undefined
    return call.payload.user_id === 1
      ? (over.bot ?? { status: 'administrator', user: { id: 1 } })
      : (over.sender ?? { status: 'administrator', user: { id: 42 } })
  }
}

function setup(reply = members()) {
  const t = makeTestBot({ reply })
  registerChatLinkHandler(t.bot)
  return t
}

const linkMsg = (text = '/link ABCD-EFGH', over = {}) =>
  messageUpdate(text, { chatId: GROUP, title: 'Чат «Основа»', ...over })

describe('canPostMessages', () => {
  it('members and administrators can post; restricted only with can_send_messages; others cannot', () => {
    const u = { id: 1, is_bot: true, first_name: 'B' }
    expect(canPostMessages({ status: 'member', user: u })).toBe(true)
    expect(canPostMessages({ status: 'administrator', user: u } as never)).toBe(true)
    expect(canPostMessages({ status: 'creator', user: u } as never)).toBe(true)
    expect(
      canPostMessages({
        status: 'restricted',
        can_send_messages: true,
        is_member: true,
        user: u,
      } as never),
    ).toBe(true)
    // ограниченный бот, которого в чате уже нет, писать не может
    expect(
      canPostMessages({
        status: 'restricted',
        can_send_messages: true,
        is_member: false,
        user: u,
      } as never),
    ).toBe(false)
    expect(
      canPostMessages({
        status: 'restricted',
        can_send_messages: false,
        is_member: true,
        user: u,
      } as never),
    ).toBe(false)
    expect(canPostMessages({ status: 'left', user: u })).toBe(false)
    expect(canPostMessages({ status: 'kicked', user: u } as never)).toBe(false)
  })
})

describe('/link in a group chat (20.3.4)', () => {
  beforeEach(() => {
    claim.mockReset()
    sync.mockReset()
  })

  it('sends the code to web only after the sender and the bot permissions are checked', async () => {
    claim.mockResolvedValue({
      outcome: 'linked',
      organizationName: 'VolleyTime Минск',
      botCanPost: true,
    })
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg())
    const checks = of(calls, 'getChatMember')
    expect(checks.map((c) => c.payload.user_id)).toEqual([42, 1])
    expect(checks.every((c) => c.payload.chat_id === GROUP)).toBe(true)
    expect(claim).toHaveBeenCalledWith({
      verdict: 'admin',
      code: 'ABCD-EFGH',
      chatId: String(GROUP),
      chatType: 'supergroup',
      title: 'Чат «Основа»',
      botCanPost: true,
      confirmedByTelegramId: '42',
    })
    const reply = of(calls, 'sendMessage')[0]!
    expect(reply.payload.text).toContain('привязан к группе')
    expect(reply.payload.text).toContain('VolleyTime Минск')
    expect(reply.payload.text).not.toContain('ABCD')
  })

  it('escapes the group name in the reply', async () => {
    claim.mockResolvedValue({ outcome: 'linked', organizationName: '<b>Хак</b>', botCanPost: true })
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg())
    expect(of(calls, 'sendMessage')[0]!.payload.text).toContain('&lt;b&gt;Хак&lt;/b&gt;')
  })

  const burned = { verdict: 'rejected', code: 'ABCD-EFGH', chatId: String(GROUP) }

  it('a member who is not a chat administrator cannot link: the code is burned and removed', async () => {
    claim.mockResolvedValue({ outcome: 'rejected' })
    const { bot, calls } = setup(members({ sender: { status: 'member', user: { id: 42 } } }))
    await bot.handleUpdate(linkMsg())
    expect(claim).toHaveBeenCalledExactlyOnceWith(burned)
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(NOT_ADMIN_TEXT)
    expect(of(calls, 'deleteMessage')).toHaveLength(1)
  })

  it.each(['left', 'kicked', 'restricted'])(
    'a %s sender is not an administrator',
    async (status) => {
      claim.mockResolvedValue({ outcome: 'rejected' })
      const { bot, calls } = setup(members({ sender: { status, user: { id: 42 } } }))
      await bot.handleUpdate(linkMsg())
      expect(claim).toHaveBeenCalledExactlyOnceWith(burned)
      expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(NOT_ADMIN_TEXT)
      expect(of(calls, 'deleteMessage')).toHaveLength(1)
    },
  )

  it('the creator of the chat can link', async () => {
    claim.mockResolvedValue({ outcome: 'linked', organizationName: 'G', botCanPost: true })
    const { bot } = setup(members({ sender: { status: 'creator', user: { id: 42 } } }))
    await bot.handleUpdate(linkMsg())
    expect(claim).toHaveBeenCalledOnce()
  })

  it('an anonymous administrator is asked to write on their own behalf; the code is burned', async () => {
    claim.mockResolvedValue({ outcome: 'rejected' })
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg('/link ABCD-EFGH', { anonymous: true }))
    expect(claim).toHaveBeenCalledExactlyOnceWith(burned)
    expect(of(calls, 'getChatMember')).toHaveLength(0)
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(ANONYMOUS_TEXT)
    expect(of(calls, 'deleteMessage')).toHaveLength(1)
  })

  it('records that the bot cannot post and warns the administrator', async () => {
    claim.mockResolvedValue({ outcome: 'linked', organizationName: 'G', botCanPost: false })
    const { bot, calls } = setup(
      members({
        bot: { status: 'restricted', can_send_messages: false, is_member: true, user: { id: 1 } },
      }),
    )
    await bot.handleUpdate(linkMsg())
    expect(claim.mock.calls[0]![0]).toMatchObject({ botCanPost: false })
    expect(of(calls, 'sendMessage')[0]!.payload.text).toContain(NO_RIGHTS_TEXT)
  })

  it.each([
    ['code_invalid', CODE_INVALID_TEXT],
    ['chat_taken', CHAT_TAKEN_TEXT],
    ['group_has_chat', GROUP_HAS_CHAT_TEXT],
    ['rejected', NOT_ADMIN_TEXT],
  ] as const)('reports %s with a clear text', async (outcome, text) => {
    claim.mockResolvedValue({ outcome })
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg())
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(text)
  })

  it('says the service is unavailable when web does not answer', async () => {
    claim.mockResolvedValue(null)
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg())
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(UNAVAILABLE_TEXT)
  })

  it('says the service is unavailable when Telegram cannot confirm the administrator', async () => {
    const { bot, calls } = setup((call) => {
      if (call.method === 'getChatMember') throw new Error('Bad Request: user not found')
      return undefined
    })
    claim.mockResolvedValue({ outcome: 'rejected' })
    await bot.handleUpdate(linkMsg())
    expect(claim).toHaveBeenCalledExactlyOnceWith(burned)
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(UNAVAILABLE_TEXT)
    expect(of(calls, 'deleteMessage')).toHaveLength(1)
  })

  it.each(['code_invalid', 'chat_taken', 'group_has_chat'] as const)(
    'removes the command message with the code after %s too',
    async (outcome) => {
      claim.mockResolvedValue({ outcome })
      const { bot, calls } = setup()
      await bot.handleUpdate(linkMsg())
      expect(of(calls, 'deleteMessage')).toHaveLength(1)
    },
  )

  it('keeps going when the bot has no right to delete the message', async () => {
    claim.mockResolvedValue({ outcome: 'rejected' })
    const { bot, calls } = setup((call) => {
      if (call.method === 'deleteMessage') throw new Error("Bad Request: message can't be deleted")
      return members()(call)
    })
    await bot.handleUpdate(linkMsg())
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(NOT_ADMIN_TEXT)
  })

  it('removes the command message with the code from the chat, best effort', async () => {
    claim.mockResolvedValue({ outcome: 'code_invalid' })
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg())
    expect(of(calls, 'deleteMessage')).toHaveLength(1)
  })

  it('shows usage without a code and never calls web', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(linkMsg('/link'))
    expect(claim).not.toHaveBeenCalled()
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(USAGE_TEXT)
  })

  it('explains in a private chat that the command belongs to the group chat', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(messageUpdate('/link ABCD-EFGH'))
    expect(claim).not.toHaveBeenCalled()
    expect(of(calls, 'getChatMember')).toHaveLength(0)
    expect(of(calls, 'sendMessage')[0]!.payload.text).toBe(PRIVATE_TEXT)
  })

  it('links plain groups too', async () => {
    claim.mockResolvedValue({ outcome: 'linked', organizationName: 'G', botCanPost: true })
    const { bot } = setup()
    await bot.handleUpdate(linkMsg('/link ABCD-EFGH', { chatType: 'group' }))
    expect(claim.mock.calls[0]![0]).toMatchObject({ chatType: 'group' })
  })
})

describe('my_chat_member in group chats (20.3.4)', () => {
  beforeEach(() => {
    sync.mockReset()
  })

  function setupMember() {
    const t = makeTestBot()
    registerMyChatMemberHandler(t.bot)
    return t
  }

  it('reports removal of the bot', async () => {
    const { bot } = setupMember()
    await bot.handleUpdate(myChatMemberUpdate('kicked', { chatId: GROUP, title: 'Чат' }))
    expect(sync).toHaveBeenCalledWith({
      chatId: String(GROUP),
      chatType: 'supergroup',
      title: 'Чат',
      status: 'kicked',
      canPost: false,
    })
  })

  it('reports addition and permission changes with the right to post', async () => {
    const { bot } = setupMember()
    await bot.handleUpdate(myChatMemberUpdate('member', { chatId: GROUP, chatType: 'group' }))
    expect(sync.mock.calls[0]![0]).toMatchObject({
      chatType: 'group',
      status: 'member',
      canPost: true,
    })
    await bot.handleUpdate(myChatMemberUpdate('restricted', { chatId: GROUP, canSend: false }))
    expect(sync.mock.calls[1]![0]).toMatchObject({ status: 'restricted', canPost: false })
    await bot.handleUpdate(myChatMemberUpdate('restricted', { chatId: GROUP, canSend: true }))
    expect(sync.mock.calls[2]![0]).toMatchObject({ status: 'restricted', canPost: true })
    await bot.handleUpdate(myChatMemberUpdate('administrator', { chatId: GROUP }))
    expect(sync.mock.calls[3]![0]).toMatchObject({ status: 'administrator', canPost: true })
  })

  it('treats a restricted bot that is no longer a member as removed', async () => {
    const { bot } = setupMember()
    await bot.handleUpdate(
      myChatMemberUpdate('restricted', { chatId: GROUP, canSend: true, isMember: false }),
    )
    expect(sync.mock.calls[0]![0]).toMatchObject({ status: 'left', canPost: false })
  })

  it('ignores channels', async () => {
    const { bot } = setupMember()
    await bot.handleUpdate(myChatMemberUpdate('member', { chatId: -100555, chatType: 'channel' }))
    expect(sync).not.toHaveBeenCalled()
  })
})
