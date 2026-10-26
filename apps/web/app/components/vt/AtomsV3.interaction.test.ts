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

  it('renders a separator before an item and a hint under a disabled one that stays focusable (20.5.8)', async () => {
    const wrapper = mount(Popover, {
      props: {
        modelValue: true,
        label: 'Действия',
        items: [
          { key: 'open', label: 'Открыть' },
          { key: 'chat', label: 'В чат группы', disabled: true, hint: 'Чат не привязан' },
          { key: 'cancel', label: 'Отменить', tone: 'danger', separator: true },
        ],
      },
      attachTo: document.body,
    })
    await flush()
    const menu = document.querySelector('[role="menu"]')!
    expect([...menu.children].map((c) => c.getAttribute('role'))).toEqual([
      'menuitem',
      'menuitem',
      'separator',
      'menuitem',
    ])
    const chat = menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!
    expect(chat.getAttribute('aria-disabled')).toBe('true')
    expect(chat.disabled).toBe(false)
    expect(chat.textContent).toContain('Чат не привязан')
    const [open, , cancel] = menu.querySelectorAll<HTMLElement>('[role="menuitem"]')
    open!.focus()
    key(open!, 'ArrowDown')
    // недоступный пункт доступен с клавиатуры: подсказка читается скринридером
    expect(document.activeElement).toBe(chat)
    key(chat, 'ArrowDown')
    expect(document.activeElement).toBe(cancel)
    wrapper.unmount()
  })

  it('an aria-disabled item is not selectable and keeps the menu open (20.5.8)', async () => {
    const selected: string[] = []
    const open = ref(true)
    const wrapper = mount(Popover, {
      props: {
        modelValue: true,
        'onUpdate:modelValue': (v: boolean) => (open.value = v),
        items: [{ key: 'chat', label: 'В чат группы', disabled: true }],
        onSelect: (i: { key: string }) => selected.push(i.key),
      },
      attachTo: document.body,
    })
    await flush()
    const chat = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!
    chat.click()
    await flush()
    expect(selected).toEqual([])
    expect(open.value).toBe(true)
    wrapper.unmount()
  })

  it('fixed menu is placed from the trigger and closes when the page scrolls or resizes (20.5.8)', async () => {
    const open = ref(false)
    const host = defineComponent({
      setup: () => () =>
        h(
          Popover,
          {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            items: [{ key: 'a', label: 'A' }],
            fixed: true,
          },
          { trigger: ({ attrs }: { attrs: Record<string, unknown> }) => h('button', attrs, 'Ещё') },
        ),
    })
    const wrapper = mount(host, { attachTo: document.body })
    open.value = true
    await flush()
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu.classList.contains('vt-popover--fixed')).toBe(true)
    expect(menu.style.top).toMatch(/px$/)
    expect(menu.style.right).toMatch(/px$/)
    // прокрутка внутри самого меню его не закрывает
    menu.dispatchEvent(new Event('scroll'))
    expect(open.value).toBe(true)
    window.dispatchEvent(new Event('resize'))
    await flush()
    expect(open.value).toBe(false)
    wrapper.unmount()
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
    mount(Toast, { attachTo: document.body })
    await nextTick()
    const host = document.querySelector('[role="status"]')!
    expect(host.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelector('.vt-toast')).toBeNull()

    useToast().show('Ссылка скопирована')
    await nextTick()
    expect(document.querySelector('.vt-toast')!.textContent!.trim()).toBe('Ссылка скопирована')

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
    await nextTick()
    expect(document.querySelector('.vt-toast')).not.toBeNull()
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(document.querySelector('.vt-toast')).toBeNull()
  })

  it('a new toast replaces the previous one and restarts the timer; danger tone styles it', async () => {
    mount(Toast, { attachTo: document.body })
    const { show } = useToast()
    show('Первый')
    vi.advanceTimersByTime(2000)
    show('Ошибка', 'danger')
    await nextTick()
    expect(document.querySelector('.vt-toast')!.textContent!.trim()).toBe('Ошибка')
    expect([...document.querySelector('.vt-toast')!.classList]).toContain('vt-toast--danger')
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(document.querySelector('.vt-toast')).not.toBeNull()
    vi.advanceTimersByTime(400)
    await nextTick()
    expect(document.querySelector('.vt-toast')).toBeNull()
  })
})

