// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsDanger from './SettingsDanger.vue'

const fetchMock = vi.fn()
const TOKEN = 'T'.repeat(43)

function httpError(status: number, code: string) {
  return { statusCode: status, data: { statusCode: status, data: { code } } }
}

/** Ответы API по адресу и методу; по умолчанию передачи нет. */
function route(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key in overrides) {
      const value = overrides[key]
      if (value instanceof Error || (value && typeof value === 'object' && 'statusCode' in value))
        throw value
      return typeof value === 'function' ? (value as (b: unknown) => unknown)(init?.body) : value
    }
    if (key === 'GET /api/organizations/7/ownership-transfer')
      return { transfer: null, restoreWindowDays: 30 }
    if (key === 'GET /api/organizations/7/members')
      return {
        members: [
          {
            id: 1,
            role: 'owner',
            status: 'active',
            user: { id: 100, name: 'Я Владелец', telegramUsername: null },
          },
          {
            id: 2,
            role: 'organizer',
            status: 'active',
            user: { id: 101, name: 'Анна', telegramUsername: null },
          },
          {
            id: 3,
            role: 'player',
            status: 'active',
            user: { id: 102, name: null, telegramUsername: 'boris' },
          },
        ],
      }
    throw new Error(`unexpected ${key}`)
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  route()
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const mountDanger = (busy = false, error = '') =>
  mount(SettingsDanger, {
    props: {
      busy,
      error,
      orgId: 7,
      orgName: 'VolleyTime Минск',
      ownerUserId: 100,
      timeZone: 'Europe/Minsk',
    },
    attachTo: document.body,
  })

const dialog = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null
const confirmButton = () => dialog()!.querySelector('.vt-btn--rose') as HTMLButtonElement

describe('SettingsDanger: archive', () => {
  it('asks for confirmation before archiving and does nothing on cancel', async () => {
    const wrapper = mountDanger()
    await wrapper.find('[data-danger="archive"]').trigger('click')
    expect(dialog()!.textContent).toContain('Архивировать группу?')
    ;(dialog()!.querySelector('.vt-btn--ghost') as HTMLButtonElement).click()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(wrapper.emitted('archive')).toBeUndefined()
  })

  it('emits archive after the confirmation', async () => {
    const wrapper = mountDanger()
    await wrapper.find('[data-danger="archive"]').trigger('click')
    confirmButton().click()
    await flushPromises()
    expect(wrapper.emitted('archive')).toHaveLength(1)
  })

  it('disables the button while archiving and shows an error', () => {
    const wrapper = mountDanger(true, 'Не удалось архивировать группу')
    expect(wrapper.find('[data-danger="archive"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="alert"]').text()).toBe('Не удалось архивировать группу')
  })
})

