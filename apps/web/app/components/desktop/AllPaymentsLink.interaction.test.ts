// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AllPaymentsLink from './AllPaymentsLink.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('«Все оплаты» links (20.5.3 close-out)', () => {
  it('points to the payments page of the given group', () => {
    const wrapper = mount(AllPaymentsLink, { props: { orgId: 42 }, global: { stubs } })
    const link = wrapper.get('a')
    expect(link.text()).toBe('Все оплаты')
    expect(link.attributes('href')).toBe('/app/orgs/42/payments')
  })
})
