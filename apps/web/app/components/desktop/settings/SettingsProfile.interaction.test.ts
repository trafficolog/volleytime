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
      base: '/app/orgs/7',
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

  it('has no search switch any more: a link leads to the group page section', () => {
    const { wrapper } = mountProfile()
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Показывать страницу группы в поиске')
    const link = wrapper.find('a[href="/app/orgs/7/group-page"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Страницу группы')
  })

  it('is read-only for a non-owner: focusable readonly fields, no save buttons, link stays', () => {
    const { wrapper, request } = mountProfile(false)
    for (const input of wrapper.findAll('input, textarea')) {
      expect(input.attributes('readonly')).toBeDefined()
      expect(input.attributes('disabled')).toBeUndefined()
    }
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/app/orgs/7/group-page"]').exists()).toBe(true)
  })

  it('limits the description and shows a counter', () => {
    const { wrapper } = mountProfile()
    expect(wrapper.find('textarea').attributes('maxlength')).toBe('500')
    expect(wrapper.text()).toContain(`${baseOrg.description!.length} / 500`)
  })

  it('offers catalog cities and shows the page address the city gives (24.2.1)', async () => {
    const { wrapper } = mountProfile()
    const input = wrapper.find('input[data-settings-field="city"]')
    const list = wrapper.find(`datalist#${input.attributes('list')}`)
    const options = list.findAll('option').map((o) => o.attributes('value'))
    expect(options).toContain('Минск')
    expect(options).toContain('Марьина Горка')
    expect(options.length).toBeGreaterThan(100)
    expect(wrapper.find('[data-testid="city-address"]').text()).toContain('volleytime.by/minsk/')
    await input.setValue('могилев')
    expect(wrapper.find('[data-testid="city-address"]').text()).toContain('volleytime.by/mogilev/')
    await input.setValue('Вильнюс')
    expect(wrapper.find('[data-testid="city-address"]').text()).toContain('нет в справочнике')
    await input.setValue('')
    expect(wrapper.find('[data-testid="city-address"]').exists()).toBe(false)
  })
})
