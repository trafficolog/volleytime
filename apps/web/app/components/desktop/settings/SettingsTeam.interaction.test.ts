// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import SettingsTeam from './SettingsTeam.vue'
import { makeController, stubs } from './settings-fixtures'

const fetchMock = vi.fn()
const writeText = vi.fn()

const member = (id: number, userId: number, name: string, over: Record<string, unknown> = {}) => ({
  id,
  role: 'player',
  roles: ['player'],
  canAcceptPayment: false,
  status: 'active',
  user: { id: userId, name, image: null },
  ...over,
})

function team() {
  return [
    member(1, 11, 'Иван Петренко', { role: 'owner', roles: ['owner', 'player'], leads: [] }),
    member(2, 12, 'Анна Сидорова', {
      role: 'organizer',
      roles: ['organizer', 'player'],
      leads: [],
    }),
    member(3, 13, 'Ольга Романова', {
      role: 'coach',
      roles: ['coach', 'player'],
      canAcceptPayment: true,
      leads: [
        { id: 31, title: 'Основа', startsAt: '2026-12-02T09:00:00.000Z', seriesId: 5 },
        { id: 32, title: 'Основа', startsAt: '2026-12-04T09:00:00.000Z', seriesId: 5 },
      ],
    }),
    member(4, 14, 'Дмитрий Ковалёв', {
      role: 'coach',
      roles: ['coach', 'player'],
      leads: [{ id: 41, title: 'Микст', startsAt: '2026-12-06T09:00:00.000Z', seriesId: 6 }],
    }),
    member(5, 15, 'Соня Игрокова', { leads: [] }),
    member(6, 16, 'Бывший Тренер', { role: 'coach', roles: ['coach', 'player'], status: 'left' }),
  ]
}

const history = () => [
  {
    id: 9,
    userId: 11,
    entityId: 3,
    createdAt: '2026-05-24T15:02:00.000Z',
    oldValue: { role: 'coach', canAcceptPayment: false },
    newValue: { role: 'coach', canAcceptPayment: true },
  },
]

