// @vitest-environment happy-dom
import { BookInput } from '@volley-time/core'
import type { EventPricingView } from '@volley-time/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watch,
  watchEffect,
} from 'vue'

import Page from './index.vue'

import PlayerInviteCard from '~/components/PlayerInviteCard.vue'
import MyChip from '~/components/vt/MyChip.vue'
import SeatsMini from '~/components/vt/SeatsMini.vue'
import StateChip from '~/components/vt/StateChip.vue'
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '~/utils/api-error'
import {
  readStashedInviteToken,
  stashInviteToken,
  type InviteAccessView,
} from '~/utils/player-invite'

/**
 * Task 20.4.7 (M-08, D-06): событие «по приглашению» в Mini App — четыре состояния, запрос и
 * отзыв запроса, токен личной ссылки в записи, запись закрыта без приглашения. API замокан.
 */
const NOW = new Date('2027-10-03T10:00:00Z')
const route = reactive({ params: { orgId: '30', eventId: '71' }, fullPath: '/m/orgs/30/events/71' })
const pricing = (): EventPricingView => ({
  mode: 'fixed',
  targetAmount: null,
  settledAt: null,
  participantCount: 0,
  minAmount: 1500,
  maxAmount: 1500,
  basis: 'fixed',
  myAllocatedAmount: null,
  myPaymentStatus: null,
})
const fixture = () => ({
  id: 71,
  organizationId: 30,
  title: 'Открытая игра',
  status: 'published',
  joinMode: 'invite' as 'open' | 'invite',
  startsAt: '2027-10-04T16:00:00Z',
  endsAt: '2027-10-04T18:00:00Z',
  capacity: 14,
  taken: 9,
  players: 9,
  freeSeats: 5,
  waitlist: 0,
  price: 1500,
  currency: 'BYN',
  description: null,
  cancellationDeadlineHours: null as number | null,
  bookingOpensAt: null as string | null,
  venue: null,
  locationText: null,
  pricing: pricing(),
  myBooking: null,
})
const organizer = { name: 'Иван Петренко', telegramUsername: null, image: null }
const access = (over: Partial<InviteAccessView> = {}): InviteAccessView => ({
  state: 'none',
  request: null,
  invite: null,
  organizer,
  ...over,
})
const linkInvite = (expiresAt = '2027-10-04T14:00:00Z') => ({
  source: 'link' as const,
  expiresAt,
  inviter: organizer,
})
const orgFixture = (role = 'player') => ({
  organization: { id: 30, subscriptionsEnabled: false, maxSeatsPerBooking: 1 },
  myMember: { organizationId: 30, role, status: 'active' },
  capabilities: { eventMultiSeat: false, eventScheduler: false },
})
type PageData = { event: ReturnType<typeof fixture>; roster: unknown[]; serverNow?: string }
let data = ref<PageData>({ event: fixture(), roster: [] })
let org = ref(orgFixture())
let inviteAccess: InviteAccessView = access()
let inviteAccessFails = false
const refresh = vi.fn(async () => undefined)
const post = vi.fn(
  async (
    url: string,
    _opts?: { method?: string; body?: unknown; query?: unknown },
  ): Promise<unknown> => {
    if (url.endsWith('/invite-access')) {
      if (inviteAccessFails) throw new Error('offline')
      return { access: inviteAccess }
    }
    return {}
  },
)
let inTelegram = false
const mainButtonUpdate = vi.fn()
let wrapper: Awaited<ReturnType<typeof render>> | undefined

