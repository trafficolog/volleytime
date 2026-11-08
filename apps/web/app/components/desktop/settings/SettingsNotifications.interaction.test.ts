// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import SettingsNotifications from './SettingsNotifications.vue'

const fetchMock = vi.fn()

const ROWS = [
  { type: 'reminder_24h', enabled: true, mandatory: false },
  { type: 'reminder_2h', enabled: false, mandatory: false },
  { type: 'waitlist_offer', enabled: true, mandatory: true },
  { type: 'payment_confirmed', enabled: true, mandatory: true },
]

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('computed', computed)
})
afterEach(() => {
  document.body.innerHTML = ''
})

async function mountSettings() {
  const wrapper = mount(SettingsNotifications, { props: { orgId: 7 }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const switches = (wrapper: Awaited<ReturnType<typeof mountSettings>>) =>
  wrapper.findAll('[role="switch"]')

describe('SettingsNotifications', () => {
  it('shows six switches: two live, two mandatory (on, disabled), two coming soon (off, disabled)', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: ROWS })
    const wrapper = await mountSettings()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/notification-settings')
    const all = switches(wrapper)
    expect(all).toHaveLength(6)
    expect(all.map((s) => s.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'true',
      'true',
      'false',
      'false',
    ])
    expect(all.map((s) => s.attributes('disabled') !== undefined)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ])
    expect(wrapper.text()).toContain('Освободилось место')
    expect(wrapper.text()).toContain('Подтверждение оплаты')
    expect(wrapper.findAll('.vt-chip').map((c) => c.text())).toEqual([
      'обязательное',
      'обязательное',
      'скоро',
      'скоро',
    ])
  })

  it('gives every switch an accessible name and a hint of its effect', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: ROWS })
    const wrapper = await mountSettings()
    for (const s of switches(wrapper)) {
      expect(s.attributes('aria-labelledby')).toBeTruthy()
      expect(wrapper.find(`#${s.attributes('aria-labelledby')}`).text().length).toBeGreaterThan(0)
      expect(wrapper.find(`#${s.attributes('aria-describedby')}`).text().length).toBeGreaterThan(0)
    }
  })

  it('switches a reminder off immediately through PATCH and toasts', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: ROWS }).mockResolvedValueOnce({
      notifications: [{ ...ROWS[0]!, enabled: false }, ...ROWS.slice(1)],
    })
    const wrapper = await mountSettings()
    await switches(wrapper)[0]!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/notification-settings', {
      method: 'PATCH',
      body: { reminder_24h: false },
    })
    expect(switches(wrapper)[0]!.attributes('aria-checked')).toBe('false')
    expect(wrapper.emitted('toast')![0]).toEqual(['Уведомление выключено', 'ok'])
  })

  it('rolls the switch back and reports an error when saving fails', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: ROWS }).mockRejectedValueOnce(new Error('x'))
    const wrapper = await mountSettings()
    await switches(wrapper)[1]!.trigger('click')
    await flushPromises()
    expect(switches(wrapper)[1]!.attributes('aria-checked')).toBe('false')
    expect(wrapper.emitted('toast')![0]![1]).toBe('danger')
  })

  it('never calls the server for mandatory or coming-soon switches', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: ROWS })
    const wrapper = await mountSettings()
    for (const i of [2, 3, 4, 5]) await switches(wrapper)[i]!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(switches(wrapper).map((s) => s.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'true',
      'true',
      'false',
      'false',
    ])
  })

  it('shows a load error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ notifications: ROWS })
    const wrapper = await mountSettings()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось загрузить')
    await wrapper.find('.vt-settings-load-error button').trigger('click')
    await flushPromises()
    expect(switches(wrapper)).toHaveLength(6)
  })
})
