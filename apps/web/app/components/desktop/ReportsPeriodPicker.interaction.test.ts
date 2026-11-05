// @vitest-environment happy-dom
import { reportPeriodPresets } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ReportsPeriodPicker from './ReportsPeriodPicker.vue'

const presets = reportPeriodPresets(new Date('2026-05-20T10:00:00Z'), 'Europe/Minsk')

describe('reports period picker (21.2.7, W-10)', () => {
  it('marks the matching preset and selects another one', async () => {
    const wrapper = mount(ReportsPeriodPicker, {
      props: { presets, dates: { from: presets[0]!.from, to: presets[0]!.to } },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Май 2026', 'Апрель 2026', 'Q2 2026', 'Год'])
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false')

    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[{ from: '2026-04-01', to: '2026-04-30' }]])
  })

  it('applies a custom range only when it is valid and flags a broken one', async () => {
    const wrapper = mount(ReportsPeriodPicker, {
      props: { presets, dates: { from: '2026-05-01', to: '2026-05-31' } },
    })
    const [from, to] = wrapper.findAll('input')
    await from!.setValue('2026-05-10')
    await from!.trigger('change')
    await to!.setValue('2026-05-20')
    await to!.trigger('change')
    expect(wrapper.emitted('select')?.at(-1)).toEqual([{ from: '2026-05-10', to: '2026-05-20' }])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    const before = wrapper.emitted('select')!.length
    await to!.setValue('2026-05-01')
    await to!.trigger('change')
    expect(wrapper.emitted('select')).toHaveLength(before)
    expect(wrapper.get('[role="alert"]').text()).toContain('Начало периода не позже конца')
    expect(to!.attributes('aria-invalid')).toBe('true')
  })
})
