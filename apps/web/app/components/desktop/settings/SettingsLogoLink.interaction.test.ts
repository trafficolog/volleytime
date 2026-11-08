// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsLogoLink from './SettingsLogoLink.vue'

import GroupLogo from '~/components/GroupLogo.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('apiErrorMessage', undefined)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  document.body.innerHTML = ''
})

function mountCard(
  props: Partial<{
    logoUpdatedAt: string | null
    shortLink: string | null
    canManage: boolean
  }> = {},
) {
  return mount(SettingsLogoLink, {
    props: {
      orgId: 7,
      name: 'VolleyTime Минск',
      logoUpdatedAt: null,
      shortLink: null,
      canManage: true,
      ...props,
    },
    global: { components: { GroupLogo } },
    attachTo: document.body,
  })
}

function pick(wrapper: ReturnType<typeof mountCard>, file: File) {
  const input = wrapper.find<HTMLInputElement>('[data-logo-input]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

const png = (size = 1000, type = 'image/png') =>
  new File([new Uint8Array(size)], 'logo.png', { type })

function httpError(status: number, code: string) {
  return { statusCode: status, data: { statusCode: status, data: { code } } }
}

describe('SettingsLogoLink: logo', () => {
  it('shows the monogram without a logo and offers to upload', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-monogram]').exists()).toBe(true)
    expect(wrapper.find('[data-logo]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Загрузить логотип')
    expect(wrapper.text()).toContain('PNG или JPEG, до 512 КБ')
    expect(wrapper.text()).not.toContain('SVG')
    expect(wrapper.find('[data-logo-remove]').exists()).toBe(false)
  })

  it('shows the logo with its version in the url, and offers replace and delete', () => {
    const wrapper = mountCard({ logoUpdatedAt: '2026-11-08T10:00:00.000Z' })
    const img = wrapper.find('[data-logo]')
    expect(img.attributes('src')).toBe(
      `/api/organizations/7/logo?v=${new Date('2026-11-08T10:00:00.000Z').getTime()}`,
    )
    expect(wrapper.text()).toContain('Заменить логотип')
    expect(wrapper.find('[data-logo-remove]').exists()).toBe(true)
  })

  it('previews the chosen file and uploads it as multipart, then reports the new version', async () => {
    fetchMock.mockResolvedValueOnce({ logoUpdatedAt: '2026-11-08T11:00:00.000Z' })
    const wrapper = mountCard()
    await pick(wrapper, png())
    expect(wrapper.find('[data-logo-preview]').attributes('src')).toBe('blob:preview')
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.find('[data-logo-save]').trigger('click')
    await flushPromises()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/organizations/7/logo')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(wrapper.emitted('changed')![0]![0]).toEqual({
      logoUpdatedAt: '2026-11-08T11:00:00.000Z',
      shortLink: null,
    })
    expect(wrapper.emitted('toast')![0]).toEqual(['Логотип сохранён', 'ok'])
    expect(wrapper.find('[data-logo-preview]').exists()).toBe(false)
  })

  it('rejects SVG, other types and big files in the browser before any request', async () => {
    const wrapper = mountCard()
    await pick(wrapper, png(1000, 'image/svg+xml'))
    expect(wrapper.find('[data-logo-error]').text()).toContain('PNG или JPEG')
    await pick(wrapper, png(524_289))
    expect(wrapper.find('[data-logo-error]').text()).toContain('512 КБ')
    await pick(wrapper, png(0))
    expect(wrapper.find('[data-logo-error]').exists()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-logo-preview]').exists()).toBe(false)
  })

  it('shows the server message when the upload is refused', async () => {
    fetchMock.mockRejectedValueOnce(httpError(422, 'logo.invalid'))
    const wrapper = mountCard()
    await pick(wrapper, png())
    await wrapper.find('[data-logo-save]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-logo-error]').text()).toContain('PNG или JPEG')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('deletes the logo and reports the cleared version', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const wrapper = mountCard({ logoUpdatedAt: '2026-11-08T10:00:00.000Z' })
    await wrapper.find('[data-logo-remove]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/logo', { method: 'DELETE' })
    expect(wrapper.emitted('changed')![0]![0]).toEqual({ logoUpdatedAt: null, shortLink: null })
  })

  it('is read-only without the right to manage', () => {
    const wrapper = mountCard({ canManage: false, shortLink: 'vt-minsk' })
    expect(wrapper.find('[data-logo-choose]').exists()).toBe(false)
    expect(wrapper.find('[data-link-save]').exists()).toBe(false)
    expect(
      wrapper.find<HTMLInputElement>('[data-settings-field="shortLink"]').element.readOnly,
    ).toBe(true)
  })
})

describe('SettingsLogoLink: short link', () => {
  const input = (w: ReturnType<typeof mountCard>) =>
    w.find<HTMLInputElement>('[data-settings-field="shortLink"]')

  it('shows the prefix and the current value, save is disabled until it changes', async () => {
    const wrapper = mountCard({ shortLink: 'vt-minsk' })
    expect(wrapper.text()).toContain('volleytime.by/')
    expect(input(wrapper).element.value).toBe('vt-minsk')
    expect(wrapper.find('[data-link-save]').attributes('disabled')).toBeDefined()
    await input(wrapper).setValue('vt-brest')
    expect(wrapper.find('[data-link-save]').attributes('disabled')).toBeUndefined()
  })

  it('saves the normalized value and reports it', async () => {
    fetchMock.mockResolvedValueOnce({ shortLink: 'vt-brest' })
    const wrapper = mountCard()
    await input(wrapper).setValue('  VT-Brest ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/short-link', {
      method: 'PUT',
      body: { shortLink: 'vt-brest' },
    })
    expect(wrapper.emitted('changed')![0]![0]).toMatchObject({ shortLink: 'vt-brest' })
    expect(wrapper.emitted('toast')![0]).toEqual(['Короткая ссылка сохранена', 'ok'])
  })

  it('checks the format in the browser and does not send an invalid value', async () => {
    const wrapper = mountCard()
    for (const bad of ['ab', 'a--b', 'abc_d', 'абвг', '-abc']) {
      await input(wrapper).setValue(bad)
      await wrapper.find('form').trigger('submit')
      expect(wrapper.find('[role="alert"]').text(), bad).not.toBe('')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains a taken address and a reserved word', async () => {
    const wrapper = mountCard()
    fetchMock.mockRejectedValueOnce(httpError(409, 'short_link.taken'))
    await input(wrapper).setValue('taken-one')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('уже занят другой группой')
    fetchMock.mockRejectedValueOnce(httpError(422, 'short_link.reserved'))
    await input(wrapper).setValue('admin')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('занято приложением')
  })

  it('clears the link with an empty value', async () => {
    fetchMock.mockResolvedValueOnce({ shortLink: null })
    const wrapper = mountCard({ shortLink: 'vt-minsk' })
    await input(wrapper).setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/short-link', {
      method: 'PUT',
      body: { shortLink: null },
    })
    expect(wrapper.emitted('toast')![0]).toEqual(['Короткая ссылка снята', 'ok'])
  })
})
