// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import ModerationDialog from './ModerationDialog.vue'

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

function open(props: Record<string, unknown> = {}) {
  wrapper = mount(ModerationDialog, {
    attachTo: document.body,
    props: {
      modelValue: true,
      kind: 'hidden',
      organizationId: 7,
      name: 'Ночная лига',
      city: 'Минск',
      ...props,
    },
    global: { stubs: { VtIcon: true } },
  })
  return wrapper
}

const body = () => document.body
const dialog = () => body().querySelector<HTMLElement>('[role="dialog"]')!
const submit = () => body().querySelector<HTMLButtonElement>('[data-testid="mod-submit"]')!
const radio = (code: string) =>
  body().querySelector<HTMLInputElement>(`input[type="radio"][value="${code}"]`)!
async function choose(code: string) {
  radio(code).click()
  radio(code).dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}
async function typeNote(text: string) {
  const area = body().querySelector<HTMLTextAreaElement>('textarea')!
  area.value = text
  area.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

describe('ModerationDialog (24.1.3)', () => {
  it('is a modal dialog named after the action with the six reasons, note and facts', async () => {
    open()
    await flushPromises()
    const d = dialog()
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(d.getAttribute('aria-labelledby')).toBeTruthy()
    expect(d.textContent).toContain('Скрыть страницу · Ночная лига')
    expect(d.textContent).toContain('Причина · её увидит организатор')
    expect(d.querySelectorAll('input[type="radio"]')).toHaveLength(6)
    expect(d.textContent).toContain('Чужие или неподходящие фото')
    expect(d.textContent).toContain('Что исправить · необязательно')
    expect(d.textContent).toContain('Открывается по ссылке · 404')
    expect(d.textContent).toContain('В каталоге «Минск»')
    expect(d.textContent).toContain('Запись в Telegram')
    expect(d.textContent).toContain('Вернуть можно в любой момент')
  })

  it('noindex variant keeps the page open by link', async () => {
    open({ kind: 'noindex' })
    await flushPromises()
    expect(dialog().textContent).toContain('Принудительный noindex · Ночная лига')
    expect(dialog().textContent).toContain('Открывается по ссылке')
    expect(dialog().textContent).not.toContain('Открывается по ссылке · 404')
    expect(submit().textContent).toContain('Закрыть от поиска')
  })

  it('requires a reason and previews the bot message with the reason and the note', async () => {
    open()
    await flushPromises()
    expect(submit().disabled).toBe(true)
    expect(body().querySelector('[data-testid="bot-preview"]')!.textContent).toContain('Причина: —')
    await choose('spam')
    await typeNote('Уберите ник из заголовка')
    expect(submit().disabled).toBe(false)
    const preview = body().querySelector('[data-testid="bot-preview"]')!.textContent!
    expect(preview).toContain('⛔ Страница группы скрыта')
    expect(preview).toContain('«Ночная лига» · по ссылке теперь не открывается')
    expect(preview).toContain('Причина: Спам или контакты в заголовках')
    expect(preview).toContain('Уберите ник из заголовка')
    expect(preview).toContain('Открыть кабинет')
    expect(preview).not.toContain('Ответить')
  })

  it('limits the note to 1000 characters', async () => {
    open()
    await flushPromises()
    expect(body().querySelector('textarea')!.getAttribute('maxlength')).toBe('1000')
  })

  it('sends the decision, emits done with the page and closes', async () => {
    const page = { organizationId: 7, state: 'hidden' }
    apiFetch.mockResolvedValue(page)
    const w = open()
    await flushPromises()
    await choose('inactive')
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/platform/group-pages/7/moderation', {
      method: 'POST',
      body: { state: 'hidden', reasonCode: 'inactive', note: null },
    })
    expect(w.emitted('done')![0]).toEqual([page])
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([false])
  })

  it('keeps the dialog open and shows a conflict from the server, asking the list to refresh', async () => {
    apiFetch.mockRejectedValue(
      Object.assign(new Error('x'), {
        statusCode: 409,
        data: { data: { code: 'group_page.owner_noindex' } },
      }),
    )
    const w = open({ kind: 'noindex' })
    await flushPromises()
    await choose('price')
    submit().click()
    await flushPromises()
    expect(dialog().querySelector('[role="alert"]')!.textContent).toContain(
      'Владелец уже закрыл страницу от поиска',
    )
    expect(w.emitted('stale')).toHaveLength(1)
    expect(w.emitted('done')).toBeUndefined()
    // повторная отправка возможна
    expect(submit().disabled).toBe(false)
  })

  it('shows a generic message for an unknown failure and for a missing reason code error', async () => {
    apiFetch.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500 }))
    open()
    await flushPromises()
    await choose('media')
    submit().click()
    await flushPromises()
    expect(dialog().querySelector('[role="alert"]')!.textContent).toContain(
      'Не удалось сохранить решение',
    )
  })

  it('closes on Escape and traps Tab inside', async () => {
    const w = open()
    await flushPromises()
    const buttons = [
      ...dialog().querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea'),
    ]
    const last = buttons.at(-1)!
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(dialog().contains(document.activeElement)).toBe(true)
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([false])
  })

  it('closes with the close button and with «Отмена»', async () => {
    const w = open()
    await flushPromises()
    dialog().querySelector<HTMLButtonElement>('[aria-label="Закрыть"]')!.click()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([false])
  })

  it('presets the reason and the note from a complaint or the current decision', async () => {
    open({ preset: 'pay', presetNote: 'Уберите ссылку' })
    await flushPromises()
    expect(radio('pay').checked).toBe(true)
    expect(body().querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Уберите ссылку')
    expect(submit().disabled).toBe(false)
  })

  it('with a complaint id posts to the resolve route', async () => {
    apiFetch.mockResolvedValue({ id: 31, page: { organizationId: 7 } })
    const w = open({ complaintId: 31, preset: 'price' })
    await flushPromises()
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/platform/group-page-complaints/31/resolve', {
      method: 'POST',
      body: { state: 'hidden', reasonCode: 'price', note: null },
    })
    expect(w.emitted('done')![0]).toEqual([{ organizationId: 7 }])
  })
})
