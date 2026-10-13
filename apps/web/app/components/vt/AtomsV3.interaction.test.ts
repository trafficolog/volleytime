// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import Alert from './Alert.vue'
import Popover from './Popover.vue'
import Segment from './Segment.vue'
import Select from './Select.vue'
import Toast from './Toast.vue'
import Toggle from './Toggle.vue'

import { TOAST_DURATION_MS, useToast } from '~/composables/useToast'

const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }),
  )
const flush = async () => {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

const venues = [
  { value: 'v1', label: 'Школа №24', sub: '15 Br/ч' },
  { value: 'v2', label: 'СК Заслонова' },
  { value: 'v3', label: 'Школа №3', disabled: true },
  { value: 'v4', label: 'Арена' },
]

describe('VtSelect', () => {
  function setup(initial = 'v1') {
    const value = ref(initial)
    const host = defineComponent({
      setup: () => () =>
        h(Select, {
          label: 'Зал',
          options: venues,
          modelValue: value.value,
          'onUpdate:modelValue': (v: string) => (value.value = v),
        }),
    })
    const wrapper = mount(host, { attachTo: document.body })
    const button = wrapper.get('button').element as HTMLButtonElement
    return { wrapper, button, value }
  }

  it('exposes combobox/listbox semantics and the selected option', () => {
    const { button } = setup('v2')
    expect(button.getAttribute('role')).toBe('combobox')
    expect(button.getAttribute('aria-haspopup')).toBe('listbox')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.textContent).toContain('СК Заслонова')
    const list = document.querySelector('[role="listbox"]')!
    expect(button.getAttribute('aria-controls')).toBe(list.id)
    const selected = [...document.querySelectorAll('[role="option"]')].filter(
      (o) => o.getAttribute('aria-selected') === 'true',
    )
    expect(selected).toHaveLength(1)
  })

  it('opens with ArrowDown, moves aria-activedescendant skipping disabled, selects with Enter', async () => {
    const { button, value } = setup('v1')
    key(button, 'ArrowDown')
    await flush()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const options = [...document.querySelectorAll('[role="option"]')]
    expect(button.getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    key(button, 'ArrowDown')
    await flush()
    expect(button.getAttribute('aria-activedescendant')).toBe(options[1]!.id)
    key(button, 'ArrowDown')
    await flush()
    expect(button.getAttribute('aria-activedescendant')).toBe(options[3]!.id)
    key(button, 'Home')
    await flush()
    expect(button.getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    key(button, 'End')
    await flush()
    expect(button.getAttribute('aria-activedescendant')).toBe(options[3]!.id)
    key(button, 'Enter')
    await flush()
    expect(value.value).toBe('v4')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('closes on Escape without changing the value', async () => {
    const { button, value } = setup('v1')
    button.focus()
    key(button, 'Enter')
    await flush()
    key(button, 'ArrowDown')
    key(button, 'Escape')
    await flush()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(value.value).toBe('v1')
    expect(document.activeElement).toBe(button)
  })

  it('supports typeahead while open', async () => {
    const { button, value } = setup('v1')
    key(button, 'Enter')
    await flush()
    key(button, 'А')
    key(button, 'Enter')
    await flush()
    expect(value.value).toBe('v4')
  })

  it('selects by click and closes on outside mousedown', async () => {
    const { button, value } = setup('v1')
    button.click()
    await flush()
    ;(document.querySelectorAll('[role="option"]')[1] as HTMLElement).click()
    await flush()
    expect(value.value).toBe('v2')
    button.click()
    await flush()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('ignores clicks on disabled options', async () => {
    const { button, value } = setup('v1')
    button.click()
    await flush()
    ;(document.querySelectorAll('[role="option"]')[2] as HTMLElement).click()
    await flush()
    expect(value.value).toBe('v1')
  })
})

describe('VtToggle', () => {
  it('is a switch that toggles on click and Space/Enter-click, with a 44px hit area style hook', async () => {
    const wrapper = mount(Toggle, {
      props: {
        label: 'Разрешить отмену',
        modelValue: false,
        'onUpdate:modelValue': (v: boolean) => wrapper.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    const el = wrapper.get('button')
    expect(el.attributes('role')).toBe('switch')
    expect(el.attributes('aria-checked')).toBe('false')
    expect(el.attributes('aria-label')).toBe('Разрешить отмену')
    expect(el.classes()).toContain('vt-toggle')
    await el.trigger('click')
    expect(el.attributes('aria-checked')).toBe('true')
    await el.trigger('click')
    expect(el.attributes('aria-checked')).toBe('false')
  })

  it('does not toggle when disabled', async () => {
    const wrapper = mount(Toggle, { props: { disabled: true, modelValue: false } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('VtSegment', () => {
  function setup(variant: 'segment' | 'chips' = 'segment') {
    const value = ref('solo')
    const host = defineComponent({
      setup: () => () =>
        h(Segment, {
          label: 'Разминка',
          variant,
          options: [
            { value: 'solo', label: 'Своя' },
            { value: 'x', label: 'Недоступно', disabled: true },
            { value: 'game', label: 'В составе' },
          ],
          modelValue: value.value,
          'onUpdate:modelValue': (v: string) => (value.value = v),
        }),
    })
    const wrapper = mount(host, { attachTo: document.body })
    const items = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    return { wrapper, items, value }
  }

  it('is a radiogroup with roving tabindex', () => {
    const { items } = setup()
    expect(document.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe(
      'Разминка',
    )
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(items.map((i) => i.tabIndex)).toEqual([0, -1, -1])
  })

  it('arrow keys select and focus the next enabled item, wrapping around', async () => {
    const { items, value } = setup()
    items[0]!.focus()
    key(items[0]!, 'ArrowRight')
    await flush()
    expect(value.value).toBe('game')
    expect(document.activeElement).toBe(items[2])
    key(items[2]!, 'ArrowRight')
    await flush()
    expect(value.value).toBe('solo')
    key(items[0]!, 'End')
    await flush()
    expect(value.value).toBe('game')
    key(items[2]!, 'Home')
    await flush()
    expect(value.value).toBe('solo')
  })

  it('click selects; chips variant keeps the same semantics', async () => {
    const { items, value } = setup('chips')
    expect(document.querySelector('.vt-seg--chips')).not.toBeNull()
    items[2]!.click()
    await flush()
    expect(value.value).toBe('game')
  })
})

describe('VtPopover', () => {
  function setup() {
    const selected: string[] = []
    const open = ref(false)
    const host = defineComponent({
      setup: () => () =>
        h(
          Popover,
          {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            label: 'Действия',
            items: [
              { key: 'edit', label: 'Редактировать' },
              { key: 'copy', label: 'Копировать' },
              { key: 'del', label: 'Удалить', tone: 'danger' },
            ],
            onSelect: (i: { key: string }) => selected.push(i.key),
          },
          {
            trigger: ({ toggle, attrs }: { toggle: () => void; attrs: Record<string, unknown> }) =>
              h('button', { id: 'trg', ...attrs, onClick: toggle }, 'Ещё'),
          },
        ),
    })
    const wrapper = mount(host, { attachTo: document.body })
    return { wrapper, open, selected, trigger: document.querySelector<HTMLButtonElement>('#trg')! }
  }

  it('opens as a menu, focuses the first item and wires aria on the trigger', async () => {
    const { trigger } = setup()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    await flush()
    const menu = document.querySelector('[role="menu"]')!
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id)
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items).toHaveLength(3)
    expect(document.activeElement).toBe(items[0])
    expect(items[2]!.classList.contains('vt-popover__item--danger')).toBe(true)
  })

  it('navigates with arrows, activates an item, closes and returns focus', async () => {
    const { trigger, selected, open } = setup()
    trigger.click()
    await flush()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    key(items[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(items[1])
    key(items[1]!, 'End')
    expect(document.activeElement).toBe(items[2])
    key(items[2]!, 'ArrowDown')
    expect(document.activeElement).toBe(items[0])
    items[1]!.click()
    await flush()
    expect(selected).toEqual(['copy'])
    expect(open.value).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on Escape (focus back to trigger) and on outside click (focus untouched)', async () => {
    const { trigger, open } = setup()
    trigger.click()
    await flush()
    key(document.querySelector('[role="menuitem"]')!, 'Escape')
    await flush()
    expect(open.value).toBe(false)
    expect(document.activeElement).toBe(trigger)

    trigger.click()
    await flush()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(open.value).toBe(false)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
})

describe('VtAlert', () => {
  function setup(danger = true) {
    const open = ref(false)
    let confirmed = 0
    const host = defineComponent({
      setup: () => () =>
        h('div', [
          h('button', { id: 'trg', onClick: () => (open.value = true) }, 'Отменить'),
          h(Alert, {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            title: 'Отменить запись?',
            body: 'Место уйдёт первому из листа ожидания.',
            confirmLabel: 'Отменить запись',
            cancelLabel: 'Оставить',
            danger,
            onConfirm: () => confirmed++,
          }),
        ]),
    })
    const wrapper = mount(host, { attachTo: document.body })
    return {
      wrapper,
      open,
      trigger: document.querySelector<HTMLButtonElement>('#trg')!,
      get confirmed() {
        return confirmed
      },
    }
  }

  it('is an alertdialog labelled by title and described by body, focusing the safe action', async () => {
    const f = setup()
    f.trigger.focus()
    f.trigger.click()
    await flush()
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Отменить запись?',
    )
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby')!)!.textContent,
    ).toContain('листа ожидания')
    expect(document.activeElement!.textContent!.trim()).toBe('Оставить')
    expect(document.querySelector('.vt-btn--rose')).not.toBeNull()
  })

  it('traps Tab, closes on Escape and restores focus', async () => {
    const f = setup()
    f.trigger.focus()
    f.trigger.click()
    await flush()
    const [cancel, ok] = [...document.querySelectorAll<HTMLButtonElement>('.vt-alert button')]
    ok!.focus()
    key(ok!, 'Tab')
    expect(document.activeElement).toBe(cancel)
    key(cancel!, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(ok)
    key(ok!, 'Escape')
    await flush()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.activeElement).toBe(f.trigger)
  })

  it('emits confirm and closes; scrim click only cancels', async () => {
    const f = setup(false)
    f.trigger.click()
    await flush()
    document.querySelector<HTMLElement>('.vt-alert-scrim')!.click()
    await flush()
    expect(f.confirmed).toBe(0)
    expect(f.open.value).toBe(false)
    f.trigger.click()
    await flush()
    document.querySelectorAll<HTMLButtonElement>('.vt-alert button')[1]!.click()
    await flush()
    expect(f.confirmed).toBe(1)
    expect(f.open.value).toBe(false)
  })

  it('makes the background inert while open and restores it after unmount', async () => {
    const f = setup()
    f.trigger.click()
    await flush()
    const root = f.wrapper.element.parentElement as HTMLElement
    expect(root.inert).toBe(true)
    f.wrapper.unmount()
    expect(root.inert).toBe(false)
  })
})

describe('useToast + VtToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    useToast().dismiss()
    vi.useRealTimers()
  })

  it('renders an always-present polite live region and hides the toast after 2.4 s', async () => {
    const wrapper = mount(Toast, { attachTo: document.body })
    const host = wrapper.get('[role="status"]')
    expect(host.attributes('aria-live')).toBe('polite')
    expect(wrapper.find('.vt-toast').exists()).toBe(false)

    useToast().show('Ссылка скопирована')
    await nextTick()
    expect(wrapper.get('.vt-toast').text()).toBe('Ссылка скопирована')

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
    await nextTick()
    expect(wrapper.find('.vt-toast').exists()).toBe(true)
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(wrapper.find('.vt-toast').exists()).toBe(false)
  })

  it('a new toast replaces the previous one and restarts the timer; danger tone styles it', async () => {
    const wrapper = mount(Toast, { attachTo: document.body })
    const { show } = useToast()
    show('Первый')
    vi.advanceTimersByTime(2000)
    show('Ошибка', 'danger')
    await nextTick()
    expect(wrapper.get('.vt-toast').text()).toBe('Ошибка')
    expect(wrapper.get('.vt-toast').classes()).toContain('vt-toast--danger')
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(wrapper.find('.vt-toast').exists()).toBe(true)
    vi.advanceTimersByTime(400)
    await nextTick()
    expect(wrapper.find('.vt-toast').exists()).toBe(false)
  })
})
