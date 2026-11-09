// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import OwnershipTransferAccept from './OwnershipTransferAccept.vue'

import { readTransferToken, stashTransferToken } from '~/utils/group-danger'

const fetchMock = vi.fn()
const TOKEN = 'a'.repeat(20) + '-_' + 'B'.repeat(21)

function httpError(status: number, code: string) {
  return { statusCode: status, data: { statusCode: status, data: { code } } }
}

const pendingPreview = {
  status: 'pending',
  organization: { id: 9, name: 'VolleyTime Минск' },
  fromName: 'Иван',
  expiresAt: '2026-11-12T15:00:00.000Z',
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  sessionStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const mountPage = (token: string | null = TOKEN, orgBase = '/m/orgs') =>
  mount(OwnershipTransferAccept, {
    props: { token, orgBase },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

describe('OwnershipTransferAccept', () => {
  it('shows who transfers which group and accepts only on an explicit click', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/ownership-transfers/preview') return pendingPreview
      if (url === '/api/ownership-transfers/accept') return { organizationId: 9 }
      throw new Error(url)
    })
    stashTransferToken(TOKEN)
    const wrapper = mountPage()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // токен — только в теле запроса
    expect(fetchMock).toHaveBeenCalledWith('/api/ownership-transfers/preview', {
      method: 'POST',
      body: { token: TOKEN },
    })
    expect(wrapper.text()).toContain('VolleyTime Минск')
    expect(wrapper.text()).toContain('Иван передаёт вам владение')
    expect(wrapper.text()).toContain('станет организатором')
    expect(wrapper.text()).toContain('12 ноября 2026')
    await wrapper.find('[data-accept]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/ownership-transfers/accept', {
      method: 'POST',
      body: { token: TOKEN },
    })
    expect(wrapper.text()).toContain('Вы владелец группы')
    expect(wrapper.find('a').attributes('href')).toBe('/m/orgs/9')
    expect(readTransferToken()).toBeNull()
  })

  it.each([
    ['ownership_transfer.used', 409, 'Ссылка уже использована'],
    ['ownership_transfer.cancelled', 410, 'Передача отменена'],
    ['ownership_transfer.expired', 410, 'Срок ссылки истёк'],
    ['ownership_transfer.invalid', 404, 'Ссылка недействительна'],
  ])('a refused accept (%s) explains the reason', async (code, status, title) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/ownership-transfers/preview') return pendingPreview
      throw httpError(status, code)
    })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('[data-accept]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(title)
    expect(wrapper.find('[data-accept]').exists()).toBe(false)
  })

  it.each([
    ['invalid', 'Ссылка недействительна'],
    ['expired', 'Срок ссылки истёк'],
    ['cancelled', 'Передача отменена'],
    ['accepted', 'Ссылка уже использована'],
  ])('a %s link shows its state without the accept button', async (status, title) => {
    fetchMock.mockResolvedValue({ status, organization: null, fromName: null, expiresAt: null })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain(title)
    expect(wrapper.find('[data-accept]').exists()).toBe(false)
  })

  it('without a token shows an invalid link and calls nothing', async () => {
    const wrapper = mountPage(null)
    await flushPromises()
    expect(wrapper.text()).toContain('Ссылка недействительна')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks to sign in when the session is missing', async () => {
    fetchMock.mockRejectedValue(httpError(401, 'unauthorized'))
    const wrapper = mountPage(TOKEN, '/app/orgs')
    await flushPromises()
    expect(wrapper.text()).toContain('Войдите в Volley Time')
  })
})
