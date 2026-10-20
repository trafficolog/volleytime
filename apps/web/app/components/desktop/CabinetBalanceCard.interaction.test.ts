// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import CabinetBalanceCard from './CabinetBalanceCard.vue'

const data = ref<unknown>(null)
const error = ref<unknown>(null)
const useFetch = vi.fn((_url: () => string, _opts: unknown) => ({ data, error }))
vi.stubGlobal('useFetch', useFetch)

beforeEach(() => {
  data.value = null
  error.value = null
  useFetch.mockClear()
})

describe('sidebar event balance card (20.5.3)', () => {
  it('reads the balance of the current group only', () => {
    mount(CabinetBalanceCard, { props: { orgId: 12 } })
    expect(useFetch.mock.calls[0]![0]()).toBe('/api/organizations/12/event-balance')
  })

  it('shows the remaining events', async () => {
    data.value = { eventBalance: { balance: 32, lowThreshold: 10, low: false } }
    const wrapper = mount(CabinetBalanceCard, { props: { orgId: 12 } })
    await flushPromises()
    expect(wrapper.text()).toContain('Баланс событий')
    expect(wrapper.text()).toContain('32')
    expect(wrapper.text()).toContain('события в балансе')
    expect(wrapper.text()).not.toContain('заканчивается')
  })

  it('warns when the balance is running out', () => {
    data.value = { eventBalance: { balance: 8, lowThreshold: 10, low: true } }
    const wrapper = mount(CabinetBalanceCard, { props: { orgId: 12 } })
    expect(wrapper.get('[role="status"]').text()).toBe('Баланс заканчивается')
  })

  it('shows a dash instead of a number when the balance cannot be loaded', () => {
    error.value = new Error('503')
    const wrapper = mount(CabinetBalanceCard, { props: { orgId: 12 } })
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).not.toContain('заканчивается')
  })
})