describe('SettingsDanger: ownership transfer', () => {
  it('offers active members except the owner and starts only after choosing one', async () => {
    route({
      'POST /api/organizations/7/ownership-transfer': (body: unknown) => {
        expect(body).toEqual({ recipientMemberId: 2 })
        return {
          transfer: {
            id: 5,
            toName: 'Анна',
            expiresAt: '2026-11-12T15:00:00.000Z',
            botDelivery: { status: 'delivered' },
          },
          links: {
            telegram: `https://t.me/bot?startapp=transfer_${TOKEN}`,
            web: `https://app.test/app/transfer#${TOKEN}`,
          },
        }
      },
    })
    const wrapper = mountDanger()
    await flushPromises()
    await wrapper.find('[data-danger="transfer"]').trigger('click')
    await flushPromises()
    expect(dialog()!.textContent).toContain('Передать владение?')
    expect(dialog()!.textContent).toContain('станете организатором')
    // без выбора получателя подтвердить нельзя
    expect(confirmButton().disabled).toBe(true)
    const options = [...dialog()!.querySelectorAll('[role="option"]')].map((o) => o.textContent)
    expect(options.join('|')).toContain('Анна')
    expect(options.join('|')).toContain('@boris')
    expect(options.join('|')).not.toContain('Владелец')
    ;(dialog()!.querySelector('.vt-select__button') as HTMLButtonElement).click()
    await flushPromises()
    const anna = [...dialog()!.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
      o.textContent?.includes('Анна'),
    )!
    anna.click()
    await flushPromises()
    expect(confirmButton().disabled).toBe(false)
    confirmButton().click()
    await flushPromises()
    expect(wrapper.find('[data-transfer-pending]').text()).toContain('Анна')
    const links = wrapper.find('[data-transfer-links]')
    expect(links.text()).toContain('показывается один раз')
    expect(wrapper.find('[data-transfer-bot="delivered"]').text()).toContain('Бот отправил ссылку')
    expect(wrapper.find('[data-transfer-bot="not-delivered"]').exists()).toBe(false)
    const values = links.findAll('input').map((i) => (i.element as HTMLInputElement).value)
    expect(values).toEqual([
      `https://t.me/bot?startapp=transfer_${TOKEN}`,
      `https://app.test/app/transfer#${TOKEN}`,
    ])
    // пока передача ожидает, удалить группу нельзя
    expect(wrapper.find('[data-danger="delete"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('toast')![0]).toEqual([
      'Передача начата: бот отправил ссылку получателю',
      'ok',
    ])
  })

  it('21.4.7: bot did not deliver — transfer is created, owner sees the state and the manual links', async () => {
    route({
      'POST /api/organizations/7/ownership-transfer': {
        transfer: {
          id: 5,
          toName: 'Анна',
          expiresAt: '2026-11-12T15:00:00.000Z',
          botDelivery: { status: 'not_delivered', reason: 'no_telegram' },
        },
        links: {
          telegram: `https://t.me/bot?startapp=transfer_${TOKEN}`,
          web: `https://app.test/app/transfer#${TOKEN}`,
        },
      },
    })
    const wrapper = mountDanger()
    await flushPromises()
    await wrapper.find('[data-danger="transfer"]').trigger('click')
    await flushPromises()
    ;(dialog()!.querySelector('.vt-select__button') as HTMLButtonElement).click()
    await flushPromises()
    ;[...dialog()!.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((o) => o.textContent?.includes('Анна'))!
      .click()
    await flushPromises()
    confirmButton().click()
    await flushPromises()
    const state = wrapper.find('[data-transfer-bot="not-delivered"]')
    expect(state.text()).toContain('Бот не доставил ссылку')
    expect(state.text()).toContain('не подключил бота')
    expect(state.text()).toContain('Отправьте ссылку ниже')
    expect(wrapper.find('[data-transfer-links]').text()).toContain(
      'Отправьте ссылку получателю сами',
    )
    expect(wrapper.emitted('toast')![0]![0]).toContain('бот не доставил')
  })

  it('21.4.7: after a reload the not-delivered state stays and says the link cannot be shown again', async () => {
    route({
      'GET /api/organizations/7/ownership-transfer': {
        transfer: {
          id: 5,
          toName: 'Анна',
          expiresAt: '2026-11-12T15:00:00.000Z',
          botDelivery: { status: 'not_delivered', reason: 'blocked' },
        },
        restoreWindowDays: 30,
      },
    })
    const wrapper = mountDanger()
    await flushPromises()
    const state = wrapper.find('[data-transfer-bot="not-delivered"]')
    expect(state.text()).toContain('заблокировал бота')
    expect(state.text()).toContain('отмените передачу и начните заново')
    expect(wrapper.find('[data-transfer-links]').exists()).toBe(false)
  })

  it('shows a pending transfer without the link and cancels it after confirmation', async () => {
    route({
      'GET /api/organizations/7/ownership-transfer': {
        transfer: { id: 5, toName: 'Анна', expiresAt: '2026-11-12T15:00:00.000Z' },
        restoreWindowDays: 30,
      },
      'DELETE /api/organizations/7/ownership-transfer': { cancelled: true },
    })
    const wrapper = mountDanger()
    await flushPromises()
    expect(wrapper.find('[data-transfer-pending]').text()).toMatch(/Анна.*12 ноября 2026/)
    expect(wrapper.find('[data-transfer-links]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(TOKEN)
    await wrapper.find('[data-danger="cancel-transfer"]').trigger('click')
    expect(dialog()!.textContent).toContain('Ссылка перестанет работать')
    confirmButton().click()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/ownership-transfer', {
      method: 'DELETE',
    })
    expect(wrapper.find('[data-transfer-pending]').exists()).toBe(false)
    expect(wrapper.find('[data-danger="transfer"]').exists()).toBe(true)
  })

  it('explains a refused start (another transfer already pending)', async () => {
    route({
      'POST /api/organizations/7/ownership-transfer': httpError(
        409,
        'ownership_transfer.pending_exists',
      ),
    })
    const wrapper = mountDanger()
    await flushPromises()
    await wrapper.find('[data-danger="transfer"]').trigger('click')
    await flushPromises()
    ;(dialog()!.querySelector('.vt-select__button') as HTMLButtonElement).click()
    await flushPromises()
    dialog()!.querySelector<HTMLElement>('[role="option"]')!.click()
    await flushPromises()
    confirmButton().click()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Уже есть ожидающая передача')
  })
})

describe('SettingsDanger: delete', () => {
  it('enables deletion only after the exact group name is typed', async () => {
    route({
      'POST /api/organizations/7/delete': (body: unknown) => {
        expect(body).toEqual({ confirmName: 'VolleyTime Минск' })
        return { deletedAt: '2026-11-09T15:00:00.000Z', restoreUntil: '2026-12-09T15:00:00.000Z' }
      },
    })
    const wrapper = mountDanger()
    await flushPromises()
    expect(wrapper.text()).toContain('в течение 30 дней')
    await wrapper.find('[data-danger="delete"]').trigger('click')
    expect(dialog()!.textContent).toContain(
      'Баланс событий, касса, абонементы и платежи не изменятся',
    )
    const input = dialog()!.querySelector('[data-delete-confirm]') as HTMLInputElement
    expect(confirmButton().disabled).toBe(true)
    for (const wrong of ['volleytime минск', 'VolleyTime', 'VolleyTime Минск!']) {
      input.value = wrong
      input.dispatchEvent(new Event('input'))
      await flushPromises()
      expect(confirmButton().disabled, wrong).toBe(true)
    }
    // клик по недоступной кнопке ничего не отправляет
    confirmButton().click()
    await flushPromises()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    input.value = 'VolleyTime Минск'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(confirmButton().disabled).toBe(false)
    confirmButton().click()
    await flushPromises()
    expect(wrapper.emitted('deleted')![0]).toEqual([
      { deletedAt: '2026-11-09T15:00:00.000Z', restoreUntil: '2026-12-09T15:00:00.000Z' },
    ])
  })

  it('shows the server refusal when deletion fails', async () => {
    route({
      'POST /api/organizations/7/delete': httpError(409, 'organization.transfer_pending'),
    })
    const wrapper = mountDanger()
    await flushPromises()
    await wrapper.find('[data-danger="delete"]').trigger('click')
    const input = dialog()!.querySelector('[data-delete-confirm]') as HTMLInputElement
    input.value = 'VolleyTime Минск'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    confirmButton().click()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('отмените ожидающую передачу')
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})
