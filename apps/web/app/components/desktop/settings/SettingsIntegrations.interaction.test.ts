// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import SettingsIntegrations from './SettingsIntegrations.vue'
import { stubs } from './settings-fixtures'

const fetchMock = vi.fn()
const future = new Date(Date.now() + 86_400_000).toISOString()
const INVITE = {
  isRevoked: false,
  expiresAt: future,
  maxUses: null,
  usesCount: 0,
  roleToAssign: 'player',
  deeplinkUrl: 'https://t.me/volleytime_bot?startapp=invite_abc',
}

type Bot = {
  memberCount: number | null
  webhook: { state: 'not_used' | 'ok' | 'error' | 'unavailable'; pendingUpdateCount: number | null }
}
type Status = {
  bot?: Bot | null
  link: { status: 'active' | 'invalid'; title: string; invalidReason: string | null } | null
  pendingCode: null
  released: { reason: string } | null
}
const POLLING: Bot = { memberCount: 14, webhook: { state: 'not_used', pendingUpdateCount: null } }
const ACTIVE: Status = {
  link: { status: 'active', title: 'Чат Основа', invalidReason: null },
  bot: POLLING,
  pendingCode: null,
  released: null,
}
const INVALID: Status = {
  ...ACTIVE,
  link: { status: 'invalid', title: 'Чат Основа', invalidReason: 'no_rights' },
}
const NONE: Status = { link: null, pendingCode: null, released: null }

/** Маршрутизатор `$fetch`: статус и приглашения отдаются, действия задаёт тест. */
function route(status: Status, invites: unknown[] = [INVITE]) {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url.endsWith('/telegram-chat') && !opts?.method) return status
    if (url.endsWith('/invites')) return { invites }
    throw new Error(`unexpected ${opts?.method ?? 'GET'} ${url}`)
  })
}
const actions = () =>
  fetchMock.mock.calls
    .filter(([, o]) => o?.method)
    .map(([u, o]) => `${(o as { method: string }).method} ${u}`)

