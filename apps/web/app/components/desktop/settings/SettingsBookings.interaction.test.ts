// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SettingsBookings from './SettingsBookings.vue'
import { baseSettings, makeController, stubs } from './settings-fixtures'

const levelOptions = [
  { code: 'v1', title: 'В1', description: 'Профи' },
  { code: 'v2', title: 'В2', description: 'Сильный любительский' },
  { code: 'v3', title: 'В3', description: 'Средний любительский' },
] as const

function mountBookings(canEdit = true, request = vi.fn()) {
  const ctx = makeController(request)
  const wrapper = mount(SettingsBookings, {
    props: {
      settings: ctx.settings.value,
      levelOptions: [...levelOptions],
      canEdit,
      controller: ctx.controller,
    },
    global: { stubs },
    attachTo: document.body,
  })
  return { ...ctx, wrapper }
}

const save = (wrapper: ReturnType<typeof mountBookings>['wrapper']) =>
  wrapper.find('form button[type="submit"]')
const seats = (wrapper: ReturnType<typeof mountBookings>['wrapper']) =>
  wrapper.find('input[data-settings-field="maxSeatsPerBooking"]')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsBookings', () => {
  it('shows the impact of each setting', () => {
    const { wrapper } = mountBookings()
    const text = wrapper.text()
    expect(text).toContain('вкладка и продажа абонементов скрыты')
    expect(text).toContain('игроки не могут сами отменить запись')
    expect(text).toContain('Новые события получают этот срок')
    expect(text).toContain('Игрок займёт до 3 мест')
    expect(text).toContain('Созданные события не меняются')
  })

  it('saves the subscriptions switch immediately and reverts it on a server error', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Нужны права владельца'))
    const { wrapper, settings, toast } = mountBookings(true, request)
    const toggle = wrapper.findAll('[role="switch"]')[0]!
    await toggle.trigger('click')
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { subscriptionsEnabled: false },
    })
    await flushPromises()
    expect(settings.value.subscriptionsEnabled).toBe(true)
    expect(toast).toHaveBeenCalledWith('Нужны права владельца', 'danger')
  })

  it('confirms the cancellation switch with the server response', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ settings: { ...baseSettings, cancellationAllowed: false } })
    const { wrapper, settings, toast } = mountBookings(true, request)
    await wrapper.findAll('[role="switch"]')[1]!.trigger('click')
    await flushPromises()
    expect(settings.value.cancellationAllowed).toBe(false)
    expect(toast).toHaveBeenCalledWith('Отмена записи выключена', 'ok')
  })

  it('changes seats with the stepper and saves only the changed field', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ settings: { ...baseSettings, maxSeatsPerBooking: 4 } })
    const { wrapper } = mountBookings(true, request)
    expect(save(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('button[aria-label="Больше мест"]').trigger('click')
    expect((seats(wrapper).element as HTMLInputElement).value).toBe('4')
    expect(wrapper.text()).toContain('до 4 мест')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { maxSeatsPerBooking: 4 },
    })
  })

  it('rejects seats outside 1..10 with an inline error and no request', async () => {
    const { wrapper, request } = mountBookings()
    await seats(wrapper).setValue('11')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('от 1 до 10')
    expect(seats(wrapper).attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(seats(wrapper).element)
    await seats(wrapper).setValue('')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('от 1 до 10')
    expect(request).not.toHaveBeenCalled()
  })

  it('stops the stepper at the limits', async () => {
    const { wrapper } = mountBookings()
    await seats(wrapper).setValue('10')
    expect(wrapper.find('button[aria-label="Больше мест"]').attributes('disabled')).toBeDefined()
    await seats(wrapper).setValue('1')
    expect(wrapper.find('button[aria-label="Меньше мест"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('приводить гостей нельзя')
  })

  it('picks a cancellation deadline in the select', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ settings: { ...baseSettings, cancellationDeadlineHours: 24 } })
    const { wrapper } = mountBookings(true, request)
    await wrapper.find('[role="combobox"]').trigger('click')
    const option = wrapper.findAll('[role="option"]').find((o) => o.text().includes('За 24 ч'))!
    await option.trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { cancellationDeadlineHours: 24 },
    })
  })

  it('locks the deadline select while cancellation is off', () => {
    const ctx = makeController()
    ctx.settings.value = { ...baseSettings, cancellationAllowed: false }
    const wrapper = mount(SettingsBookings, {
      props: {
        settings: ctx.settings.value,
        levelOptions: [...levelOptions],
        canEdit: true,
        controller: ctx.controller,
      },
      global: { stubs },
    })
    expect(wrapper.find('[role="combobox"]').attributes('disabled')).toBeDefined()
  })

  it('explains split pricing and sends the price and join mode defaults', async () => {
    const request = vi.fn().mockResolvedValue({
      settings: { ...baseSettings, defaultPriceMode: 'split', defaultJoinMode: 'invite' },
    })
    const { wrapper } = mountBookings(true, request)
    expect(wrapper.find('[role="note"]').exists()).toBe(false)
    const radios = wrapper.findAll('[role="radio"]')
    await radios.find((r) => r.text() === 'Делим общую сумму')!.trigger('click')
    await radios.find((r) => r.text() === 'По приглашению')!.trigger('click')
    expect(wrapper.find('[role="note"]').text()).toContain('станет известна после закрытия записи')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { defaultPriceMode: 'split', defaultJoinMode: 'invite' },
    })
  })

  it('keeps the draft and shows the server error when split pricing is refused', async () => {
    const { wrapper, settings } = mountBookings(
      true,
      vi.fn().mockRejectedValue(new Error('Сервер не принял значения. Проверьте поля')),
    )
    await wrapper
      .findAll('[role="radio"]')
      .find((r) => r.text() === 'Делим общую сумму')!
      .trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toContain('Сервер не принял значения')
    expect(settings.value.defaultPriceMode).toBe('fixed')
    expect(
      wrapper
        .findAll('[role="radio"]')
        .find((r) => r.text() === 'Делим общую сумму')!
        .attributes('aria-checked'),
    ).toBe('true')
  })

  it('selects several levels and sends them in scale order', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ settings: { ...baseSettings, levels: ['v1', 'v2', 'v3'] } })
    const { wrapper } = mountBookings(true, request)
    const boxes = wrapper.findAll('[role="checkbox"]')
    expect(boxes.map((b) => b.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    await boxes[2]!.trigger('click')
    await boxes[0]!.trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { levels: ['v1', 'v2', 'v3'] },
    })
  })

  it('cancel drops the unsaved draft', async () => {
    const { wrapper } = mountBookings()
    await wrapper.find('button[aria-label="Больше мест"]').trigger('click')
    await wrapper
      .findAll('form button')
      .find((b) => b.text() === 'Отмена')!
      .trigger('click')
    expect((seats(wrapper).element as HTMLInputElement).value).toBe('3')
    expect(save(wrapper).attributes('disabled')).toBeDefined()
  })

  it('is read-only for a non-owner: values stay readable and focusable but cannot change', async () => {
    const { wrapper, request } = mountBookings(false)
    expect(seats(wrapper).attributes('readonly')).toBeDefined()
    expect(seats(wrapper).attributes('disabled')).toBeUndefined()
    for (const control of wrapper.findAll(
      '[role="switch"], [role="radio"], [role="checkbox"], [role="combobox"]',
    )) {
      expect(control.attributes('aria-disabled')).toBe('true')
      expect(control.attributes('disabled')).toBeUndefined()
    }
    await wrapper
      .findAll('[role="radio"]')
      .find((r) => r.text() === 'Делим общую сумму')!
      .trigger('click')
    await wrapper.findAll('[role="checkbox"]')[0]!.trigger('click')
    await wrapper.findAll('[role="switch"]')[0]!.trigger('click')
    await wrapper.find('[role="combobox"]').trigger('click')
    expect(wrapper.findAll('[role="radio"]')[1]!.attributes('aria-checked')).toBe('false')
    expect(wrapper.findAll('[role="checkbox"]')[0]!.attributes('aria-checked')).toBe('false')
    expect(wrapper.find('[role="combobox"]').attributes('aria-expanded')).toBe('false')
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.find('form button[type="submit"]').exists()).toBe(false)
  })
})
