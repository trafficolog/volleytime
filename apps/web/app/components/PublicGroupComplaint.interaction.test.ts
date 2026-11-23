// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import PublicGroupComplaint from './PublicGroupComplaint.vue'

const apiFetch = vi.fn()
let wrapper: VueWrapper | undefined

beforeEach(() => {
  apiFetch.mockReset()
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const mountIt = () => {
  wrapper = mount(PublicGroupComplaint, {
    attachTo: document.body,
    props: { slug: 'friday' },
    global: { stubs: { VtIcon: true } },
  })
  return wrapper
}
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const send = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="complaint-submit"]')!
async function openDialog() {
  const w = mountIt()
  await w.get('[data-testid="complaint-open"]').trigger('click')
  await flushPromises()
}
async function pick(code: string) {
  const r = dialog()!.querySelector<HTMLInputElement>(`input[value="${code}"]`)!
  r.click()
  r.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}

describe('PublicGroupComplaint (24.1.3, R-06)', () => {
  it('is a real button with a visible name that opens a labelled modal dialog', async () => {
    const w = mountIt()
    const button = w.get('[data-testid="complaint-open"]')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-haspopup')).toBe('dialog')
    expect(button.text()).toBe('Пожаловаться на страницу')
    expect(dialog()).toBeNull()
    await button.trigger('click')
    await flushPromises()
    const d = dialog()!
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(d.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Пожаловаться на страницу',
    )
    expect(d.textContent).toContain('Организатор не узнает, кто отправил жалобу')
  })

  it('lists the five public reasons, the optional details with a counter and the daily limit hint', async () => {
    await openDialog()
    const d = dialog()!
    const labels = [...d.querySelectorAll('fieldset label')].map((l) => l.textContent!.trim())
    expect(labels).toEqual([
      'Цены не совпадают с записью',
      'Группа не существует или не играет',
      'Чужие фото или текст',
      'Обман или мошенничество',
      'Другое',
    ])
    expect(d.textContent).toContain('Подробности · необязательно')
    expect(d.querySelector('textarea')!.getAttribute('maxlength')).toBe('500')
    expect(d.textContent).toContain('Не больше 3 жалоб в сутки')
    expect(d.textContent).toContain('0 / 500')
  })

  it('needs a reason to send, then posts the reason and trimmed details without sign-in data', async () => {
    apiFetch.mockResolvedValue({ ok: true })
    await openDialog()
    expect(send().disabled).toBe(true)
    await pick('price')
    const area = dialog()!.querySelector<HTMLTextAreaElement>('textarea')!
    area.value = '  На странице 15 BYN  '
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    send().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/public/groups/friday/complaints', {
      method: 'POST',
      body: { reasonCode: 'price', details: 'На странице 15 BYN' },
    })
  })

  it('confirms with the moderator promise after success and closes on «Закрыть»', async () => {
    apiFetch.mockResolvedValue({ ok: true })
    await openDialog()
    await pick('fraud')
    send().click()
    await flushPromises()
    const d = dialog()!
    expect(d.textContent).toContain('Спасибо')
    expect(d.textContent).toContain('Модератор посмотрит в течение суток')
    expect(d.textContent).toContain('страница изменится или исчезнет')
    const close = [...d.querySelectorAll('button')].find(
      (b) => b.textContent!.trim() === 'Закрыть',
    )!
    close.click()
    await flushPromises()
    expect(dialog()).toBeNull()
  })

  it('answers 429 with «Не больше 3 жалоб в сутки» and keeps the form', async () => {
    apiFetch.mockRejectedValue(
      Object.assign(new Error('x'), {
        statusCode: 429,
        data: { data: { code: 'group_page.complaint_limited' } },
      }),
    )
    await openDialog()
    await pick('other')
    send().click()
    await flushPromises()
    const alert = dialog()!.querySelector('[data-testid="complaint-error"]')!
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toBe('Не больше 3 жалоб в сутки')
    expect(dialog()!.textContent).not.toContain('Спасибо')
    expect(send().disabled).toBe(false)
  })

  it('answers the generic rate limit and unknown failures with a retry hint', async () => {
    apiFetch.mockRejectedValueOnce(
      Object.assign(new Error('x'), { statusCode: 429, data: { data: { code: 'rate_limited' } } }),
    )
    await openDialog()
    await pick('media')
    send().click()
    await flushPromises()
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toContain(
      'Слишком много попыток',
    )
    apiFetch.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    send().click()
    await flushPromises()
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toContain(
      'Не удалось отправить жалобу',
    )
  })

  it('starts empty every time it is opened and closes on Escape', async () => {
    await openDialog()
    await pick('media')
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(dialog()).toBeNull()
    await wrapper!.get('[data-testid="complaint-open"]').trigger('click')
    await flushPromises()
    expect(dialog()!.querySelector('input:checked')).toBeNull()
  })
})
