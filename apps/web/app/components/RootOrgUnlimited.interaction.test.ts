// @vitest-environment happy-dom
import { addIsoDays, minskToday } from '@volley-time/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import RootOrgUnlimited from './RootOrgUnlimited.vue'

const apiFetch = vi.fn()
const toastShow = vi.fn()
let wrapper: VueWrapper | undefined

beforeEach(() => {
  apiFetch.mockReset().mockResolvedValue({ until: null, active: false })
  toastShow.mockReset()
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

function render(props: { unlimited: { until: string } | null; disabled?: boolean }) {
  wrapper = mount(RootOrgUnlimited, {
    props: { orgId: 7, ...props },
    attachTo: document.body,
  })
  return wrapper
}

const button = (w: VueWrapper, text: string) =>
  w.findAll('button').find((b) => b.text().trim() === text)
const url = '/api/platform/organizations/7/event-balance/unlimited'

describe('Root organization «Безлимит событий» (22.3.1)', () => {
  it('without unlimited offers only «Включить до…» and says that publications charge', () => {
    const w = render({ unlimited: null })
    expect(w.get('[data-testid="unlimited-state"]').text()).toContain('списывает по одному')
    expect(button(w, 'Включить до…')).toBeDefined()
    expect(button(w, 'Отключить')).toBeUndefined()
  })

  it('with unlimited shows the last day and offers change and cancel', () => {
    const w = render({ unlimited: { until: '2026-12-31' } })
    expect(w.get('[data-testid="unlimited-state"]').text()).toContain('31.12.2026')
    expect(button(w, 'Продлить / изменить дату')).toBeDefined()
    expect(button(w, 'Отключить')).toBeDefined()
  })

  it('requires a reason of 3+ characters and a date within the allowed range', async () => {
    const w = render({ unlimited: null })
    await button(w, 'Включить до…')!.trigger('click')
    await w.get('input[name="until"]').setValue(addIsoDays(minskToday(), -1))
    await w.get('textarea[name="reason"]').setValue('ab')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Дата — от сегодняшней')
    expect(w.text()).toContain('Причина: от 3 до 500 символов')
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('sets the date with a reason via PUT and tells the parent to reload', async () => {
    const w = render({ unlimited: null })
    const until = addIsoDays(minskToday(), 10)
    await button(w, 'Включить до…')!.trigger('click')
    await w.get('input[name="until"]').setValue(until)
    await w.get('textarea[name="reason"]').setValue('  Пилотная группа  ')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(url, {
      method: 'PUT',
      body: { until, reason: 'Пилотная группа' },
    })
    expect(w.emitted('changed')).toHaveLength(1)
    expect(toastShow).toHaveBeenCalled()
    expect(w.find('form').exists()).toBe(false)
  })

  it('cancels via POST …/cancel with the reason only', async () => {
    const w = render({ unlimited: { until: '2999-01-01' } })
    await button(w, 'Отключить')!.trigger('click')
    expect(w.find('input[name="until"]').exists()).toBe(false)
    await w.get('textarea[name="reason"]').setValue('Пилот закончен')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${url}/cancel`, {
      method: 'POST',
      body: { reason: 'Пилот закончен' },
    })
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('keeps the form open and shows the message when the group was deleted meanwhile', async () => {
    apiFetch.mockRejectedValue({
      statusCode: 409,
      data: { data: { code: 'organization.deleted' } },
    })
    const w = render({ unlimited: null })
    await button(w, 'Включить до…')!.trigger('click')
    await w.get('textarea[name="reason"]').setValue('Пилотная группа')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('Организация удалена')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('disables the controls for a deleted group', () => {
    const w = render({ unlimited: { until: '2999-01-01' }, disabled: true })
    for (const b of w.findAll('button')) expect(b.attributes('disabled')).toBeDefined()
  })
})
