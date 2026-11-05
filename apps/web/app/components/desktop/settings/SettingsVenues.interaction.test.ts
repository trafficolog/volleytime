// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import SettingsVenues from './SettingsVenues.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('computed', computed)
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
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/venues?includeArchived=true')
    expect(wrapper.findAll('li.vt-settings-venue')).toHaveLength(2)
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

  it('without manage rights lists active venues only and shows no menu', async () => {
    fetchMock.mockResolvedValueOnce({ venues: [{ id: 1, name: 'Зал', address: null }] })
    const wrapper = await mountVenues(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/venues')
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })

  const listed = () => ({
    venues: [
      { id: 1, name: 'Школа', address: 'ул. Мира 1', status: 'active' },
      { id: 2, name: 'Старый зал', address: null, status: 'archived' },
      { id: 3, name: 'Без адреса', address: null, status: 'active' },
    ],
  })

  type Wrapper = Awaited<ReturnType<typeof mountVenues>>
  async function openMenu(wrapper: Wrapper, index: number) {
    await wrapper.findAll('button[aria-haspopup="menu"]')[index]!.trigger('click')
    await flushPromises()
  }
  const menuItem = (wrapper: Wrapper, text: string) =>
    wrapper.findAll('[role="menuitem"]').find((i) => i.text().includes(text))

  it('marks an archived venue and offers no delete for it', async () => {
    fetchMock.mockResolvedValueOnce(listed())
    const wrapper = await mountVenues()
    expect(wrapper.find('[data-archived]').text()).toContain('В архиве')
    expect(wrapper.findAll('[data-archived]')).toHaveLength(1)
    await openMenu(wrapper, 1)
    expect(menuItem(wrapper, 'Редактировать')).toBeTruthy()
    expect(menuItem(wrapper, 'Удалить')).toBeUndefined()
  })

  it('opens the edit form prefilled, patches name and null address and replaces the row', async () => {
    fetchMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce({
      venue: { id: 1, name: 'Школа 24', address: null, status: 'active' },
    })
    const wrapper = await mountVenues()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Редактировать')!.trigger('click')
    const inputs = wrapper.findAll('form input')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Школа')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('ул. Мира 1')
    await inputs[0]!.setValue(' Школа 24 ')
    await inputs[1]!.setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/venues/1', {
      method: 'PATCH',
      body: { name: 'Школа 24', address: null },
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('li.vt-settings-venue')).toHaveLength(3)
    expect(wrapper.text()).toContain('Школа 24')
    expect(wrapper.text()).not.toContain('ул. Мира 1')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Зал сохранён', 'ok'])
  })

  it('keeps the edit form and shows the error when the save fails', async () => {
    fetchMock.mockResolvedValueOnce(listed()).mockRejectedValueOnce(new Error('500'))
    const wrapper = await mountVenues()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Редактировать')!.trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toContain('Не удалось сохранить зал')
  })

  it('opens the address in an external map with the encoded OSM url', async () => {
    fetchMock.mockResolvedValueOnce(listed())
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = await mountVenues()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'На карте')!.trigger('click')
    expect(open).toHaveBeenCalledWith(
      `https://www.openstreetmap.org/search?query=${encodeURIComponent('ул. Мира 1')}`,
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('disables the map item when the venue has no address', async () => {
    fetchMock.mockResolvedValueOnce(listed())
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = await mountVenues()
    await openMenu(wrapper, 2)
    const item = menuItem(wrapper, 'На карте')!
    expect(item.attributes('disabled') ?? item.attributes('aria-disabled')).toBeDefined()
    await item.trigger('click')
    expect(open).not.toHaveBeenCalled()
  })

  async function askDelete(wrapper: Wrapper) {
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Удалить')!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('в архив')
    return [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Удалить')!
  }

  it('asks for confirmation before sending DELETE and removes the row on deleted', async () => {
    fetchMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce({
      outcome: 'deleted',
      venue: listed().venues[0],
    })
    const wrapper = await mountVenues()
    const confirm = await askDelete(wrapper)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    confirm.click()
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/venues/1', {
      method: 'DELETE',
    })
    expect(wrapper.text()).not.toContain('Школа')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Зал удалён', 'ok'])
  })

  it('marks the row as archived when the server archived the venue', async () => {
    fetchMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce({
      outcome: 'archived',
      venue: { ...listed().venues[0], status: 'archived' },
    })
    const wrapper = await mountVenues()
    const confirm = await askDelete(wrapper)
    confirm.click()
    await flushPromises()
    expect(wrapper.findAll('[data-archived]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Школа')
    expect(wrapper.emitted('toast')?.[0]?.[0]).toContain('в архиве')
  })

  it('sends one DELETE for a double click and toasts an error on failure', async () => {
    let reject!: (e: Error) => void
    fetchMock.mockResolvedValueOnce(listed()).mockReturnValueOnce(
      new Promise((_, r) => {
        reject = r
      }),
    )
    const wrapper = await mountVenues()
    const confirm = await askDelete(wrapper)
    confirm.click()
    confirm.click()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    reject(new Error('500'))
    await flushPromises()
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Не удалось удалить зал', 'danger'])
    expect(wrapper.text()).toContain('Школа')
  })
})
