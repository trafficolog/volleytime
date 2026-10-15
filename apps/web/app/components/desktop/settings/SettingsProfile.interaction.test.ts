// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SettingsProfile from './SettingsProfile.vue'
import { baseOrg, baseSettings, makeController, stubs } from './settings-fixtures'

function mountProfile(canEdit = true, request = vi.fn()) {
  const ctx = makeController(request)
  const wrapper = mount(SettingsProfile, {
    props: {
      org: ctx.org.value,
      settings: ctx.settings.value,
      canEdit,
      controller: ctx.controller,
    },
    global: { stubs },
    attachTo: document.body,
  })
  return { ...ctx, wrapper }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsProfile', () => {
  it('starts with the saved values and a disabled save button', () => {
    const { wrapper } = mountProfile()
    expect(
      (wrapper.find('input[data-settings-field="name"]').element as HTMLInputElement).value,
    ).toBe(baseOrg.name)
    expect(
      (wrapper.find('input[data-settings-field="city"]').element as HTMLInputElement).value,
    ).toBe('Минск')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('states what each field affects', () => {
    const { wrapper } = mountProfile()
    const text = wrapper.text()
    expect(text).toContain('Показывается игрокам в Mini App')
    expect(text).toContain('Разрешает поисковикам')
  })

  it('shows a validation error, marks the field and sends nothing', async () => {
    const { wrapper, request } = mountProfile()
    await wrapper.find('input[data-settings-field="name"]').setValue('A')
    await wrapper.find('form').trigger('submit')
    const name = wrapper.find('input[data-settings-field="name"]')
    expect(name.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('минимум 2 символа')
    expect(document.activeElement).toBe(name.element)
    expect(request).not.toHaveBeenCalled()
  })

  it('saves name and description to the group and city and district to the settings', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        organization: {
          name: 'Новая группа',
          description: baseOrg.description,
          defaultMemberStatus: 'active',
        },
      })
      .mockResolvedValueOnce({ settings: { ...baseSettings, city: 'Брест', district: 'Центр' } })
    const { wrapper, toast } = mountProfile(true, request)
    await wrapper.find('input[data-settings-field="name"]').setValue(' Новая группа ')
    await wrapper.find('input[data-settings-field="city"]').setValue('Брест')
    await wrapper.find('input[data-settings-field="district"]').setValue('Центр')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(request).toHaveBeenNthCalledWith(1, '/api/organizations/7', {
      method: 'PATCH',
      body: { name: 'Новая группа' },
    })
    expect(request).toHaveBeenNthCalledWith(2, '/api/organizations/7/settings', {
      method: 'PATCH',
      body: { city: 'Брест', district: 'Центр' },
    })
    expect(toast).toHaveBeenCalledWith('Профиль группы сохранён', 'ok')
  })

  it('keeps the typed values and shows the server error when saving fails', async () => {
    const { wrapper } = mountProfile(
      true,
      vi.fn().mockRejectedValue(new Error('Нужны права владельца')),
    )
    await wrapper.find('input[data-settings-field="name"]').setValue('Другое имя')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.vt-settings-error--form').text()).toBe('Нужны права владельца')
    expect(
      (wrapper.find('input[data-settings-field="name"]').element as HTMLInputElement).value,
    ).toBe('Другое имя')
  })

  it('cancel restores the saved values', async () => {
    const { wrapper } = mountProfile()
    await wrapper.find('input[data-settings-field="city"]').setValue('Гомель')
    await wrapper.find('button[type="button"]').trigger('click')
    expect(
      (wrapper.find('input[data-settings-field="city"]').element as HTMLInputElement).value,
    ).toBe('Минск')
  })

  it('toggles search visibility optimistically and reverts on a server error', async () => {
    let reject!: (e: Error) => void
    const request = vi.fn(() => new Promise((_, r) => (reject = r)))
    const { wrapper, settings, toast } = mountProfile(true, request)
    const toggle = () => wrapper.find('[role="switch"]')
    expect(toggle().attributes('aria-checked')).toBe('false')
    await toggle().trigger('click')
    expect(settings.value.seoIndex).toBe(true)
    reject(new Error('Нет прав'))
    await flushPromises()
    expect(settings.value.seoIndex).toBe(false)
    await wrapper.setProps({ settings: settings.value })
    expect(toggle().attributes('aria-checked')).toBe('false')
    expect(toast).toHaveBeenCalledWith('Нет прав', 'danger')
  })

  it('is read-only for a non-owner: disabled controls and no save buttons', () => {
    const { wrapper } = mountProfile(false)
    for (const input of wrapper.findAll('input, textarea')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
    expect(wrapper.find('[role="switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })
})