describe('review fixes (round 1)', () => {
  it('Alert: Escape and the Tab trap still work after focus leaves to the body', async () => {
    const open = ref(false)
    const host = defineComponent({
      setup: () => () =>
        h('div', [
          h('button', { id: 'trg', onClick: () => (open.value = true) }, 'Открыть'),
          h(Alert, {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            title: 'Удалить?',
            body: 'Текст пояснения',
            confirmLabel: 'Удалить',
          }),
        ]),
    })
    mount(host, { attachTo: document.body })
    const trigger = document.querySelector<HTMLButtonElement>('#trg')!
    trigger.focus()
    trigger.click()
    await flush()
    const panel = document.querySelector<HTMLElement>('.vt-alert')!
    expect(panel.getAttribute('tabindex')).toBe('-1')

    // клик по тексту: фокус уходит с кнопки, панель забирает его обратно
    ;(document.activeElement as HTMLElement).blur()
    await flush()
    expect(document.activeElement).toBe(panel)

    const [cancel, ok] = [...document.querySelectorAll<HTMLButtonElement>('.vt-alert button')]
    key(panel, 'Tab')
    expect(document.activeElement).toBe(cancel)
    panel.focus()
    key(panel, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(ok)

    ;(document.activeElement as HTMLElement).blur()
    await flush()
    key(document.activeElement!, 'Escape')
    await flush()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('Alert keeps the toast live region out of the inert set', async () => {
    const wrapper = mount(Toast, { attachTo: document.body })
    await flush()
    const hostEl = document.querySelector<HTMLElement>('[data-vt-toast-host]')!
    expect(hostEl.parentElement).toBe(document.body)
    const open = ref(true)
    mount(
      defineComponent({
        setup: () => () =>
          h(Alert, {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            title: 'Тест',
            confirmLabel: 'ОК',
          }),
      }),
      { attachTo: document.body },
    )
    await flush()
    expect(hostEl.inert).toBe(false)
    wrapper.unmount()
  })

  it('Select and Toggle take an accessible name from aria-labelledby', () => {
    const select = mount(Select, {
      props: { modelValue: 'v1', options: venues, labelledby: 'lbl' },
      attachTo: document.body,
    })
    const button = select.get('button')
    expect(button.attributes('aria-labelledby')).toBe('lbl')
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(select.get('[role="listbox"]').attributes('aria-labelledby')).toBe('lbl')
    const toggle = mount(Toggle, { props: { modelValue: false, labelledby: 'lbl2' } })
    expect(toggle.get('button').attributes('aria-labelledby')).toBe('lbl2')
    expect(toggle.get('button').attributes('aria-label')).toBeUndefined()
  })

  it('Select scrolls the active option into view for keyboard navigation only', async () => {
    const scroll = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      const wrapper = mount(Select, {
        props: { modelValue: 'v1', options: venues, label: 'Зал' },
        attachTo: document.body,
      })
      const button = wrapper.get('button').element
      button.click()
      await flush()
      const options = [...document.querySelectorAll('[role="option"]')]
      options[3]!.dispatchEvent(new MouseEvent('mouseenter'))
      await flush()
      expect(scroll).not.toHaveBeenCalled()
      key(button, 'ArrowUp')
      await flush()
      expect(scroll).toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('Select and Popover remove their document listeners on unmount', () => {
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    const select = mount(Select, {
      props: { modelValue: 'v1', options: venues, label: 'Зал' },
      attachTo: document.body,
    })
    const popover = mount(Popover, {
      props: { items: [{ key: 'a', label: 'A' }], modelValue: false },
      attachTo: document.body,
    })
    const handlers = added.mock.calls.filter(([type]) => type === 'mousedown').map(([, fn]) => fn)
    expect(handlers).toHaveLength(2)
    select.unmount()
    popover.unmount()
    const removedHandlers = removed.mock.calls
      .filter(([type]) => type === 'mousedown')
      .map(([, fn]) => fn)
    for (const fn of handlers) expect(removedHandlers).toContain(fn)
    added.mockRestore()
    removed.mockRestore()
  })

  it('Popover: aria-controls only while open; Tab closes without stealing focus', async () => {
    const open = ref(false)
    mount(
      defineComponent({
        setup: () => () =>
          h(
            Popover,
            {
              modelValue: open.value,
              'onUpdate:modelValue': (v: boolean) => (open.value = v),
              items: [
                { key: 'a', label: 'A' },
                { key: 'b', label: 'B' },
              ],
            },
            {
              trigger: ({
                toggle,
                attrs,
              }: {
                toggle: () => void
                attrs: Record<string, unknown>
              }) => h('button', { id: 'trg', ...attrs, onClick: toggle }, 'Ещё'),
            },
          ),
      }),
      { attachTo: document.body },
    )
    const trigger = document.querySelector<HTMLButtonElement>('#trg')!
    expect(trigger.hasAttribute('aria-controls')).toBe(false)
    trigger.click()
    await flush()
    expect(trigger.getAttribute('aria-controls')).toBe(document.querySelector('[role="menu"]')!.id)
    const first = document.querySelector<HTMLElement>('[role="menuitem"]')!
    expect(document.activeElement).toBe(first)
    key(first, 'Tab')
    await flush()
    expect(open.value).toBe(false)
    expect(document.activeElement).not.toBe(trigger)
    expect(trigger.hasAttribute('aria-controls')).toBe(false)
  })

  it('useToast is a no-op without a window (SSR) so state cannot leak between requests', () => {
    vi.stubGlobal('window', undefined)
    try {
      useToast().show('server')
      expect(useToast().current.value).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