function route(
  extra: Record<string, (url: string, init?: { method?: string; body?: unknown }) => unknown> = {},
) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    for (const [prefix, handler] of Object.entries(extra)) {
      if (url.startsWith(prefix)) return Promise.resolve(handler(url, init))
    }
    if (url.includes('/members?')) return Promise.resolve({ members: team() })
    if (url.includes('/audit?')) return Promise.resolve({ entries: history() })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  writeText.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountTeam(canEdit = true) {
  const ctx = makeController()
  const wrapper = mount(SettingsTeam, {
    props: {
      org: ctx.org.value,
      base: '/app/orgs/7',
      canEdit,
      controller: ctx.controller,
      orgId: 7,
      timeZone: 'Europe/Minsk',
    },
    global: { stubs },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
type Wrapper = Awaited<ReturnType<typeof mountTeam>>

const rowOf = (wrapper: Wrapper, name: string) =>
  wrapper.findAll('tbody tr').find((r) => r.text().includes(name))!
async function openMenu(wrapper: Wrapper, name: string) {
  await rowOf(wrapper, name).find('button[aria-haspopup="menu"]').trigger('click')
  await flushPromises()
}
const menuItem = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('[role="menuitem"]').find((i) => i.text().includes(text))

describe('SettingsTeam: таблица команды', () => {
  it('loads all statuses and the role history of the group', async () => {
    route()
    await mountTeam()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizations/7/members?statuses=active,pending,guest,blocked,left,rejected',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizations/7/audit?action=member.role_changed&entityType=member&limit=20',
    )
  })

  it('lists the team with roles and what each person leads, without players and ex-members', async () => {
    route()
    const wrapper = await mountTeam()
    const names = wrapper.findAll('.vt-team-person__name').map((n) => n.text())
    expect(names).toEqual(['Иван Петренко', 'Анна Сидорова', 'Ольга Романова', 'Дмитрий Ковалёв'])
    expect(rowOf(wrapper, 'Иван').text()).toContain('Владелец')
    expect(rowOf(wrapper, 'Иван').text()).toContain('Игрок')
    expect(rowOf(wrapper, 'Иван').text()).toContain('все события')
    expect(rowOf(wrapper, 'Анна').text()).toContain('Организатор')
    expect(rowOf(wrapper, 'Ольга').text()).toContain('Основа · Ср, Пт')
    expect(rowOf(wrapper, 'Дмитрий').text()).toContain('Микст · Вс')
  })

  it('shows the payment switch for coaches only', async () => {
    route()
    const wrapper = await mountTeam()
    expect(rowOf(wrapper, 'Иван').find('[role="switch"]').exists()).toBe(false)
    expect(rowOf(wrapper, 'Иван').text()).toContain('по роли')
    expect(rowOf(wrapper, 'Анна').find('[role="switch"]').exists()).toBe(false)
    const olga = rowOf(wrapper, 'Ольга').find('[role="switch"]')
    expect(olga.attributes('aria-checked')).toBe('true')
    expect(olga.attributes('aria-label')).toBe('Приём оплаты · Ольга Романова')
    expect(rowOf(wrapper, 'Ольга').text()).toContain('разрешено')
    const dmitry = rowOf(wrapper, 'Дмитрий').find('[role="switch"]')
    expect(dmitry.attributes('aria-checked')).toBe('false')
    expect(rowOf(wrapper, 'Дмитрий').text()).toContain('нет')
  })

  it('grants payment acceptance, toasts and reloads the history', async () => {
    route({
      '/api/organizations/7/members/4': () => ({
        member: { id: 4, role: 'coach', roles: ['coach', 'player'], canAcceptPayment: true },
      }),
    })
    const wrapper = await mountTeam()
    await rowOf(wrapper, 'Дмитрий').find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/members/4', {
      method: 'PATCH',
      body: { canAcceptPayment: true },
    })
    expect(rowOf(wrapper, 'Дмитрий').find('[role="switch"]').attributes('aria-checked')).toBe(
      'true',
    )
    expect(wrapper.emitted('toast')?.[0]?.[0]).toContain('Дмитрий Ковалёв принимает оплату')
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/audit?'))).toHaveLength(2)
  })

  it('keeps the switch and reports the error when the server refuses', async () => {
    route({
      '/api/organizations/7/members/3': () => {
        throw new Error('403')
      },
    })
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/members/3')) return Promise.reject(new Error('403'))
      if (url.includes('/members?')) return Promise.resolve({ members: team() })
      return Promise.resolve({ entries: [] })
    })
    const wrapper = await mountTeam()
    await rowOf(wrapper, 'Ольга').find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(rowOf(wrapper, 'Ольга').find('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Не удалось изменить приём оплаты', 'danger'])
  })
})

describe('SettingsTeam: действия', () => {
  it('offers only the ownership transfer on the owner row and opens the danger zone', async () => {
    route()
    const wrapper = await mountTeam()
    await openMenu(wrapper, 'Иван')
    expect(wrapper.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['Передать владение'])
    await menuItem(wrapper, 'Передать владение')!.trigger('click')
    expect(wrapper.emitted('openSection')?.[0]).toEqual(['danger'])
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('makes a coach an organizer and the other way round', async () => {
    route({
      '/api/organizations/7/members/4': () => ({
        member: {
          id: 4,
          role: 'organizer',
          roles: ['organizer', 'player'],
          canAcceptPayment: false,
        },
      }),
      '/api/organizations/7/members/2': () => ({
        member: { id: 2, role: 'coach', roles: ['coach', 'player'], canAcceptPayment: false },
      }),
    })
    const wrapper = await mountTeam()
    await openMenu(wrapper, 'Дмитрий')
    await menuItem(wrapper, 'Сделать организатором')!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/members/4', {
      method: 'PATCH',
      body: { role: 'organizer' },
    })
    expect(rowOf(wrapper, 'Дмитрий').text()).toContain('Организатор')
    expect(rowOf(wrapper, 'Дмитрий').find('[role="switch"]').exists()).toBe(false)
    expect(wrapper.emitted('toast')?.[0]).toEqual([
      'Дмитрий Ковалёв · роль изменена · записано в историю',
      'ok',
    ])

    await openMenu(wrapper, 'Анна')
    await menuItem(wrapper, 'Сделать тренером')!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/members/2', {
      method: 'PATCH',
      body: { role: 'coach' },
    })
    expect(rowOf(wrapper, 'Анна').find('[role="switch"]').exists()).toBe(true)
  })

  it('asks before removing from the team, then leaves the person a player', async () => {
    route({
      '/api/organizations/7/members/3': () => ({
        member: { id: 3, role: 'player', roles: ['player'], canAcceptPayment: false },
      }),
    })
    const wrapper = await mountTeam()
    await openMenu(wrapper, 'Ольга')
    await menuItem(wrapper, 'Убрать из команды')!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Убрать Ольга Романова из команды?')
    expect(dialog.textContent).toContain('останется в группе игроком')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    const confirm = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Убрать',
    )!
    confirm.click()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/members/3', {
      method: 'PATCH',
      body: { role: 'player' },
    })
    expect(wrapper.findAll('.vt-team-person__name').map((n) => n.text())).not.toContain(
      'Ольга Романова',
    )
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Ольга Романова теперь игрок', 'ok'])
  })

  it('reports a refused role change and keeps the row', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/members/4')) return Promise.reject(new Error('403'))
      if (url.includes('/members?')) return Promise.resolve({ members: team() })
      return Promise.resolve({ entries: [] })
    })
    const wrapper = await mountTeam()
    await openMenu(wrapper, 'Дмитрий')
    await menuItem(wrapper, 'Сделать организатором')!.trigger('click')
    await flushPromises()
    expect(rowOf(wrapper, 'Дмитрий').text()).toContain('Тренер')
    expect(wrapper.emitted('toast')?.[0]).toEqual(['Не удалось изменить роль', 'danger'])
  })
})

