// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Segment from './Segment.vue'
import Select from './Select.vue'
import Toggle from './Toggle.vue'

const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('readonly prop of v3 atoms (20.5.7)', () => {
  it('VtToggle stays focusable and announced as disabled, and ignores clicks', async () => {
    const wrapper = mount(Toggle, {
      props: { readonly: true, modelValue: false, label: 'Абонементы' },
      attachTo: document.body,
    })
    const el = wrapper.get('button')
    expect(el.attributes('aria-disabled')).toBe('true')
    expect(el.attributes('disabled')).toBeUndefined()
    el.element.focus()
    expect(document.activeElement).toBe(el.element)
    await el.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('VtSegment ignores clicks and arrow keys but keeps the checked item tabbable', async () => {
    const wrapper = mount(Segment, {
      props: {
        readonly: true,
        modelValue: 'a',
        label: 'Режим',
        options: [
          { value: 'a', label: 'А' },
          { value: 'b', label: 'Б' },
        ],
      },
      attachTo: document.body,
    })
    const items = wrapper.findAll('[role="radio"]')
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-readonly')).toBe('true')
    expect(items.every((i) => i.attributes('aria-disabled') === 'true')).toBe(true)
    expect(items.every((i) => i.attributes('disabled') === undefined)).toBe(true)
    expect(items[0]!.attributes('tabindex')).toBe('0')
    ;(items[0]!.element as HTMLElement).focus()
    expect(document.activeElement).toBe(items[0]!.element)
    await items[1]!.trigger('click')
    key(items[0]!.element, 'ArrowRight')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('VtSelect does not open by click or keys and stays focusable', async () => {
    const wrapper = mount(Select, {
      props: {
        readonly: true,
        modelValue: 'v1',
        label: 'Зал',
        options: [
          { value: 'v1', label: 'Школа' },
          { value: 'v2', label: 'Арена' },
        ],
      },
      attachTo: document.body,
    })
    const button = wrapper.get('[role="combobox"]')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    ;(button.element as HTMLElement).focus()
    expect(document.activeElement).toBe(button.element)
    await button.trigger('click')
    key(button.element, 'ArrowDown')
    key(button.element, 'Enter')
    key(button.element, 'а')
    await nextTick()
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
