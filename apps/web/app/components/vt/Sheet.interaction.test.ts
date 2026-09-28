// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import Sheet from './Sheet.vue'

function renderSheet() {
  let submitted = 0
  const host = defineComponent({
    setup() {
      const open = ref(false)
      return () =>
        h('div', [
          h('button', { id: 'trigger', onClick: () => (open.value = true) }, 'Open'),
          h(
            Sheet,
            {
              id: 'test-sheet',
              title: 'New expense',
              modelValue: open.value,
              'onUpdate:modelValue': (value: boolean) => (open.value = value),
            },
            {
              default: () =>
                h(
                  'form',
                  {
                    onSubmit: (event: Event) => {
                      event.preventDefault()
                      submitted++
                    },
                  },
                  [
                    h('input', { id: 'amount', 'aria-label': 'Amount' }),
                    h('button', { id: 'save', type: 'submit' }, 'Save'),
                  ],
                ),
            },
          ),
        ])
    },
  })
  const wrapper = mount(host, { attachTo: document.body })
  return {
    wrapper,
    get submitted() {
      return submitted
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('VtSheet keyboard interaction', () => {
  it('focuses the first panel control and cycles Tab within the dialog', async () => {
    const fixture = renderSheet()
    const trigger = document.querySelector<HTMLButtonElement>('#trigger')!
    trigger.focus()
    trigger.click()
    await nextTick()
    await nextTick()

    const dialog = document.querySelector<HTMLElement>('#test-sheet')!
    const input = document.querySelector<HTMLInputElement>('#amount')!
    const save = document.querySelector<HTMLButtonElement>('#save')!
    expect(dialog.getAttribute('aria-labelledby')).toBe('test-sheet-title')
    expect(document.activeElement).toBe(input)

    save.focus()
    save.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(input)

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(save)
    fixture.wrapper.unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const fixture = renderSheet()
    const trigger = document.querySelector<HTMLButtonElement>('#trigger')!
    trigger.focus()
    trigger.click()
    await nextTick()
    await nextTick()

    document
      .querySelector<HTMLInputElement>('#amount')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
    await nextTick()
    await nextTick()
    expect(document.querySelector('#test-sheet')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    fixture.wrapper.unmount()
  })

  it('closes from the backdrop without submitting the form', async () => {
    const fixture = renderSheet()
    const trigger = document.querySelector<HTMLButtonElement>('#trigger')!
    trigger.focus()
    trigger.click()
    await nextTick()
    await nextTick()

    document.querySelector<HTMLButtonElement>('#test-sheet > button')!.click()
    await nextTick()
    await nextTick()
    expect(document.querySelector('#test-sheet')).toBeNull()
    expect(fixture.submitted).toBe(0)
    expect(document.activeElement).toBe(trigger)
    fixture.wrapper.unmount()
  })

  it('restores background interactivity when unmounted while open', async () => {
    const fixture = renderSheet()
    document.querySelector<HTMLButtonElement>('#trigger')!.click()
    await nextTick()
    await nextTick()

    const appRoot = fixture.wrapper.element.parentElement as HTMLElement
    expect(appRoot.inert).toBe(true)
    fixture.wrapper.unmount()
    expect(appRoot.inert).toBe(false)
  })
})