describe('SettingsTeam: приглашение', () => {
  async function openInvite(wrapper: Wrapper) {
    await wrapper
      .findAll('button[aria-haspopup="menu"]')
      .find((b) => b.text().includes('Пригласить'))!
      .trigger('click')
  }

  it('creates a single-use 24 hour link for the chosen role and copies it', async () => {
    route({
      '/api/organizations/7/invites': () => ({
        invite: { id: 1 },
        deeplinkUrl: 'https://t.me/bot?startapp=inv_x',
      }),
    })
    const wrapper = await mountTeam()
    await openInvite(wrapper)
    await flushPromises()
    await menuItem(wrapper, 'Пригласить тренером')!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/7/invites', {
      method: 'POST',
      body: { roleToAssign: 'coach', expiresInDays: 1, maxUses: 1, defaultMemberStatus: 'active' },
    })
    expect(writeText).toHaveBeenCalledWith('https://t.me/bot?startapp=inv_x')
    expect(wrapper.emitted('toast')?.[0]).toEqual([
      'Ссылка-приглашение в команду скопирована · действует 24 ч',
      'ok',
    ])
  })

  it('shows the link for manual copy when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    route({
      '/api/organizations/7/invites': () => ({
        invite: { id: 1 },
        deeplinkUrl: 'https://t.me/bot?startapp=inv_y',
      }),
    })
    const wrapper = await mountTeam()
    await openInvite(wrapper)
    await flushPromises()
    await menuItem(wrapper, 'Пригласить организатором')!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizations/7/invites',
      expect.objectContaining({ body: expect.objectContaining({ roleToAssign: 'organizer' }) }),
    )
    const field = wrapper.find('input[readonly]')
    expect((field.element as HTMLInputElement).value).toBe('https://t.me/bot?startapp=inv_y')
    expect(wrapper.emitted('toast')?.[0]?.[1]).toBe('danger')
  })

  it('hides the invite button without edit rights', async () => {
    route()
    const wrapper = await mountTeam(false)
    expect(wrapper.text()).not.toContain('Пригласить')
  })
})

describe('SettingsTeam: матрица и история', () => {
  it('renders the role matrix with the organizer read-only on the event balance', async () => {
    route()
    const wrapper = await mountTeam()
    const matrix = wrapper.find('.vt-team-matrix')
    expect(matrix.findAll('thead th').map((h) => h.text())).toContain('Организатор')
    const balance = matrix.findAll('tbody tr').find((r) => r.text().startsWith('Баланс событий'))!
    expect(balance.text()).toContain('только просмотр')
    const payments = matrix.findAll('tbody tr').find((r) => r.text().startsWith('Приём'))!
    expect(payments.text()).toContain('если разрешено')
  })

  it('shows the role history with the author and the person', async () => {
    route()
    const wrapper = await mountTeam()
    const line = wrapper.find('.vt-team-history')
    expect(line.text()).toContain('24 мая 18:02')
    expect(line.text()).toContain('Иван Петренко: Ольга Романова — приём оплаты разрешён')
  })

  it('shows an empty history and a history error without hiding the team', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/audit?')) return Promise.reject(new Error('x'))
      return Promise.resolve({ members: team() })
    })
    const wrapper = await mountTeam()
    expect(wrapper.find('#team-history-title').exists()).toBe(true)
    expect(wrapper.text()).toContain('Не удалось загрузить историю')
    expect(wrapper.findAll('.vt-team-person__name')).toHaveLength(4)
  })

  it('shows a load error and retries', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/audit?')) return Promise.resolve({ entries: [] })
      return Promise.reject(new Error('x'))
    })
    const wrapper = await mountTeam()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось загрузить команду')
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/audit?')) return Promise.resolve({ entries: [] })
      return Promise.resolve({ members: team() })
    })
    await wrapper.find('.vt-settings-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.vt-team-person__name')).toHaveLength(4)
  })
})

