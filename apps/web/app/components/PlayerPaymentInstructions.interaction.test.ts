// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PlayerPaymentInstructions from './PlayerPaymentInstructions.vue'

const fetchMock = vi.fn()
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

async function render(methods: unknown[]) {
  fetchMock.mockResolvedValueOnce({ methods })
  const wrapper = mount(PlayerPaymentInstructions, { props: { orgId: 30 } })
  await flushPromises()
  return wrapper
}

describe('PlayerPaymentInstructions', () => {
  it('shows the enabled methods and the transfer requisites from the API', async () => {
    const wrapper = await render([cash(), transfer()])
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/30/payment-methods')
    expect(wrapper.text()).toContain('Как оплатить')
    expect(wrapper.find('[data-method="cash"]').text()).toContain('Наличными организатору')
    expect(wrapper.find('[data-method="transfer"]').text()).toContain(
      'Belarusbank · *3214 · Иван П.',
    )
  })

  it('does not show a disabled method', async () => {
    const wrapper = await render([cash(), transfer({ enabled: false })])
    expect(wrapper.find('[data-method="cash"]').exists()).toBe(true)
    expect(wrapper.find('[data-method="transfer"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Belarusbank')
  })

  it('explains how to pay when every method is off', async () => {
    const wrapper = await render([])
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('Организатор не включил способы оплаты в приложении')
    expect(wrapper.text()).toContain('Уточните у него')
  })

  it('treats methods with enabled=false in the payload the same as an empty list', async () => {
    const wrapper = await render([cash(false), transfer({ enabled: false })])
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('Уточните у него')
  })

  it('never renders anything that looks like a full card number', async () => {
    const wrapper = await render([cash(), transfer()])
    expect(wrapper.text()).not.toMatch(/\d{5,}/)
  })

  it('falls back to asking the organizer when the load fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('x'))
    const wrapper = mount(PlayerPaymentInstructions, { props: { orgId: 30 } })
    expect(wrapper.text()).toContain('Загружаем')
    await flushPromises()
    expect(wrapper.text()).toContain('Уточните у организатора, как оплатить')
  })
})
