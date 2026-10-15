// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsVenues from './SettingsVenues.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback: string) => fallback)
})
afterEach(() => {
  document.body.innerHTML = ''
})

async function mountVenues(canManage = true) {
  const wrapper = mount(SettingsVenues, { props: { orgId: 7, canManage }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('SettingsVenues', () => {
  it('lists the venues of the group', async () => {
    fetchMock.mockResolvedValueOnce({
      venues: [
        { id: 1, name: 'Школа №24', address: 'ул. Кропоткина 91' },
        { id: 2, name: 'СК «Заслонова»', address: null },
      ],
    })
    const wrapper = await mountVenues()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/venues')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.text()).toContain('ул. Кропоткина 91')
  })

  it('shows an empty state with a hint', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [] })
    expect((await mountVenues()).text()).toContain('Залов пока нет')
  })

  it('shows a load error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({
      venues: [{ id: 1, name: 'Зал', address: null }],
    })
    const wrapper = await mountVenues()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось загрузить залы')
    await wrapper.find('.vt-settings-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Зал')
    expect(wrapper.find('.vt-settings-load-error').exists()).toBe(false)
  })

  it('requires a name before adding and does not call the server', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [] })
    const wrapper = await mountVenues()
    await wrapper.find('.vt-settings-card__head button').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Укажите название зала')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds a venue, appends it to the list and toasts', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [] }).mockResolvedValueOnce({
      venue: { id: 9, name: 'Новый зал', address: 'ул. Мира 1' },
    })
    const wrapper = await mountVenues()
    await wrapper.find('.vt-settings-card__head button').trigger('click')
    const inputs = wrapper.findAll('form input')
    await inputs[0]!.setValue(' Новый зал ')
    await inputs[1]!.setValue('ул. Мира 1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/venues', {
      method: 'POST',
      body: { name: 'Новый зал', address: 'ул. Мира 1' },
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Новый зал')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Зал добавлен', 'ok'])
  })

  it('keeps the form and shows the error when the server refuses', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [] }).mockRejectedValueOnce(new Error('403'))
    const wrapper = await mountVenues()
    await wrapper.find('.vt-settings-card__head button').trigger('click')
    await wrapper.find('form input').setValue('Зал')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toContain('Не удалось добавить зал')
    expect((wrapper.find('form input').element as HTMLInputElement).value).toBe('Зал')
  })

  it('hides the add button without manage rights', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [] })
    expect((await mountVenues(false)).find('.vt-settings-card__head button').exists()).toBe(false)
  })
})
