// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import CabinetSearchToggle from './CabinetSearchToggle.vue'

const stubs = {
  VtIcon: { template: '<svg />' },
  CabinetSearch: {
    props: ['orgId', 'timeZone'],
    template:
      '<div role="search"><input type="search" /><a href="/app/orgs/3/members">Игрок</a></div>',
  },
}

function mountToggle() {
  return mount(CabinetSearchToggle, {
    props: { orgId: 3, timeZone: 'Europe/Minsk' },
    global: { stubs },
    attachTo: document.body,
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('cabinet search behind an icon (20.5.3)', () => {
  it('shows only the icon button until it is opened', () => {
    const wrapper = mountToggle()
    const trigger = wrapper.get('button[aria-label="Открыть поиск"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('slides the search out on click and focuses the field', async () => {
    const wrapper = mountToggle()
    await wrapper.get('button[aria-label="Открыть поиск"]').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Открыть поиск"]').attributes('aria-expanded')).toBe(
      'true',
    )
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  it('closes with the cross button and returns focus to the icon', async () => {
    const wrapper = mountToggle()
    await wrapper.get('button[aria-label="Открыть поиск"]').trigger('click')
    await wrapper.get('button[aria-label="Закрыть поиск"]').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('button[aria-label="Открыть поиск"]').element)
  })

  it('closes on Esc and returns focus to the icon', async () => {
    const wrapper = mountToggle()
    await wrapper.get('button[aria-label="Открыть поиск"]').trigger('click')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('button[aria-label="Открыть поиск"]').element)
  })

  it('closes on a click outside but not on a click inside', async () => {
    const wrapper = mountToggle()
    await wrapper.get('button[aria-label="Открыть поиск"]').trigger('click')
    wrapper.get('input').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('opens from the keyboard with Ctrl+K and Cmd+K and focuses the field', async () => {
    const wrapper = mountToggle()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('input').element)
    await wrapper.get('button[aria-label="Закрыть поиск"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
  })

  it('collapses after following a result link', async () => {
    const wrapper = mountToggle()
    await wrapper.get('button[aria-label="Открыть поиск"]').trigger('click')
    await wrapper.get('a').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('stops listening to the keyboard after unmount', async () => {
    const wrapper = mountToggle()
    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(document.querySelector('[role="search"]')).toBeNull()
  })
})
