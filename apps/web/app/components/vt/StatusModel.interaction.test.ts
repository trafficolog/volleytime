// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import Icon from './Icon.vue'
import MyChip from './MyChip.vue'
import SeatsMini from './SeatsMini.vue'
import StateChip from './StateChip.vue'

vi.stubGlobal('computed', computed)
const global = { components: { VtIcon: Icon } }
const NOW = new Date('2026-10-13T12:00:00.000Z')
const future = { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-20T18:00:00.000Z' }

describe('MyChip', () => {
  it('renders a blue «Иду» for a confirmed or unpaid booking', () => {
    for (const status of ['confirmed', 'pending_payment']) {
      const w = mount(MyChip, { props: { booking: { status } }, global })
      expect(w.text()).toBe('Иду')
      expect(w.classes()).toContain('vt-chip--mine')
      expect(w.find('svg').exists()).toBe(true)
    }
  })

  it('renders the queue chip with position', () => {
    const w = mount(MyChip, { props: { booking: { status: 'waitlisted', waitPos: 2 } }, global })
    expect(w.text()).toBe('В очереди · 2-й')
    expect(w.classes()).toContain('vt-chip--queue')
  })

  it('renders nothing without a live booking', () => {
    expect(
      mount(MyChip, { props: { booking: null }, global })
        .find('.vt-chip')
        .exists(),
    ).toBe(false)
    expect(
      mount(MyChip, { props: { booking: { status: 'cancelled' } }, global })
        .find('.vt-chip')
        .exists(),
    ).toBe(false)
  })

  it('switches to the hero variant on dark surfaces', () => {
    const w = mount(MyChip, { props: { booking: { status: 'confirmed' }, onDark: true }, global })
    expect(w.classes()).toContain('vt-chip--on-hero')
  })
})

describe('StateChip', () => {
  it('shows a neutral word for closed, past and cancelled events', () => {
    const closed = mount(StateChip, { props: { event: { status: 'closed', ...future }, now: NOW } })
    expect(closed.text()).toBe('Запись закрыта')
    expect(closed.classes()).toContain('vt-chip--state')
    expect(
      mount(StateChip, { props: { event: { status: 'finished', ...future }, now: NOW } }).text(),
    ).toBe('Прошла')
    expect(
      mount(StateChip, { props: { event: { status: 'cancelled', ...future }, now: NOW } }).text(),
    ).toBe('Отменена')
  })

  it('renders nothing for an open event', () => {
    const w = mount(StateChip, { props: { event: { status: 'published', ...future }, now: NOW } })
    expect(w.find('.vt-chip').exists()).toBe(false)
  })
})

describe('SeatsMini', () => {
  it('shows number and a tinted meter for an open event', () => {
    const w = mount(SeatsMini, { props: { taken: 14, capacity: 16 } })
    expect(w.text()).toBe('14/16')
    expect(w.get('[role="meter"]').attributes('aria-label')).toBe('Занято 14 из 16')
    expect(w.get('i').attributes('style')).toContain('var(--vt-amber)')
  })

  it('says «мест нет» in rose when full', () => {
    const w = mount(SeatsMini, { props: { taken: 16, capacity: 16 } })
    expect(w.text()).toBe('мест нет')
    expect(w.get('i').attributes('style')).toContain('var(--vt-rose)')
  })

  it('goes grey and keeps the numbers once the event has a state', () => {
    const w = mount(SeatsMini, {
      props: { taken: 16, capacity: 16, event: { status: 'closed', ...future }, now: NOW },
    })
    expect(w.text()).toBe('16/16')
    expect(w.get('i').attributes('style')).toContain('var(--vt-stroke-2)')
  })

  it('uses hero tones on dark surfaces', () => {
    const w = mount(SeatsMini, { props: { taken: 2, capacity: 16, onDark: true } })
    expect(w.get('i').attributes('style')).toContain('var(--vt-meter-ok-on-hero)')
  })
})
