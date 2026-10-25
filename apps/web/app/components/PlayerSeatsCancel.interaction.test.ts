// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlayerSeatsCancel from './PlayerSeatsCancel.vue'

const render = (total: number, disabled = false) =>
  mount(PlayerSeatsCancel, { props: { total, disabled } })
const less = (w: ReturnType<typeof render>) => w.find('button[aria-label="Снять меньше мест"]')
const more = (w: ReturnType<typeof render>) => w.find('button[aria-label="Снять больше мест"]')
const live = (w: ReturnType<typeof render>) => w.find('[aria-live="polite"]').text()

describe('PlayerSeatsCancel (20.4.8)', () => {
  it('renders nothing for a single-seat booking', () => {
    expect(render(1).find('[role="group"]').exists()).toBe(false)
  })

  it('starts at one seat: «less» disabled, announced text and button name match', () => {
    const w = render(4)
    expect(less(w).attributes('disabled')).toBeDefined()
    expect(more(w).attributes('disabled')).toBeUndefined()
    expect(live(w)).toBe('1 место')
    expect(w.text()).toContain('Снять 1 место')
  })

  it('stops at total minus one: «more» disabled at the upper limit, live text follows', async () => {
    const w = render(3)
    await more(w).trigger('click')
    expect(live(w)).toBe('2 места')
    expect(more(w).attributes('disabled')).toBeDefined()
    await more(w).trigger('click')
    expect(live(w)).toBe('2 места')
    expect(less(w).attributes('disabled')).toBeUndefined()
  })

  it('cannot go below one seat', async () => {
    const w = render(3)
    await less(w).trigger('click')
    expect(live(w)).toBe('1 место')
  })

  it('with two seats the only option is one: both steps are disabled', () => {
    const w = render(2)
    expect(less(w).attributes('disabled')).toBeDefined()
    expect(more(w).attributes('disabled')).toBeDefined()
  })

  it('emits how many seats stay and resets the choice when the total changes', async () => {
    const w = render(4)
    await more(w).trigger('click')
    await w.findAll('button').at(-1)!.trigger('click')
    expect(w.emitted('reduce')).toEqual([[2]])
    await w.setProps({ total: 3 })
    expect(live(w)).toBe('1 место')
  })

  it('disables every control while a request is running', () => {
    const w = render(4, true)
    for (const b of w.findAll('button')) expect(b.attributes('disabled')).toBeDefined()
  })
})
