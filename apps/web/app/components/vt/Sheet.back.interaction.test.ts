// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { closeTopBackOverlay, overlayCount } from '../../utils/miniapp-back'

import Sheet from './Sheet.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Sheet and the system Back button (20.4.1)', () => {
  it('registers while open so Back closes the sheet before leaving the screen', async () => {
    const open = ref(true)
    const wrapper = mount(Sheet, {
      props: { modelValue: open.value, 'onUpdate:modelValue': (v: boolean) => (open.value = v) },
      attachTo: document.body,
    })
    await nextTick()
    expect(overlayCount()).toBe(1)

    expect(closeTopBackOverlay()).toBe(true)
    expect(open.value).toBe(false)
    await wrapper.setProps({ modelValue: false })
    expect(overlayCount()).toBe(0)
    expect(closeTopBackOverlay()).toBe(false)
  })

  it('does not register while closed and unregisters on unmount', async () => {
    const wrapper = mount(Sheet, { props: { modelValue: false }, attachTo: document.body })
    expect(overlayCount()).toBe(0)
    await wrapper.setProps({ modelValue: true })
    expect(overlayCount()).toBe(1)
    wrapper.unmount()
    expect(overlayCount()).toBe(0)
  })
})