async function mountBlock(botUsername = 'volleytime_bot') {
  const wrapper = mount(SettingsIntegrations, {
    props: { orgId: 7, botUsername, base: '/app/orgs/7' },
    global: { stubs },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const button = (w: Awaited<ReturnType<typeof mountBlock>>, text: string) =>
  w.findAll('button').find((b) => b.text().includes(text))

beforeEach(() => {
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('computed', computed)
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsIntegrations (21.2.15)', () => {
  it('links to the configured bot and says so when the name is missing', async () => {
    route(NONE)
    const wrapper = await mountBlock()
    const link = wrapper.find('a.vt-settings-link')
    expect(link.text()).toBe('@volleytime_bot')
    expect(link.attributes('href')).toBe('https://t.me/volleytime_bot')
    expect(link.attributes('rel')).toContain('noopener')
    const none = await mountBlock('')
    expect(none.text()).toContain('Имя бота не настроено')
  })

  it('shows "Подключён" with the chat title for an active link', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    const s = wrapper.get('[data-testid="bot-status"]')
    expect(s.attributes('data-tone')).toBe('ok')
    expect(s.text()).toContain('Подключён')
    expect(s.text()).toContain('Чат Основа')
  })

  it('shows an unavailable chat as an error and disables the test message', async () => {
    route(INVALID)
    const wrapper = await mountBlock()
    const s = wrapper.get('[data-testid="bot-status"]')
    expect(s.attributes('data-tone')).toBe('danger')
    expect(s.text()).not.toContain('Подключён')
    expect(s.text()).toContain('нет права писать')
    expect(button(wrapper, 'Тест-сообщение')!.attributes('disabled')).toBeDefined()
  })

  it('shows a removed bot and a never linked group as not connected', async () => {
    route({ ...NONE, released: { reason: 'bot_removed' } })
    const removed = await mountBlock()
    expect(removed.get('[data-testid="bot-status"]').attributes('data-tone')).toBe('danger')
    expect(removed.text()).toContain('исключили')
    route(NONE)
    const fresh = await mountBlock()
    expect(fresh.get('[data-testid="bot-status"]').attributes('data-tone')).toBe('idle')
    expect(fresh.text()).toContain('Не подключён')
    expect(button(fresh, 'Тест-сообщение')).toBeUndefined()
    expect(button(fresh, 'Подключить чат')).toBeDefined()
  })

  it('shows the member count and says honestly that polling means no webhook (21.4.6)', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    expect(wrapper.get('[data-testid="bot-members"]').text()).toContain('14')
    const hook = wrapper.get('[data-testid="bot-webhook"]')
    expect(hook.attributes('data-tone')).toBe('idle')
    expect(hook.text()).toContain('Не используется')
    expect(hook.text()).toContain('polling')
    expect(hook.text()).not.toMatch(/ошибк/i)
  })

  it('shows a healthy and a failing webhook', async () => {
    route({ ...ACTIVE, bot: { memberCount: 3, webhook: { state: 'ok', pendingUpdateCount: 0 } } })
    const ok = await mountBlock()
    expect(ok.get('[data-testid="bot-webhook"]').attributes('data-tone')).toBe('ok')
    expect(ok.get('[data-testid="bot-webhook"]').text()).toContain('Работает')
    route({
      ...ACTIVE,
      bot: { memberCount: 3, webhook: { state: 'error', pendingUpdateCount: 4 } },
    })
    const bad = await mountBlock()
    const hook = bad.get('[data-testid="bot-webhook"]')
    expect(hook.attributes('data-tone')).toBe('danger')
    expect(hook.text()).toContain('Ошибка доставки')
    expect(hook.text()).toContain('4')
  })

  it('an unreachable bot leaves both fields as "no data" and the rest of the block intact', async () => {
    route({
      ...ACTIVE,
      bot: { memberCount: null, webhook: { state: 'unavailable', pendingUpdateCount: null } },
    })
    const wrapper = await mountBlock()
    expect(wrapper.get('[data-testid="bot-members"]').text()).toContain('Нет данных')
    expect(wrapper.get('[data-testid="bot-webhook"]').text()).toContain('Нет данных')
    expect(wrapper.get('[data-testid="bot-status"]').text()).toContain('Подключён')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(button(wrapper, 'Тест-сообщение')).toBeDefined()
  })

  it('hides both fields for an unlinked group', async () => {
    route({ ...NONE, bot: null })
    const wrapper = await mountBlock()
    expect(wrapper.find('[data-testid="bot-members"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bot-webhook"]').exists()).toBe(false)
  })

  it('copies the invite link', async () => {
    route(ACTIVE)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = await mountBlock()
    expect((wrapper.get('input[readonly]').element as HTMLInputElement).value).toBe(
      INVITE.deeplinkUrl,
    )
    await button(wrapper, 'Копировать')!.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(INVITE.deeplinkUrl)
    expect(wrapper.emitted('toast')![0]).toEqual(['Ссылка скопирована', 'ok'])
  })

  it('skips revoked and expired invites and points to the invites page', async () => {
    route(ACTIVE, [
      { ...INVITE, isRevoked: true },
      { ...INVITE, expiresAt: new Date(Date.now() - 1000).toISOString() },
    ])
    const wrapper = await mountBlock()
    expect(wrapper.find('input[readonly]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Действующей ссылки нет')
  })

  it('sends the test message to the own group and toasts', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    fetchMock.mockResolvedValueOnce({ sent: true })
    await button(wrapper, 'Тест-сообщение')!.trigger('click')
    await flushPromises()
    expect(actions()).toEqual(['POST /api/organizations/7/telegram-chat/test-message'])
    expect(wrapper.emitted('toast')![0]).toEqual(['Тестовое сообщение отправлено в чат', 'ok'])
  })

  it('shows the delivery error and re-reads the status after a failed test message', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    route(INVALID)
    fetchMock.mockRejectedValueOnce({ data: { data: { code: 'telegram_chat.no_rights' } } })
    await button(wrapper, 'Тест-сообщение')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('нет права писать')
    expect(wrapper.get('[data-testid="bot-status"]').attributes('data-tone')).toBe('danger')
  })

  it('reconnects after a confirmation: unlink, new code, command shown; cancel does nothing', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    await button(wrapper, 'Переподключить')!.trigger('click')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('будет отвязан')
    await button(wrapper, 'Отмена')!.trigger('click')
    expect(actions()).toEqual([])

    await button(wrapper, 'Переподключить')!.trigger('click')
    route(NONE)
    fetchMock.mockResolvedValueOnce({ unlinked: true })
    fetchMock.mockResolvedValueOnce({ command: '/link ABCD-EFGH' })
    await button(wrapper, 'Да, переподключить')!.trigger('click')
    await flushPromises()
    expect(actions()).toEqual([
      'DELETE /api/organizations/7/telegram-chat',
      'POST /api/organizations/7/telegram-chat/link-code',
    ])
    expect(wrapper.text()).toContain('/link ABCD-EFGH')
    expect(wrapper.text()).not.toContain('Подключён')
  })

  it('shows a reconnect failure', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    await button(wrapper, 'Переподключить')!.trigger('click')
    fetchMock.mockRejectedValueOnce({ data: { data: { code: 'telegram_chat.rate_limited' } } })
    await button(wrapper, 'Да, переподключить')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Слишком часто')
  })

  it('never renders a token or a chat id', async () => {
    route(ACTIVE)
    const wrapper = await mountBlock()
    expect(wrapper.html()).not.toMatch(/\d{6,}:[A-Za-z0-9_-]{20,}/)
    expect(wrapper.html()).not.toMatch(/-100\d+/)
  })
})
