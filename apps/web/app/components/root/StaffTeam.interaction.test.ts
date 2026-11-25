// @vitest-environment happy-dom
import type { PlatformStaffList, PlatformStaffMember } from '@volley-time/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'

import StaffTeam from './StaffTeam.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const API = '/api/platform/staff'
const apiFetch = vi.fn()
const toastShow = vi.fn()
let wrapper: VueWrapper | undefined
let members: PlatformStaffMember[]

const member = (
  userId: number,
  name: string,
  role: PlatformStaffMember['role'],
  over: Partial<PlatformStaffMember> = {},
): PlatformStaffMember => ({
  userId,
  name,
  email: `${userId}-${role}@volleytime.by`,
  telegramUsername: null,
  role,
  invitedBy: userId === 1 ? null : { id: 1, name: 'Иван Петров' },
  createdAt: '2026-11-20T09:00:00.000Z',
  ...over,
})

const apiError = (statusCode: number, code: string) =>
  Object.assign(new Error(code), { statusCode, data: { data: { code } } })

const body = () => document.body
const rowOf = (userId: number) =>
  body().querySelector<HTMLElement>(`[data-testid="staff-row-${userId}"]`)
const dialog = () => body().querySelector<HTMLElement>('[role="dialog"]')
const submit = () => body().querySelector<HTMLButtonElement>('[data-testid="staff-submit"]')!
const alertText = () => dialog()?.querySelector('[role="alert"]')?.textContent?.trim()
const radios = () =>
  [...dialog()!.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((r) => r.value)

beforeEach(() => {
  members = [
    member(1, 'Иван Петров', 'owner'),
    member(2, 'Анна Король', 'admin'),
    member(3, 'Катя Сидорова', 'support'),
  ]
  apiFetch.mockReset().mockImplementation(async (url: string) => {
    if (url === API) return { members } satisfies PlatformStaffList
    throw new Error(`unexpected ${url}`)
  })
  toastShow.mockReset()
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function render(selfId = 1) {
  wrapper = mount(StaffTeam, {
    attachTo: document.body,
    props: { selfId },
    global: {
      components: { ErrorState, SkeletonList },
      stubs: { VtIcon: true },
    },
  })
  await flushPromises()
  return wrapper
}

async function openMenu(userId: number, item: string) {
  rowOf(userId)!.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click()
  await flushPromises()
  const entry = [...body().querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) =>
    i.textContent?.includes(item),
  )!
  entry.click()
  await flushPromises()
}

async function chooseRole(role: string) {
  const radio = dialog()!.querySelector<HTMLInputElement>(`input[type="radio"][value="${role}"]`)!
  radio.click()
  radio.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}

async function typeUser(text: string) {
  const input = dialog()!.querySelector<HTMLInputElement>('input[name="user"]')!
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

type Opts = { method?: string; body?: unknown }

describe('StaffTeam: «Команда & роли» (29.3.1, R-15)', () => {
  it('lists the team with name, contact, role, who invited and a menu per person', async () => {
    const w = await render()
    expect(apiFetch).toHaveBeenCalledWith(API)
    expect(w.text()).toContain('Команда платформы')
    expect(w.text()).toContain('Одна роль на человека')
    expect(rowOf(1)!.textContent).toContain('Иван Петров')
    expect(rowOf(1)!.textContent).toContain('Owner')
    expect(rowOf(2)!.textContent).toContain('2-admin@volleytime.by')
    expect(rowOf(2)!.textContent).toContain('Admin')
    expect(rowOf(2)!.textContent).toContain('Иван Петров')
    expect(rowOf(3)!.textContent).toContain('Support')
    expect(body().querySelectorAll('[data-testid^="staff-row-"]')).toHaveLength(3)
  })

  it('shows Telegram when a person has no email, and an em dash when invited by nobody', async () => {
    members = [member(1, 'Иван Петров', 'owner', { email: null, telegramUsername: 'ivan_p' })]
    await render()
    expect(rowOf(1)!.textContent).toContain('@ivan_p')
    expect(rowOf(1)!.textContent).toContain('—')
  })

  it('shows an error with a retry when the list does not load', async () => {
    apiFetch.mockRejectedValueOnce(apiError(500, 'internal_error'))
    const w = await render()
    expect(w.text()).toContain('Не удалось загрузить команду')
    await w.get('button.vt-btn').trigger('click')
    await flushPromises()
    expect(rowOf(2)).not.toBeNull()
  })

  it('«Изменить роль»: roles without Owner, current one marked, PATCH, row updated', async () => {
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (url === `${API}/3` && opts?.method === 'PATCH')
        return member(3, 'Катя Сидорова', 'moderator')
      throw new Error(`unexpected ${url}`)
    })
    await render()
    await openMenu(3, 'Изменить роль')
    expect(dialog()!.textContent).toContain('Катя Сидорова')
    expect(radios()).toEqual(['admin', 'finance', 'moderator', 'support', 'analyst'])
    expect(dialog()!.querySelector<HTMLInputElement>('input[value="support"]')!.checked).toBe(true)
    expect(dialog()!.textContent).toContain('Права меняются сразу, запись в аудит')

    await chooseRole('moderator')
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/3`, {
      method: 'PATCH',
      body: { role: 'moderator' },
    })
    expect(rowOf(3)!.textContent).toContain('Moderator')
    expect(dialog()).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('Катя Сидорова: Moderator')
  })

  it('does not send the role that is already set', async () => {
    await render()
    await openMenu(3, 'Изменить роль')
    expect(submit().disabled).toBe(true)
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('an Owner can be moved to any role, Owner included', async () => {
    members = [member(1, 'Иван Петров', 'owner'), member(9, 'Пётр Второй', 'owner')]
    await render()
    await openMenu(9, 'Изменить роль')
    expect(radios()).toEqual(['owner', 'admin', 'finance', 'moderator', 'support', 'analyst'])
  })

  it('last Owner: the 409 is explained, the dialog stays open and the row is unchanged', async () => {
    // второй Owner есть в списке, но к запросу его уже убрали: сервер всё равно отвечает 409
    members = [member(1, 'Иван Петров', 'owner'), member(9, 'Пётр Второй', 'owner')]
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (opts?.method === 'PATCH') throw apiError(409, 'platform.staff_last_owner')
      throw new Error(`unexpected ${url}`)
    })
    await render()
    await openMenu(1, 'Изменить роль')
    await chooseRole('admin')
    submit().click()
    await flushPromises()
    expect(alertText()).toBe('Последнего Owner нельзя понизить или удалить')
    expect(rowOf(1)!.textContent).toContain('Owner')
    expect(wrapper!.emitted('self-changed')).toBeUndefined()
    expect(toastShow).not.toHaveBeenCalled()
  })

  describe('last Owner (29.3.1, R-15)', () => {
    const items = () => [...body().querySelectorAll<HTMLElement>('[role="menuitem"]')]
    async function openOnly(userId: number) {
      rowOf(userId)!.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click()
      await flushPromises()
    }

    it('blocks «Изменить роль» and «Удалить из команды» for the only Owner', async () => {
      await render()
      await openOnly(1)
      expect(items().map((i) => i.getAttribute('aria-disabled'))).toEqual(['true', 'true'])
      items()[0]!.click()
      await flushPromises()
      expect(dialog()).toBeNull()
      items()[1]!.click()
      await flushPromises()
      expect(dialog()).toBeNull()
    })

    it('keeps the menu for other people while there is one Owner', async () => {
      await render()
      await openOnly(2)
      expect(items().map((i) => i.getAttribute('aria-disabled'))).toEqual([null, null])
    })

    it('unblocks the menu of an Owner once there are two', async () => {
      members = [member(1, 'Иван Петров', 'owner'), member(9, 'Пётр Второй', 'owner')]
      await render()
      await openOnly(1)
      expect(items().map((i) => i.getAttribute('aria-disabled'))).toEqual([null, null])
    })
  })

  it('a person who is no longer in the team: explains it and refreshes the list', async () => {
    let calls = 0
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) {
        calls += 1
        return { members: calls === 1 ? members : members.filter((m) => m.userId !== 3) }
      }
      if (opts?.method === 'PATCH') throw apiError(404, 'platform.staff_not_found')
      throw new Error(`unexpected ${url}`)
    })
    await render()
    await openMenu(3, 'Изменить роль')
    await chooseRole('analyst')
    submit().click()
    await flushPromises()
    expect(alertText()).toBe('Этого человека уже нет в команде. Список обновлён')
    expect(rowOf(3)).toBeNull()
  })

  it('«Удалить из команды»: confirmation, DELETE, the row disappears', async () => {
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (url === `${API}/3` && opts?.method === 'DELETE') return { userId: 3 }
      throw new Error(`unexpected ${url}`)
    })
    await render()
    await openMenu(3, 'Удалить из команды')
    expect(dialog()!.textContent).toContain('Катя Сидорова')
    expect(dialog()!.textContent).toContain('Доступ к Root Admin пропадёт')
    expect(apiFetch).not.toHaveBeenCalledWith(`${API}/3`, expect.anything())
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(`${API}/3`, { method: 'DELETE' })
    expect(rowOf(3)).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('Удалено из команды: Катя Сидорова')
    expect(wrapper!.emitted('self-changed')).toBeUndefined()
  })

  it('removing the last Owner: 409 text in the dialog, the row stays', async () => {
    members = [member(1, 'Иван Петров', 'owner'), member(9, 'Пётр Второй', 'owner')]
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (opts?.method === 'DELETE') throw apiError(409, 'platform.staff_last_owner')
      throw new Error(`unexpected ${url}`)
    })
    await render()
    await openMenu(1, 'Удалить из команды')
    submit().click()
    await flushPromises()
    expect(alertText()).toBe('Последнего Owner нельзя понизить или удалить')
    expect(rowOf(1)).not.toBeNull()
    expect(wrapper!.emitted('self-changed')).toBeUndefined()
  })

  it('removing yourself tells the page: access ends with the next request', async () => {
    members = [member(1, 'Иван Петров', 'owner'), member(2, 'Анна Король', 'owner')]
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (opts?.method === 'DELETE') return { userId: 1 }
      throw new Error(`unexpected ${url}`)
    })
    await render(1)
    await openMenu(1, 'Удалить из команды')
    submit().click()
    await flushPromises()
    expect(wrapper!.emitted('self-changed')).toEqual([['removed']])
  })

  it('changing your own role tells the page to re-read the menu', async () => {
    members = [member(1, 'Иван Петров', 'owner'), member(2, 'Анна Король', 'owner')]
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API) return { members }
      if (opts?.method === 'PATCH') return member(1, 'Иван Петров', 'admin')
      throw new Error(`unexpected ${url}`)
    })
    await render(1)
    await openMenu(1, 'Изменить роль')
    await chooseRole('admin')
    submit().click()
    await flushPromises()
    expect(wrapper!.emitted('self-changed')).toEqual([['role']])
  })

  it('«Пригласить»: email or Telegram and a role, POST, the person is added', async () => {
    const invited = member(7, 'Олег Дубов', 'finance')
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API && !opts) return { members }
      if (url === API && opts?.method === 'POST') return invited
      throw new Error(`unexpected ${url}`)
    })
    const w = await render()
    await w.get('[data-testid="staff-invite"]').trigger('click')
    await flushPromises()
    expect(dialog()!.textContent).toContain('Пригласить в команду')
    expect(radios()).toEqual(['admin', 'finance', 'moderator', 'support', 'analyst'])
    await typeUser('  oleg@volleytime.by ')
    await chooseRole('finance')
    submit().click()
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(API, {
      method: 'POST',
      body: { user: 'oleg@volleytime.by', role: 'finance' },
    })
    expect(rowOf(7)!.textContent).toContain('Finance')
    expect(dialog()).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('В команде: Олег Дубов')
  })

  it('invitation: nothing is sent while the person or the role is missing', async () => {
    const w = await render()
    await w.get('[data-testid="staff-invite"]').trigger('click')
    await flushPromises()
    expect(submit().disabled).toBe(true)
    await typeUser('oleg@volleytime.by')
    expect(submit().disabled).toBe(true)
    await chooseRole('support')
    expect(submit().disabled).toBe(false)
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [404, 'platform.staff_user_not_found', 'Пользователь с таким email или Telegram не найден'],
    [409, 'platform.staff_exists', 'Этот человек уже в команде платформы'],
    [409, 'platform.staff_user_ambiguous', 'Найдено несколько пользователей: укажите email'],
    [409, 'platform.staff_user_inactive', 'Пользователь заблокирован: пригласить его нельзя'],
  ])('invitation %s %s is shown in the dialog', async (status, code, text) => {
    apiFetch.mockImplementation(async (url: string, opts?: Opts) => {
      if (url === API && !opts) return { members }
      throw apiError(status, code)
    })
    const w = await render()
    await w.get('[data-testid="staff-invite"]').trigger('click')
    await flushPromises()
    await typeUser('x@y.by')
    await chooseRole('analyst')
    submit().click()
    await flushPromises()
    expect(alertText()).toBe(text)
    expect(dialog()).not.toBeNull()
    expect(body().querySelectorAll('[data-testid^="staff-row-"]')).toHaveLength(3)
  })

  it('shows the role matrix: 14 rights by 6 roles, view-only and partial cells', async () => {
    const w = await render()
    const table = w.get('table[aria-label="Матрица ролей"]')
    expect(table.findAll('thead th').map((th) => th.text())).toEqual([
      'Право',
      'Owner',
      'Admin',
      'Finance',
      'Moderator',
      'Support',
      'Analyst',
    ])
    expect(table.findAll('tbody tr')).toHaveLength(14)
    const row = (label: string) =>
      table.findAll('tbody tr').find((r) => r.text().startsWith(label))!
    expect(
      row('Жалобы на страницы')
        .findAll('td')
        .map((c) => c.text()),
    ).toContain('отклонить')
    expect(
      row('Тарифы и пакеты')
        .findAll('td')
        .map((c) => c.text()),
    ).toContain('просмотр')
    // полный доступ читается и без цвета: «есть» в тексте для скринридера
    expect(row('Команда, безопасность, API').text()).toContain('есть')
    expect(w.text()).toContain('Разделы без доступа скрыты из меню')
  })
})
