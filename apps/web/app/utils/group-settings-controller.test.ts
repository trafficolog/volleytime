import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { GroupSettings } from './group-settings'
import { createSettingsController, type OrgProfile } from './group-settings-controller'

const initial: GroupSettings = {
  subscriptionsEnabled: true,
  maxSeatsPerBooking: 3,
  defaultPriceMode: 'fixed',
  defaultJoinMode: 'open',
  cancellationAllowed: true,
  cancellationDeadlineHours: 6,
  seoIndex: false,
  city: 'Минск',
  district: null,
  levels: [],
}
const org: OrgProfile = { name: 'Группа', description: null, defaultMemberStatus: 'active' }

function setup(request = vi.fn()) {
  const settings = ref<GroupSettings | null>({ ...initial })
  const profile = ref<OrgProfile | null>({ ...org })
  const toast = vi.fn()
  let current = true
  const controller = createSettingsController({
    orgId: 7,
    request: request as never,
    settings,
    org: profile,
    toast,
    errorMessage: (cause, fallback) => (cause as Error).message || fallback,
    isCurrent: () => current,
  })
  return { controller, settings, profile, toast, request, leave: () => (current = false) }
}

describe('settings controller', () => {
  it('applies a toggle optimistically and reconciles with the server response', async () => {
    let resolve!: (v: unknown) => void
    const request = vi.fn(() => new Promise((r) => (resolve = r)))
    const { controller, settings, toast } = setup(request)

    const done = controller.toggle('subscriptionsEnabled', false)
    expect(settings.value!.subscriptionsEnabled).toBe(false)
    expect(controller.isPending('subscriptionsEnabled')).toBe(true)
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { subscriptionsEnabled: false },
    })

    resolve({ settings: { ...initial, subscriptionsEnabled: false, seoIndex: true } })
    expect(await done).toEqual({ ok: true })
    expect(settings.value!.seoIndex).toBe(true)
    expect(controller.isPending('subscriptionsEnabled')).toBe(false)
    expect(toast).toHaveBeenCalledWith('Абонементы выключены', 'ok')
  })

  it('reverts a toggle and reports the error when the server rejects it', async () => {
    const { controller, settings, toast } = setup(vi.fn().mockRejectedValue(new Error('Нет прав')))
    const result = await controller.toggle('seoIndex', true)
    expect(result).toEqual({ ok: false, message: 'Нет прав' })
    expect(settings.value!.seoIndex).toBe(false)
    expect(toast).toHaveBeenCalledWith('Нет прав', 'danger')
    expect(controller.isPending('seoIndex')).toBe(false)
  })

  it('ignores a second change of the same setting while one is in flight', async () => {
    const request = vi.fn(() => new Promise(() => undefined))
    const { controller } = setup(request)
    void controller.toggle('seoIndex', true)
    expect(await controller.toggle('seoIndex', false)).toEqual({ ok: false })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('sends only the given fields and keeps the draft on a failed save', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Сервер не принял значения'))
    const { controller, settings } = setup(request)
    const result = await controller.saveSettings({ maxSeatsPerBooking: 5 })
    expect(result).toEqual({ ok: false, message: 'Сервер не принял значения' })
    expect(settings.value!.maxSeatsPerBooking).toBe(3)
    expect(request).toHaveBeenCalledWith('/api/organizations/7/settings', {
      method: 'PATCH',
      body: { maxSeatsPerBooking: 5 },
    })
  })

  it('does not call the server for an empty patch', async () => {
    const { controller, request } = setup()
    expect(await controller.saveSettings({})).toEqual({ ok: true })
    expect(request).not.toHaveBeenCalled()
  })

  it('saves profile fields through both endpoints and stops on the first failure', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        organization: { name: 'Новая', description: 'Описание', defaultMemberStatus: 'active' },
      })
      .mockResolvedValueOnce({ settings: { ...initial, city: 'Брест', district: 'Центр' } })
    const { controller, settings, profile } = setup(request)
    const result = await controller.saveProfile(
      { name: 'Новая', description: 'Описание' },
      { city: 'Брест', district: 'Центр' },
    )
    expect(result).toEqual({ ok: true })
    expect(request).toHaveBeenNthCalledWith(1, '/api/organizations/7', {
      method: 'PATCH',
      body: { name: 'Новая', description: 'Описание' },
    })
    expect(profile.value!.name).toBe('Новая')
    expect(settings.value!.city).toBe('Брест')

    const failing = setup(vi.fn().mockRejectedValue(new Error('Нет прав')))
    expect(await failing.controller.saveProfile({ name: 'X1' }, { city: 'Гомель' })).toEqual({
      ok: false,
      message: 'Нет прав',
    })
    expect(failing.request).toHaveBeenCalledTimes(1)
    expect(failing.settings.value!.city).toBe('Минск')
  })

  it('changes the default member status through the group endpoint', async () => {
    const request = vi.fn().mockResolvedValue({
      organization: { name: 'Группа', description: null, defaultMemberStatus: 'pending' },
    })
    const { controller, profile } = setup(request)
    const done = controller.setMemberStatus('pending')
    expect(profile.value!.defaultMemberStatus).toBe('pending')
    expect(await done).toEqual({ ok: true })
  })

  it('reverts the member status when the server fails', async () => {
    const { controller, profile } = setup(vi.fn().mockRejectedValue(new Error('x')))
    await controller.setMemberStatus('pending')
    expect(profile.value!.defaultMemberStatus).toBe('active')
  })

  it('drops the result once the user left the group page', async () => {
    const request = vi.fn().mockResolvedValue({ settings: { ...initial, seoIndex: true } })
    const { controller, settings, toast, leave } = setup(request)
    const done = controller.toggle('seoIndex', true)
    leave()
    await done
    expect(settings.value!.seoIndex).toBe(true)
    expect(toast).not.toHaveBeenCalled()
  })
})
