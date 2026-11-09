// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
      expect(radio.attributes('aria-disabled')).toBe('true')
    }
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/app/orgs/7/members',
      '/app/orgs/7/invite',
    ])
  })
})
