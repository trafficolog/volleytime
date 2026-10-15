import { ref, type Ref } from 'vue'

import type { GroupSettings } from './group-settings'

/** Поля группы, которые меняет PATCH /api/organizations/{id} (владелец). */
export interface OrgProfile {
  name: string
  description: string | null
  defaultMemberStatus: 'active' | 'pending'
}

export type SaveResult = { ok: true } | { ok: false; message?: string }
type Request = <T>(
  url: string,
  init: { method: 'PATCH'; body: Record<string, unknown> },
) => Promise<T>
type ToggleKey = 'subscriptionsEnabled' | 'cancellationAllowed' | 'seoIndex'

const TOGGLE_TOAST: Record<ToggleKey, [on: string, off: string]> = {
  subscriptionsEnabled: ['Абонементы включены', 'Абонементы выключены'],
  cancellationAllowed: ['Отмена записи включена', 'Отмена записи выключена'],
  seoIndex: ['Страница группы доступна поиску', 'Страница группы скрыта от поиска'],
}

interface Options {
  orgId: number
  request: Request
  settings: Ref<GroupSettings | null>
  org: Ref<OrgProfile | null>
  toast: (message: string, tone: 'ok' | 'danger') => void
  errorMessage: (cause: unknown, fallback: string) => string
  /** false, когда пользователь уже ушёл со страницы или сменил группу. */
  isCurrent: () => boolean
}

/**
 * Изменения настроек группы: оптимистичный UI для переключателей и сохранение форм через
 * существующие PATCH. Сервер остаётся источником истины: ответ заменяет локальное значение,
 * ошибка возвращает прежнее.
 */
export function createSettingsController(options: Options) {
  const { orgId, request, settings, org, toast, errorMessage, isCurrent } = options
  const pending = ref<string[]>([])
  const settingsUrl = `/api/organizations/${orgId}/settings`
  const orgUrl = `/api/organizations/${orgId}`

  const isPending = (key: string) => pending.value.includes(key)
  const hold = (keys: string[]) => (pending.value = [...pending.value, ...keys])
  const release = (keys: string[]) =>
    (pending.value = pending.value.filter((k) => !keys.includes(k)))

  async function patchSettings(patch: Partial<GroupSettings>): Promise<SaveResult> {
    const current = settings.value
    if (!current) return { ok: false }
    const keys = Object.keys(patch) as (keyof GroupSettings)[]
    if (keys.length === 0) return { ok: true }
    const previous = Object.fromEntries(keys.map((k) => [k, current[k]]))
    settings.value = { ...current, ...patch }
    try {
      const response = await request<{ settings: GroupSettings }>(settingsUrl, {
        method: 'PATCH',
        body: patch,
      })
      // только отправленные поля: поздний ответ не должен откатывать соседние, более новые правки
      if (isCurrent() && settings.value) {
        const confirmed = Object.fromEntries(keys.map((k) => [k, response.settings[k]]))
        settings.value = { ...settings.value, ...confirmed }
      }
      return { ok: true }
    } catch (cause) {
      if (isCurrent() && settings.value) settings.value = { ...settings.value, ...previous }
      return { ok: false, message: errorMessage(cause, 'Не удалось сохранить настройки') }
    }
  }

  async function patchOrg(patch: Partial<OrgProfile>): Promise<SaveResult> {
    const current = org.value
    if (!current) return { ok: false }
    const keys = Object.keys(patch) as (keyof OrgProfile)[]
    if (keys.length === 0) return { ok: true }
    const previous = Object.fromEntries(keys.map((k) => [k, current[k]]))
    org.value = { ...current, ...patch }
    try {
      const response = await request<{ organization: OrgProfile }>(orgUrl, {
        method: 'PATCH',
        body: patch,
      })
      if (isCurrent() && org.value) {
        const confirmed = Object.fromEntries(keys.map((k) => [k, response.organization[k]]))
        org.value = { ...org.value, ...confirmed }
      }
      return { ok: true }
    } catch (cause) {
      if (isCurrent() && org.value) org.value = { ...org.value, ...previous }
      return { ok: false, message: errorMessage(cause, 'Не удалось сохранить настройки') }
    }
  }

  async function toggle(key: ToggleKey, value: boolean): Promise<SaveResult> {
    if (isPending(key)) return { ok: false }
    hold([key])
    try {
      const result = await patchSettings({ [key]: value })
      if (isCurrent()) {
        if (result.ok) toast(TOGGLE_TOAST[key][value ? 0 : 1], 'ok')
        else toast(result.message ?? 'Не удалось сохранить настройки', 'danger')
      }
      return result
    } finally {
      release([key])
    }
  }

  async function saveSettings(patch: Partial<GroupSettings>): Promise<SaveResult> {
    const keys = Object.keys(patch)
    if (keys.some(isPending)) return { ok: false }
    hold(keys)
    try {
      const result = await patchSettings(patch)
      if (isCurrent() && result.ok && keys.length > 0) toast('Настройки сохранены', 'ok')
      return result
    } finally {
      release(keys)
    }
  }

  /** Профиль: название и описание — PATCH группы, город и район — PATCH настроек. */
  async function saveProfile(
    orgPatch: Partial<Pick<OrgProfile, 'name' | 'description'>>,
    settingsPatch: Partial<Pick<GroupSettings, 'city' | 'district'>>,
  ): Promise<SaveResult> {
    const orgResult = await patchOrg(orgPatch)
    if (!orgResult.ok) return orgResult
    const settingsResult = await patchSettings(settingsPatch)
    if (!settingsResult.ok && Object.keys(orgPatch).length > 0) {
      return {
        ok: false,
        message: `Название и описание сохранены, город и район нет: ${settingsResult.message ?? 'ошибка'}`,
      }
    }
    if (isCurrent() && settingsResult.ok) toast('Профиль группы сохранён', 'ok')
    return settingsResult
  }

  async function setMemberStatus(value: OrgProfile['defaultMemberStatus']): Promise<SaveResult> {
    if (isPending('defaultMemberStatus')) return { ok: false }
    hold(['defaultMemberStatus'])
    try {
      const result = await patchOrg({ defaultMemberStatus: value })
      if (isCurrent()) {
        if (result.ok) toast('Настройки сохранены', 'ok')
        else toast(result.message ?? 'Не удалось сохранить настройки', 'danger')
      }
      return result
    } finally {
      release(['defaultMemberStatus'])
    }
  }

  return { isPending, toggle, saveSettings, saveProfile, setMemberStatus }
}

export type SettingsController = ReturnType<typeof createSettingsController>
