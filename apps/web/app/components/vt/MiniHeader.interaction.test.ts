// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import MiniHeader from './MiniHeader.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, VtIcon: true }

function mountHeader(nativeBack: boolean) {
  vi.stubGlobal('useTelegram', () => ({ nativeBack: computed(() => nativeBack) }))
  return mount(MiniHeader, {
    props: { title: 'Касса', back: '/m/orgs/7' },
    global: { stubs },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('MiniHeader back affordance (20.4.1)', () => {
  it('shows its own back link in a regular browser', () => {
    const wrapper = mountHeader(false)
    expect(wrapper.find('a[aria-label="Назад"]').attributes('href')).toBe('/m/orgs/7')
  })

  it('hides it when the system BackButton is available', () => {
    const wrapper = mountHeader(true)
    expect(wrapper.find('a[aria-label="Назад"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Касса')
  })
})