describe('SettingsTeam: назначить на серию', () => {
  const events = () => ({
    events: [
      {
        id: 1,
        title: 'Основа',
        startsAt: '2026-12-02T09:00:00.000Z',
        status: 'published',
        seriesId: 5,
        seriesDate: '2026-12-02',
        coachUserIds: [13],
      },
      {
        id: 2,
        title: 'Микст',
        startsAt: '2026-12-06T09:00:00.000Z',
        status: 'published',
        seriesId: 6,
        seriesDate: '2026-12-06',
        coachUserIds: [14, 16],
      },
      {
        id: 3,
        title: 'Микст',
        startsAt: '2026-12-13T09:00:00.000Z',
        status: 'published',
        seriesId: 6,
        seriesDate: '2026-12-13',
        coachUserIds: [14, 12],
      },
    ],
  })

  async function openSeries(wrapper: Wrapper, name: string) {
    await openMenu(wrapper, name)
    await menuItem(wrapper, 'Назначить на серию')!.trigger('click')
    await flushPromises()
  }

  it('adds the coach to the template and to every date, keeping the coaches of single dates and dropping a stale one', async () => {
    route({
      '/api/organizations/7/events': events,
      '/api/organizations/7/series/6?scope': () => ({ updated: 3, events: [] }),
      '/api/organizations/7/series/6': () => ({ series: { template: { coachUserIds: [14, 16] } } }),
    })
    const wrapper = await mountTeam()
    // Ольга (13) → серия «Микст»: 16 ушёл из группы и отбрасывается, 12 только на одной дате сохраняется
    await openSeries(wrapper, 'Ольга')
    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Назначить на серию: Ольга Романова')
    const radios = [...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios).toHaveLength(2)
    radios[1]!.click()
    radios[1]!.dispatchEvent(new Event('change'))
    await flushPromises()
    const submit = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Назначить',
    )!
    submit.click()
    await flushPromises()
    const patches = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([url, init]) => [url, init.body.coachUserIds])
    expect(patches).toEqual([
      // шаблон: только он, даты не затронуты (дата позже всех дат серии)
      ['/api/organizations/7/series/6?scope=following&from=9999-12-31', [14, 13]],
      // каждая дата получает добавку к СВОЕМУ списку тренеров
      ['/api/organizations/7/series/6?scope=single&from=2026-12-06', [14, 13]],
      ['/api/organizations/7/series/6?scope=single&from=2026-12-13', [14, 12, 13]],
    ])
    expect(
      wrapper.emitted('toast')?.some(([m]) => String(m).includes('назначен на серию «Микст»')),
    ).toBe(true)
    // состав перечитан: у человека обновится колонка «Ведёт»
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/members?'))).toHaveLength(2)
  })

  it('does not patch when the person already leads the series', async () => {
    route({
      '/api/organizations/7/events': events,
      '/api/organizations/7/series/5': () => ({ series: { template: { coachUserIds: [13] } } }),
    })
    const wrapper = await mountTeam()
    await openSeries(wrapper, 'Ольга')
    const dialog = document.body.querySelector('[role="dialog"]')!
    ;[...dialog.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Назначить')!
      .click()
    await flushPromises()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    expect(
      wrapper.emitted('toast')?.some(([m]) => String(m).includes('уже ведёт серию «Основа»')),
    ).toBe(true)
  })

  it('says so when the group has no upcoming series', async () => {
    route({ '/api/organizations/7/events': () => ({ events: [] }) })
    const wrapper = await mountTeam()
    await openSeries(wrapper, 'Ольга')
    expect(document.body.textContent).toContain('Предстоящих серий нет')
  })
})
