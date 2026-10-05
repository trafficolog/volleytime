// @vitest-environment happy-dom
import type { EventPricingView } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import EventPricingPanel from './EventPricingPanel.vue'

vi.stubGlobal('computed', computed)
const pricing: EventPricingView = {
  mode: 'split',
  targetAmount: 10001,
  settledAt: null,
  participantCount: 3,
  minAmount: 3333,
  maxAmount: 3334,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
describe('organizer pricing projection', () => {
  it('shows server range and target and emits only settlement intent', async () => {
    const wrapper = mount(EventPricingPanel, {
      props: {
        pricing,
        financials: null,
        currency: 'EUR',
        tz: 'Europe/Minsk',
        canSettle: true,
        pending: false,
      },
    })
    expect(wrapper.text()).toContain('100,01')
    expect(wrapper.text()).toContain('33,33')
    expect(wrapper.text()).toContain('33,34')
    expect(wrapper.text()).toContain('EUR')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('settle')).toEqual([[]])
    await wrapper.setProps({ pending: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ pending: false, canSettle: false })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
  it('keeps the settled count and range and excludes mismatched currency financials', async () => {
    const wrapper = mount(EventPricingPanel, {
      props: {
        pricing: { ...pricing, settledAt: '2026-10-01T12:00:00Z', basis: 'settled' },
        financials: { collected: 10001, pending: 0, cancelled: 0, refunded: 0, currency: 'USD' },
        currency: 'EUR',
        tz: 'Europe/Minsk',
        canSettle: false,
        pending: false,
      },
    })
    expect(wrapper.text()).toContain('Зафиксировано')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('USD')
    await wrapper.setProps({
      financials: { collected: 3333, pending: 6668, cancelled: 0, refunded: 0, currency: 'EUR' },
    })
    expect(wrapper.text()).toContain('33,33')
    expect(wrapper.text()).toContain('66,68')
  })
})
