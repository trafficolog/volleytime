// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SettingsDanger from './SettingsDanger.vue'
import SettingsIntegrations from './SettingsIntegrations.vue'
import SettingsNotifications from './SettingsNotifications.vue'
import SettingsTeam from './SettingsTeam.vue'
import { makeController, stubs } from './settings-fixtures'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountTeam(canEdit = true, request = vi.fn()) {
  const ctx = makeController(request)
  const wrapper = mount(SettingsTeam, {
    props: { org: ctx.org.value, base: '/app/orgs/7', canEdit, controller: ctx.controller },
    global: { stubs },
  })
  return { ...ctx, wrapper }
}

describe('SettingsTeam', () => {
  it('changes the default member status through the group endpoint', async () => {
    const request = vi.fn().mockResolvedValue({
      organization: { name: 'Группа', description: null, defaultMemberStatus: 'pending' },
    })
    const { wrapper, org, toast } = mountTeam(true, request)
    expect(wrapper.text()).toContain('Как новый участник попадает в состав')
    await wrapper
      .findAll('[role="radio"]')
      .find((r) => r.text() === 'После одобрения')!
      .trigger('click')
    expect(org.value.defaultMemberStatus).toBe('pending')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/organizations/7', {
      method: 'PATCH',
      body: { defaultMemberStatus: 'pending' },
    })
    expect(toast).toHaveBeenCalledWith('Настройки сохранены', 'ok')
  })

  it('reverts and reports a refused change', async () => {
    const { wrapper, org, toast } = mountTeam(
      true,
      vi.fn().mockRejectedValue(new Error('Нет прав')),
    )
    await wrapper
      .findAll('[role="radio"]')
      .find((r) => r.text() === 'После одобрения')!
      .trigger('click')
    await flushPromises()
    expect(org.value.defaultMemberStatus).toBe('active')
    expect(toast).toHaveBeenCalledWith('Нет прав', 'danger')
  })

  it('is read-only for a non-owner and links to players and invites', () => {
    const { wrapper } = mountTeam(false)
    for (const radio of wrapper.findAll('[role="radio"]')) {
      expect(radio.attributes('disabled')).toBeDefined()
    }
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/app/orgs/7/members',
      '/app/orgs/7/invite',
    ])
  })
})

describe('SettingsNotifications', () => {
  it('lists what the bot sends without fake switches', () => {
    const wrapper = mount(SettingsNotifications)
    expect(wrapper.text()).toContain('Напоминания за 24 часа и за 2 часа')
    expect(wrapper.text()).toContain('Оплата ждёт подтверждения')
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('бот шлёт их всегда')
  })
})

describe('SettingsIntegrations', () => {
  it('links to the configured bot', () => {
    const wrapper = mount(SettingsIntegrations, {
      props: { botUsername: 'volleytime_bot', base: '/app/orgs/7' },
      global: { stubs },
    })
    const link = wrapper.find('a.vt-settings-link')
    expect(link.text()).toBe('@volleytime_bot')
    expect(link.attributes('href')).toBe('https://t.me/volleytime_bot')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('says so when the bot name is not configured', () => {
    const wrapper = mount(SettingsIntegrations, {
      props: { botUsername: '', base: '/app/orgs/7' },
      global: { stubs },
    })
    expect(wrapper.find('a.vt-settings-link').exists()).toBe(false)
    expect(wrapper.text()).toContain('Имя бота не настроено')
  })
})

describe('SettingsDanger', () => {
  const mountDanger = (busy = false, error = '') =>
    mount(SettingsDanger, { props: { busy, error }, attachTo: document.body })

  it('asks for confirmation before archiving and does nothing on cancel', async () => {
    const wrapper = mountDanger()
    await wrapper.find('button.vt-btn--danger').trigger('click')
    const dialog = document.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Архивировать группу?')
    expect(wrapper.emitted('archive')).toBeUndefined()
    ;(dialog.querySelector('.vt-btn--ghost') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(wrapper.emitted('archive')).toBeUndefined()
  })

  it('emits archive after the confirmation', async () => {
    const wrapper = mountDanger()
    await wrapper.find('button.vt-btn--danger').trigger('click')
    ;(document.querySelector('[role="alertdialog"] .vt-btn--rose') as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.emitted('archive')).toHaveLength(1)
  })

  it('disables the button while archiving and shows an error', () => {
    const wrapper = mountDanger(true, 'Не удалось архивировать группу')
    expect(wrapper.find('button.vt-btn--danger').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="alert"]').text()).toBe('Не удалось архивировать группу')
  })
})
