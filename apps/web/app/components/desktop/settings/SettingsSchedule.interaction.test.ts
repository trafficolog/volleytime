// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import SettingsSchedule from './SettingsSchedule.vue'

const fetchMock = vi.fn()

interface Reply {
  slots?: unknown[] | Error
  venues?: unknown[] | Error
}
let replies: Reply

const slot = (over: Record<string, unknown> = {}) => ({
  id: 1,
  weekday: 1,
  startTime: '20:00',
  durationMinutes: 120,
  title: 'Основа',
  type: 'training',
  capacity: 12,
  venueId: 4,
  venueName: 'Школа №24',
  venueArchived: false,
  ...over,
})

beforeEach(() => {
  replies = {
    slots: [slot(), slot({ id: 2, weekday: 5, startTime: '19:30', title: 'Открытая игра' })],
    venues: [
      { id: 4, name: 'Школа №24' },
      { id: 5, name: 'СК «Заслонова»' },
    ],
  }
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (opts?.method) return undefined
    const key = url.endsWith('/venues') ? 'venues' : 'slots'
    const reply = replies[key]
    if (reply instanceof Error) throw reply
    return { [key]: reply }
  })
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback: string) => fallback)
})
afterEach(() => {
  document.body.innerHTML = ''
})

async function mountSchedule(canManage = true) {
  const wrapper = mount(SettingsSchedule, {
    props: { orgId: 7, canManage },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const writes = () => fetchMock.mock.calls.filter(([, opts]) => opts?.method)
const field = (wrapper: VueWrapper, label: string) => {
  const l = wrapper.findAll('label').find((x) => x.text() === label)!
  return wrapper.get(`#${l.attributes('for')}`)
}
async function openMenu(wrapper: VueWrapper, index: number) {
  await wrapper.findAll('button[aria-haspopup="menu"]')[index]!.trigger('click')
  await flushPromises()
}
const menuItem = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('[role="menuitem"]').find((i) => i.text().includes(text))
const radio = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button[role="radio"]').find((b) => b.text() === text)!

describe('SettingsSchedule list', () => {
  it('loads slots and active venues and shows weekday, time, title, places and venue', async () => {
    const wrapper = await mountSchedule()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/schedule-slots')
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/venues')
    const rows = wrapper.findAll('li.vt-settings-slot')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Пн')
    expect(rows[0]!.text()).toContain('20:00')
    expect(rows[0]!.text()).toContain('Основа')
    expect(rows[0]!.text()).toContain('Мест: 12')
    expect(rows[0]!.text()).toContain('Школа №24')
  })

  it('shows an empty state', async () => {
    replies.slots = []
    expect((await mountSchedule()).text()).toContain('Слотов пока нет')
  })

  it('shows a load error and retries', async () => {
    replies.slots = new Error('500')
    const wrapper = await mountSchedule()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось загрузить расписание')
    replies.slots = [slot()]
    await wrapper.find('.vt-settings-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('li.vt-settings-slot')).toHaveLength(1)
    expect(wrapper.find('.vt-settings-load-error').exists()).toBe(false)
  })

  it('still lists slots when the venue list fails', async () => {
    replies.venues = new Error('500')
    const wrapper = await mountSchedule()
    expect(wrapper.findAll('li.vt-settings-slot')).toHaveLength(2)
  })

  it('flags a slot whose venue went to the archive', async () => {
    replies.slots = [slot({ venueArchived: true })]
    expect((await mountSchedule()).text()).toContain('В архиве')
  })

  it('has no add button and no menu without manage rights', async () => {
    const wrapper = await mountSchedule(false)
    expect(wrapper.find('.vt-settings-card__head button').exists()).toBe(false)
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })

  it('tells that a slot creates no events by itself', async () => {
    expect((await mountSchedule()).text()).toContain('баланс не списывается')
  })
})

describe('SettingsSchedule add', () => {
  async function openNew() {
    const wrapper = await mountSchedule()
    await wrapper.find('.vt-settings-card__head button').trigger('click')
    return wrapper
  }

  it('validates before calling the server', async () => {
    const wrapper = await openNew()
    await field(wrapper, 'Время начала').setValue('')
    await field(wrapper, 'Мест').setValue('501')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Укажите время начала')
    expect(wrapper.text()).toContain('Название — от 2 символов')
    expect(wrapper.text()).toContain('Мест — от 1 до 500')
    expect(writes()).toHaveLength(0)
  })

  it('accepts the boundary values 1 and 500 places', async () => {
    for (const places of ['1', '500']) {
      const wrapper = await openNew()
      await field(wrapper, 'Название').setValue('Основа')
      await field(wrapper, 'Мест').setValue(places)
      await wrapper.find('form').trigger('submit')
      expect(wrapper.text()).not.toContain('Мест — от 1 до 500')
      wrapper.unmount()
    }
  })

  it('posts the slot, inserts it in weekday and time order and toasts', async () => {
    const wrapper = await openNew()
    await radio(wrapper, 'Ср').trigger('click')
    await field(wrapper, 'Время начала').setValue('18:30')
    await field(wrapper, 'Название').setValue(' Микст ')
    await field(wrapper, 'Мест').setValue('14')
    fetchMock.mockImplementationOnce(async () => ({
      slot: slot({
        id: 9,
        weekday: 3,
        startTime: '18:30',
        title: 'Микст',
        capacity: 14,
        venueId: null,
        venueName: null,
      }),
    }))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/schedule-slots', {
      method: 'POST',
      body: {
        weekday: 3,
        startTime: '18:30',
        title: 'Микст',
        type: 'training',
        durationMinutes: 120,
        capacity: 14,
        venueId: null,
      },
    })
    expect(wrapper.find('form').exists()).toBe(false)
    const titles = wrapper.findAll('li.vt-settings-slot').map((r) => r.text())
    expect(titles).toHaveLength(3)
    expect(titles[1]).toContain('Микст') // Пн, Ср, Пт
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Слот добавлен', 'ok'])
  })

  it('keeps the form and shows the server error', async () => {
    const wrapper = await openNew()
    await field(wrapper, 'Название').setValue('Основа')
    fetchMock.mockRejectedValueOnce(new Error('422'))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toContain('Не удалось добавить слот')
    expect((field(wrapper, 'Название').element as HTMLInputElement).value).toBe('Основа')
  })

  it('cancel closes the form without a request', async () => {
    const wrapper = await openNew()
    const cancel = wrapper.findAll('form button').find((b) => b.text() === 'Отмена')!
    await cancel.trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(writes()).toHaveLength(0)
  })
})

describe('SettingsSchedule edit and delete', () => {
  it('opens the edit form prefilled and patches the slot', async () => {
    const wrapper = await mountSchedule()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Изменить')!.trigger('click')
    expect((field(wrapper, 'Время начала').element as HTMLInputElement).value).toBe('20:00')
    expect((field(wrapper, 'Название').element as HTMLInputElement).value).toBe('Основа')
    expect((field(wrapper, 'Мест').element as HTMLInputElement).value).toBe('12')
    expect(radio(wrapper, 'Пн').attributes('aria-checked')).toBe('true')

    await field(wrapper, 'Время начала').setValue('21:00')
    await field(wrapper, 'Мест').setValue('16')
    fetchMock.mockImplementationOnce(async () => ({
      slot: slot({ startTime: '21:00', capacity: 16 }),
    }))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/schedule-slots/1', {
      method: 'PATCH',
      body: expect.objectContaining({ weekday: 1, startTime: '21:00', capacity: 16, venueId: 4 }),
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('21:00')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Расписание сохранено', 'ok'])
  })

  it('keeps an archived venue selectable while editing its slot', async () => {
    replies.slots = [slot({ venueId: 8, venueName: 'Старый зал', venueArchived: true })]
    const wrapper = await mountSchedule()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Изменить')!.trigger('click')
    expect(wrapper.text()).toContain('Старый зал (архив)')
  })

  it('asks for confirmation, then deletes only the template', async () => {
    const wrapper = await mountSchedule()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Удалить слот')!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Удаляется только шаблон')
    expect(writes()).toHaveLength(0)
    const confirm = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Удалить')!
    confirm.click()
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/7/schedule-slots/1', {
      method: 'DELETE',
    })
    expect(wrapper.findAll('li.vt-settings-slot')).toHaveLength(1)
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Слот удалён', 'ok'])
  })

  it('sends one DELETE for a double click and toasts the failure', async () => {
    const wrapper = await mountSchedule()
    await openMenu(wrapper, 0)
    await menuItem(wrapper, 'Удалить слот')!.trigger('click')
    await flushPromises()
    let reject!: (e: Error) => void
    fetchMock.mockReturnValueOnce(
      new Promise((_, r) => {
        reject = r
      }),
    )
    const confirm = [
      ...document.body.querySelector('[role="alertdialog"]')!.querySelectorAll('button'),
    ].find((b) => b.textContent === 'Удалить')!
    confirm.click()
    confirm.click()
    await flushPromises()
    expect(writes()).toHaveLength(1)
    reject(new Error('500'))
    await flushPromises()
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Не удалось удалить слот', 'danger'])
    expect(wrapper.findAll('li.vt-settings-slot')).toHaveLength(2)
  })
})
