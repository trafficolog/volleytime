// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPaymentMethods from './SettingsPaymentMethods.vue'

import VtToggle from '~/components/vt/Toggle.vue'

const fetchMock = vi.fn()
const URL = '/api/organizations/7/payment-methods'

const cash = (enabled = true) => ({
  method: 'cash',
  enabled,
  bank: null,
  cardLast4: null,
  recipient: null,
})
const transfer = (extra: Record<string, unknown> = {}) => ({
  method: 'transfer',
  enabled: true,
  bank: 'Belarusbank',
  cardLast4: '3214',
  recipient: 'Иван П.',
  ...extra,
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
})
afterEach(() => {
  document.body.innerHTML = ''
})

async function mountSection(methods = [cash(), transfer()], canManage = true) {
  fetchMock.mockResolvedValueOnce({ methods })
  const wrapper = mount(SettingsPaymentMethods, {
    props: { orgId: 7, canManage },
    global: { stubs: { VtToggle } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const switches = (w: Awaited<ReturnType<typeof mountSection>>) => w.findAll('[role="switch"]')
const inputs = (w: Awaited<ReturnType<typeof mountSection>>) => w.findAll('form input')

describe('SettingsPaymentMethods', () => {
  it('lists cash and transfer with requisites, and the online methods as unavailable', async () => {
    const wrapper = await mountSection()
    expect(fetchMock).toHaveBeenCalledWith(URL)
    const text = wrapper.text()
    expect(text).toContain('Наличными организатору')
    expect(text).toContain('Касса обновляется после подтверждения')
    expect(text).toContain('Перевод на карту')
    expect(text).toContain('Belarusbank · *3214 · Иван П.')
    expect(text).toContain('ЕРИП')
    expect(text).toContain('Картой онлайн (bePaid)')
    expect(text).toContain('фазе 12')
    const toggles = switches(wrapper)
    expect(toggles).toHaveLength(4)
    expect(toggles.map((t) => t.attributes('aria-checked'))).toEqual([
      'true',
      'true',
      'false',
      'false',
    ])
    // недоступные способы нельзя включить
    expect(toggles[2]!.attributes('aria-disabled')).toBe('true')
    expect(toggles[3]!.attributes('aria-disabled')).toBe('true')
    await toggles[2]!.trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('states what each setting affects', async () => {
    const wrapper = await mountSection()
    const text = wrapper.text()
    expect(text).toContain('игрок не увидит способ на экране «ждёт оплаты»')
    expect(text).toContain('уже созданные платежи можно подтверждать как прежде')
    expect(text).toContain('Показывается игроку на экране оплаты')
    expect(text).toContain('Полный номер карты не сохраняется')
  })

  it('switches a method off through the API and toasts', async () => {
    const wrapper = await mountSection()
    fetchMock.mockResolvedValueOnce({ method: cash(false) })
    await switches(wrapper)[0]!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith(`${URL}/cash`, {
      method: 'PATCH',
      body: { enabled: false },
    })
    expect(switches(wrapper)[0]!.attributes('aria-checked')).toBe('false')
    expect(wrapper.emitted('toast')?.at(-1)).toEqual(['Наличными организатору · выключен', 'ok'])
  })

  it('explains the consequence when every method is off', async () => {
    const wrapper = await mountSection([cash(false), transfer({ enabled: false })])
    expect(wrapper.text()).toContain('Оба способа выключены')
    expect(wrapper.text()).toContain('Запись на события по-прежнему работает')
  })

  it('keeps the switch and toasts an error when the save fails', async () => {
    const wrapper = await mountSection()
    fetchMock.mockRejectedValueOnce({ statusCode: 410 })
    await switches(wrapper)[1]!.trigger('click')
    await flushPromises()
    expect(switches(wrapper)[1]!.attributes('aria-checked')).toBe('true')
    expect(wrapper.emitted('toast')?.at(-1)?.[1]).toBe('danger')
    expect(String(wrapper.emitted('toast')?.at(-1)?.[0])).toContain('архиве')
  })

  it('saves only the changed requisites; an empty field clears the value', async () => {
    const wrapper = await mountSection()
    expect(inputs(wrapper).map((i) => (i.element as HTMLInputElement).value)).toEqual([
      'Belarusbank',
      '3214',
      'Иван П.',
    ])
    expect(wrapper.find('form button[type="submit"]').attributes('disabled')).toBeDefined()
    await inputs(wrapper)[0]!.setValue(' Приорбанк ')
    await inputs(wrapper)[2]!.setValue('')
    fetchMock.mockResolvedValueOnce({
      method: transfer({ bank: 'Приорбанк', recipient: null }),
    })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith(`${URL}/transfer`, {
      method: 'PATCH',
      body: { bank: 'Приорбанк', recipient: null },
    })
    expect(wrapper.text()).toContain('Приорбанк · *3214')
    expect(wrapper.emitted('toast')?.at(-1)).toEqual(['Реквизиты сохранены', 'ok'])
  })

  it('refuses a full card number before calling the server', async () => {
    const wrapper = await mountSection()
    await inputs(wrapper)[1]!.setValue('4111111111111111')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Укажите ровно 4 последние цифры')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await inputs(wrapper)[1]!.setValue('3214')
    await inputs(wrapper)[0]!.setValue('4111 1111 1111 1111')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Номер карты не принимается')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('limits the card field to four characters', async () => {
    const wrapper = await mountSection()
    expect(inputs(wrapper)[1]!.attributes('maxlength')).toBe('4')
  })

  it('shows the server refusal under the form and keeps the draft', async () => {
    const wrapper = await mountSection()
    await inputs(wrapper)[0]!.setValue('Приорбанк')
    fetchMock.mockRejectedValueOnce({ statusCode: 422 })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toContain('Сервер не принял значения')
    expect((inputs(wrapper)[0]!.element as HTMLInputElement).value).toBe('Приорбанк')
  })

  it('resets the draft on cancel', async () => {
    const wrapper = await mountSection()
    await inputs(wrapper)[0]!.setValue('Другой')
    const cancel = wrapper.findAll('form button').find((b) => b.text() === 'Отмена')!
    await cancel.trigger('click')
    expect((inputs(wrapper)[0]!.element as HTMLInputElement).value).toBe('Belarusbank')
  })

  it('is read-only without manage rights', async () => {
    const wrapper = await mountSection([cash(), transfer()], false)
    expect(wrapper.find('form button[type="submit"]').exists()).toBe(false)
    expect(inputs(wrapper)[0]!.attributes('readonly')).toBeDefined()
    await switches(wrapper)[0]!.trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a load error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({
      methods: [cash(), transfer()],
    })
    const wrapper = mount(SettingsPaymentMethods, {
      props: { orgId: 7, canManage: true },
      global: { stubs: { VtToggle } },
    })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось загрузить способы оплаты')
    await wrapper.find('.vt-settings-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Перевод на карту')
    expect(wrapper.find('.vt-settings-load-error').exists()).toBe(false)
  })
})
