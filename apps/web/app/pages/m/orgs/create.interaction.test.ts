// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { createMainButton } from '../../../utils/telegram-shell'

import Create from './create.vue'

let wrapper: VueWrapper | undefined

function stubPage(opts: { telegram: boolean; create: () => Promise<{ id: number }> }) {
  const main = {
    handlers: new Set<() => void>(),
    setText: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    onClick: vi.fn((cb: () => void) => void main.handlers.add(cb)),
    offClick: vi.fn((cb: () => void) => void main.handlers.delete(cb)),
  }
  const haptic = vi.fn()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watchEffect', watchEffect)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('onUnmounted', onUnmounted)
  vi.stubGlobal('createMainButton', createMainButton)
  vi.stubGlobal('apiErrorMessage', (_e: unknown, fallback = 'Ошибка') => fallback)
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useOrganizations', () => ({ create: opts.create }))
  vi.stubGlobal('useTelegram', () => ({
    haptic,
    isTelegram: ref(opts.telegram),
    webApp: { MainButton: main },
  }))
  return { main, haptic }
}

function mountPage() {
  wrapper = mount(Create, { global: { stubs: { VtMiniHeader: true } } })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('create group page in Telegram (20.4.1)', () => {
  it('main button submits exactly once, shows progress while creating and cleans up', async () => {
    let resolve!: (v: { id: number }) => void
    const create = vi.fn(() => new Promise<{ id: number }>((r) => (resolve = r)))
    const { main, haptic } = stubPage({ telegram: true, create })
    const page = mountPage()
    await flushPromises()
    expect(main.show).toHaveBeenCalled()
    expect(main.setText).toHaveBeenLastCalledWith('Создать группу')

    await page.find('#org-name').setValue('Волейбол Минск')
    for (const handler of main.handlers) handler()
    await flushPromises()
    // повторное нажатие, пока идёт создание, не создаёт вторую группу
    for (const handler of main.handlers) handler()
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(main.showProgress).toHaveBeenCalled()
    expect(main.disable).toHaveBeenCalled()

    resolve({ id: 5 })
    await flushPromises()
    expect(haptic).toHaveBeenCalledWith('success')
    expect(main.hideProgress).toHaveBeenCalled()

    page.unmount()
    wrapper = undefined
    expect(main.offClick).toHaveBeenCalled()
    expect(main.handlers.size).toBe(0)
    expect(main.hide).toHaveBeenCalled()
  })

  it('hides the form submit button only inside Telegram', async () => {
    stubPage({ telegram: true, create: vi.fn() })
    const inTelegram = mountPage()
    await flushPromises()
    expect(inTelegram.find('button[type="submit"]').exists()).toBe(false)
    inTelegram.unmount()
    wrapper = undefined

    const { main } = stubPage({ telegram: false, create: vi.fn() })
    const browser = mountPage()
    await flushPromises()
    expect(browser.find('button[type="submit"]').exists()).toBe(true)
    expect(main.show).not.toHaveBeenCalled()
  })

  it('form submit does not double-create while a request is in flight', async () => {
    const create = vi.fn(() => new Promise<{ id: number }>(() => undefined))
    stubPage({ telegram: false, create })
    const page = mountPage()
    await page.find('#org-name').setValue('Волейбол Минск')
    await page.find('form').trigger('submit')
    await page.find('form').trigger('submit')
    expect(create).toHaveBeenCalledTimes(1)
  })
})
