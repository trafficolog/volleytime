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
    const trigger = wrapper.get('.vt-cabinet-search-toggle__trigger')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-label')).toBe('Открыть поиск')
    expect(trigger.attributes('aria-controls')).toBeUndefined()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('slides the search out on click and focuses the field', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    expect(wrapper.get('.vt-cabinet-search-toggle__trigger').attributes('aria-expanded')).toBe(
      'true',
    )
    expect(document.activeElement).toBe(wrapper.get('input').element)
    const trigger = wrapper.get('.vt-cabinet-search-toggle__trigger')
    expect(trigger.attributes('aria-label')).toBe('Закрыть поиск')
    expect(trigger.attributes('aria-controls')).toBe('cabinet-search-slot')
    expect(wrapper.find('#cabinet-search-slot').exists()).toBe(true)
  })

  it('closes with the cross button and returns focus to the icon', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
    await wrapper.get('.vt-cabinet-search-toggle__close').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.vt-cabinet-search-toggle__trigger').element)
  })

  it('closes on Esc and returns focus to the icon', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.vt-cabinet-search-toggle__trigger').element)
  })

  it('closes on a click outside but not on a click inside', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
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
    await wrapper.get('.vt-cabinet-search-toggle__close').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
  })

  it('collapses after following a result link', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
    await wrapper.get('a').trigger('click')
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('stops listening to the keyboard after unmount', async () => {
    const wrapper = mountToggle()
    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(document.querySelector('[role="search"]')).toBeNull()
  })

  it('ignores Ctrl+K typed into another editable field', async () => {
    const wrapper = mountToggle()
    const other = document.createElement('textarea')
    document.body.append(other)
    other.focus()
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })
})

describe('two-stage Esc (20.5.3)', () => {
  it('first Esc closes the results, second Esc collapses the search', async () => {
    const resultsSearch = {
      data: () => ({ open: true }),
      template:
        '<div role="search" @keydown.esc="open = false"><input type="search" /><div v-if="open" id="cabinet-search-panel">Результаты</div></div>',
    }
    const wrapper = mount(CabinetSearchToggle, {
      props: { orgId: 3, timeZone: 'Europe/Minsk' },
      global: { stubs: { VtIcon: { template: '<svg />' }, CabinetSearch: resultsSearch } },
      attachTo: document.body,
    })
    await wrapper.get('.vt-cabinet-search-toggle__trigger').trigger('click')
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(true)

    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('#cabinet-search-panel').exists()).toBe(false)
    expect(wrapper.find('input').exists()).toBe(true)

    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.vt-cabinet-search-toggle__trigger').element)
  })
})