async function render() {
  const mounted = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Page) }) }),
    {
      attachTo: document.body,
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span data-chip><slot /></span>' },
          VtMyChip: MyChip,
          VtStateChip: StateChip,
          VtSeatsMini: SeatsMini,
          VtIcon: true,
          VtMeter: true,
          VtAvatar: true,
          SkeletonList: true,
          PlayerInviteCard,
          PlayerBookingForm: true,
          VtSheet: true,
          ErrorState: { props: ['message'], template: '<div role="alert">{{ message }}</div>' },
        },
      },
    },
  )
  await flushPromises()
  return mounted
}
const button = (label: string) => wrapper!.findAll('button').find((b) => b.text().startsWith(label))
const callsTo = (suffix: string) => post.mock.calls.filter(([url]) => url.endsWith(suffix))

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    now: NOW,
  })
  data = ref<PageData>({ event: fixture(), roster: [] })
  org = ref(orgFixture())
  inviteAccess = access()
  inviteAccessFails = false
  route.params = { orgId: '30', eventId: '71' }
  route.fullPath = '/m/orgs/30/events/71'
  refresh.mockReset().mockResolvedValue(undefined)
  post.mockClear()
  inTelegram = false
  mainButtonUpdate.mockClear()
  window.sessionStorage.clear()
  Object.entries({
    computed,
    ref,
    watch,
    watchEffect,
    onMounted,
    onUnmounted,
    createMainButton: () => ({ update: mainButtonUpdate, destroy: vi.fn() }),
    definePageMeta: () => undefined,
    useRoute: () => route,
    useOrgTimezone: () => ({ tz: 'Europe/Minsk' }),
    useTelegram: () => ({
      confirm: vi.fn(async () => true),
      haptic: vi.fn(),
      isTelegram: ref(inTelegram),
      webApp: undefined,
    }),
    $fetch: post,
    refreshNuxtData: vi.fn(async () => undefined),
    apiErrorCode,
    apiErrorMessage,
    apiErrorStatus,
    useFetch: (url: string | (() => string)) => {
      const path = typeof url === 'function' ? url() : url
      if (path === '/api/levels')
        return { data: ref({ levels: [] }), error: ref(null), pending: ref(false) }
      return {
        data: path.endsWith('/30') ? org : data,
        error: ref(null),
        pending: ref(false),
        refresh,
      }
    },
  }).forEach(([name, value]) => vi.stubGlobal(name, value))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('event page: invite-only booking (M-08)', () => {
  it('free events never ask for invite state and keep the booking button', async () => {
    data.value.event.joinMode = 'open'
    wrapper = await render()
    expect(callsTo('/invite-access')).toHaveLength(0)
    expect(wrapper.find('[data-invite-card]').exists()).toBe(false)
    expect(button('Записаться')).toBeTruthy()
  })

  it('none: chip, explanation, request button; booking is closed', async () => {
    wrapper = await render()
    expect(callsTo('/invite-access')[0]?.[1]).toMatchObject({ method: 'POST', body: {} })
    expect(wrapper.text()).toContain('по приглашению')
    expect(wrapper.text()).toContain('Организатор сам решает')
    expect(button('Записаться')).toBeUndefined()
    await button('Запросить приглашение')!.trigger('click')
    await flushPromises()
    const asked = callsTo('/events/71/invite-requests')
    expect(asked).toHaveLength(1)
    expect(asked[0]?.[1]).toMatchObject({ method: 'POST' })
    // после запроса состояние перечитывается
    expect(callsTo('/invite-access').length).toBeGreaterThan(1)
  })

  it('requested: timeline, disabled booking, withdraw posts cancel for the own request', async () => {
    inviteAccess = access({
      state: 'requested',
      request: { id: 9, status: 'pending', createdAt: '2027-10-03T09:30:00Z' },
    })
    wrapper = await render()
    expect(wrapper.text()).toContain('запрос отправлен')
    expect(wrapper.text()).toContain('Ваш запрос')
    expect(button('Записаться')!.attributes('disabled')).toBeDefined()
    expect(button('Запросить')).toBeUndefined()
    await button('Отозвать запрос')!.trigger('click')
    await flushPromises()
    const cancels = callsTo('/events/71/invite-requests/9/cancel')
    expect(cancels).toHaveLength(1)
    expect(cancels[0]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('a failed withdrawal shows the reason and re-reads the state', async () => {
    inviteAccess = access({
      state: 'requested',
      request: { id: 9, status: 'pending', createdAt: '2027-10-03T09:30:00Z' },
    })
    wrapper = await render()
    post.mockImplementationOnce(async () => {
      throw { statusCode: 409, data: { data: { code: 'invite_request.not_pending' } } }
    })
    // первый вызов после рендера — отзыв; последующий invite-access возвращает ответ организатора
    inviteAccess = access({ state: 'invited', invite: { ...linkInvite(), source: 'request' } })
    await button('Отозвать запрос')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Организатор уже ответил на запрос')
    expect(wrapper.text()).toContain('вы приглашены')
  })

  it('invited by the personal link: token goes in the body and into the booking, then is cleared', async () => {
    stashInviteToken(71, 'tok-personal-link-123456')
    inviteAccess = access({ state: 'invited', invite: linkInvite() })
    wrapper = await render()
    expect(callsTo('/invite-access')[0]?.[1]).toMatchObject({
      body: { inviteToken: 'tok-personal-link-123456' },
    })
    expect(wrapper.text()).toContain('вы приглашены')
    expect(wrapper.text()).toContain('Иван Петренко пригласил вас')
    expect(wrapper.text()).toContain('Ссылка одноразовая и действует до')
    expect(button('Записаться · ')!.text()).toContain('15,00')
    // бесплатное событие записывает сразу, без листа оплаты
    data.value.event.price = 0
    await flushPromises()
    await button('Записаться')!.trigger('click')
    await flushPromises()
    const body = callsTo('/events/71/bookings')[0]?.[1]?.body
    expect(body).toEqual({ method: 'free', inviteToken: 'tok-personal-link-123456' })
    BookInput.parse(body)
    expect(readStashedInviteToken(71)).toBeNull()
  })

  it('a stashed token that gave no link invite (revoked, used, foreign, expired) is cleared (m-1)', async () => {
    stashInviteToken(71, 'dead-token-0123456789')
    inviteAccess = access({ state: 'none' })
    wrapper = await render()
    expect(callsTo('/invite-access')[0]?.[1]).toMatchObject({
      body: { inviteToken: 'dead-token-0123456789' },
    })
    expect(readStashedInviteToken(71)).toBeNull()
    wrapper.unmount()

    stashInviteToken(71, 'old-token-0123456789')
    inviteAccess = access({ state: 'expired', invite: linkInvite('2027-10-02T14:00:00Z') })
    wrapper = await render()
    expect(readStashedInviteToken(71)).toBeNull()
    wrapper.unmount()

    // действующая ссылка токен сохраняет: он нужен записи
    stashInviteToken(71, 'live-token-0123456789')
    inviteAccess = access({ state: 'invited', invite: linkInvite() })
    wrapper = await render()
    expect(readStashedInviteToken(71)).toBe('live-token-0123456789')
  })

  it('a full event does not offer the waitlist to an uninvited player (20.4.11 × M-08)', async () => {
    data.value.event.freeSeats = 0
    data.value.event.taken = 14
    for (const state of ['none', 'requested', 'expired'] as const) {
      inviteAccess = access({
        state,
        request:
          state === 'requested'
            ? { id: 9, status: 'pending', createdAt: '2027-10-03T09:30:00Z' }
            : null,
        invite: state === 'expired' ? linkInvite('2027-10-02T14:00:00Z') : null,
      })
      wrapper = await render()
      expect(wrapper.text(), state).not.toContain('Встать в лист ожидания')
      expect(wrapper.text(), state).not.toContain('вы встанете в лист ожидания')
      wrapper.unmount()
    }
    // приглашённый — может встать в очередь
    inviteAccess = access({ state: 'invited', invite: linkInvite() })
    wrapper = await render()
    expect(button('Встать в лист ожидания')).toBeTruthy()
  })

  it('inside Telegram a full invite event gives an uninvited player no waitlist MainButton', async () => {
    inTelegram = true
    data.value.event.freeSeats = 0
    data.value.event.taken = 14
    wrapper = await render()
    expect(mainButtonUpdate).toHaveBeenLastCalledWith(null)
  })

  it('invited by an approved request: no token is sent even if one is stashed', async () => {
    stashInviteToken(71, 'stale-token-0123456789')
    inviteAccess = access({ state: 'invited', invite: { ...linkInvite(), source: 'request' } })
    data.value.event.price = 0
    wrapper = await render()
    await button('Записаться')!.trigger('click')
    await flushPromises()
    expect(callsTo('/events/71/bookings')[0]?.[1]?.body).toEqual({ method: 'free' })
  })

  it('expired: red card, request a new invite, link to other events', async () => {
    inviteAccess = access({
      state: 'expired',
      invite: linkInvite('2027-10-02T14:00:00Z'),
    })
    wrapper = await render()
    expect(wrapper.text()).toContain('ссылка просрочена')
    expect(wrapper.get('[role="alert"]').text()).toContain('Ссылка больше не действует')
    expect(button('Записаться')).toBeUndefined()
    expect(wrapper.find('a[href="/m/orgs/30/events"]').text()).toBe('Другие события группы')
    await button('Запросить новое приглашение')!.trigger('click')
    await flushPromises()
    expect(callsTo('/events/71/invite-requests')).toHaveLength(1)
  })

  it('owner and organizer book themselves without an invite (D-06 C)', async () => {
    org.value = orgFixture('organizer')
    wrapper = await render()
    expect(callsTo('/invite-access')).toHaveLength(0)
    expect(wrapper.find('[data-invite-card]').exists()).toBe(false)
    expect(button('Записаться')).toBeTruthy()
  })

  it('fails closed: unknown invite state keeps booking closed', async () => {
    inviteAccessFails = true
    wrapper = await render()
    expect(button('Записаться')).toBeUndefined()
    expect(wrapper.find('[data-invite-card]').exists()).toBe(false)
  })

  it('inside Telegram the MainButton is shown only for an invited player', async () => {
    inTelegram = true
    wrapper = await render()
    expect(mainButtonUpdate).toHaveBeenLastCalledWith(null)
    wrapper.unmount()
    mainButtonUpdate.mockClear()
    inviteAccess = access({ state: 'invited', invite: linkInvite() })
    wrapper = await render()
    expect(mainButtonUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Записаться · 15,00 BYN' }),
    )
  })
})
