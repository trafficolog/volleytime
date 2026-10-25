<script setup lang="ts">
import type { Event, Organization, OrganizationMember, Subscription } from '@volley-time/db'
import {
  formatDay,
  formatTime,
  type EventPriceQuote,
  type EventPricingView,
} from '@volley-time/shared'

import {
  type BookingMethodOption,
  bookingSubmitLabel,
  canSubmitBooking,
  clampSeats,
  maxSeatsFor,
  offerCountdown,
  offerDeadlineLabel,
  planSeats,
  playersWord,
  seatsLabel,
} from '~/utils/booking-seats'
import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { displayName, formatMoneyRu } from '~/utils/labels'
import {
  CANCEL_REFUND_NOTE,
  cancelConfirmText,
  cancelMayReleasePaidSeats,
  seatsCancelConfirmText,
} from '~/utils/player-booking-cancel'
import {
  bookingPaymentChip,
  playerEventLoadErrorNotice,
  playerEventPageState,
  playerEventReady,
  projectPlayerEvent,
} from '~/utils/player-event'
import {
  bookingPayload,
  runPlayerEventAction,
  shouldRefreshPlayerEventAfterRejection,
} from '~/utils/player-event-action'
import { playerHomeAccess } from '~/utils/player-home'
import {
  clearStashedInviteToken,
  compactRoster,
  inviteBookingToken,
  inviteChip,
  inviteGate,
  readStashedInviteToken,
  type InviteAccessView,
} from '~/utils/player-invite'
import { levelTitle, type PlayerLevelView } from '~/utils/player-level'
import { playerSplitViewOf, quotePriceLabel } from '~/utils/player-price-view'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
import { waitlistPeopleLabel } from '~/utils/status-model'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type EventDetails = Event & {
  pricing: EventPricingView
  taken: number
  /** Игроков в составе: меньше `taken`, когда кто-то занял несколько мест (20.1.2). */
  players?: number
  waitlist: number
  /** Мест в очереди (для листа записи); `waitlist` — люди (20.4.11). */
  waitlistSeats?: number
  /** Режим записи (20.1.3): `invite` — только по приглашению организатора. */
  joinMode?: 'open' | 'invite'
  /** Свободные места для новой записи с учётом удерживаемых предложениями (20.3.1). */
  freeSeats?: number
  myBooking: {
    id: number
    status: string
    method: string
    paymentId: number | null
    seats?: number
    waitlistSeats?: number
    offer?: { id: number; seats: number; expiresAt: string } | null
    /** Место в очереди (1 — первый), только у своей записи в очереди (20.4.11). */
    waitPos?: number | null
  } | null
  venue: { name: string; address: string | null } | null
}
interface RosterItem {
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  paid: boolean
  /** Места в записи: больше одного — «+N» в составе (20.1.2). */
  seats?: number
  /** Уровень В1–В4+ (`v1`…`v4_plus`), только для участников группы; null — не назначен. */
  level?: string | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const { tz } = useOrgTimezone(orgId)
const { haptic, confirm, isTelegram, webApp } = useTelegram()

const {
  data,
  error: loadError,
  pending: eventLoading,
  refresh,
} = await useFetch<{ event: EventDetails; roster: RosterItem[]; serverNow?: string }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
  { key: () => `player-event-${orgId.value}-${eventId.value}` },
)
const {
  data: orgData,
  error: orgError,
  pending: orgLoading,
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
  capabilities?: { eventMultiSeat?: boolean; eventScheduler?: boolean }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `player-event-org-${orgId.value}` })
const organization = computed(() =>
  orgData.value?.organization.id === orgId.value ? orgData.value.organization : null,
)
const access = computed(() =>
  playerHomeAccess(
    orgId.value,
    organization.value,
    orgData.value?.myMember ?? null,
    apiErrorCode(orgError.value),
  ),
)
const ev = computed(() =>
  data.value?.event.id === eventId.value && data.value.event.organizationId === orgId.value
    ? data.value.event
    : null,
)
const roster = computed(() => (ev.value ? (data.value?.roster ?? []) : []))
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const levels = computed(() => levelsData.value?.levels ?? [])
const sourceStatus = computed(() => ({
  eventMatches: !!ev.value,
  organizationMatches: !!organization.value,
  eventPending: eventLoading.value,
  organizationPending: orgLoading.value,
  eventError: !!loadError.value,
  organizationError: !!orgError.value,
}))
const sourcesReady = computed(() => playerEventReady(sourceStatus.value))
const pageState = computed(() =>
  playerEventPageState(access.value, sourceStatus.value, apiErrorCode(orgError.value)),
)
const isManager = computed(() => {
  const m = sourcesReady.value ? orgData.value?.myMember : null
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const subscriptionsEnabled = computed(() => organization.value?.subscriptionsEnabled ?? null)

const my = computed(() => ev.value?.myBooking ?? null)
/** Все места моей записи: основа и очередь (как в PATCH …/bookings/{id}). */
const myTotalSeats = computed(() =>
  my.value ? (my.value.seats ?? 1) + (my.value.waitlistSeats ?? 0) : 0,
)
const priceLabel = computed(() =>
  ev.value ? eventPricingLabel(ev.value.pricing, ev.value.currency) : null,
)
const paymentLabel = computed(() =>
  ev.value && my.value ? splitBookingPaymentLabel(ev.value.pricing, my.value.status) : null,
)
const paymentChip = computed(() =>
  my.value ? bookingPaymentChip(my.value.status, ev.value?.pricing) : null,
)
// Часы экрана по времени сервера (часы телефона уходят): сдвиг берётся при каждой загрузке события.
// Один таймер: каждую секунду, пока есть предложение места; иначе — до ближайшего открытия или
// закрытия записи, затем экран перерисовывается и перечитывает событие (M2, M3, ревью #156).
const clockSkew = ref(0)
watch(
  () => data.value?.serverNow,
  (serverNow) => {
    const parsed = serverNow ? Date.parse(serverNow) : Number.NaN
    clockSkew.value = Number.isFinite(parsed) ? parsed - Date.now() : 0
  },
  { immediate: true },
)
const serverDate = () => new Date(Date.now() + clockSkew.value)
const now = ref(serverDate())
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= now.value)
const subs = ref<Subscription[]>([])
const eventView = computed(() =>
  sourcesReady.value && ev.value
    ? projectPlayerEvent(
        ev.value,
        {
          memberActive: access.value === 'active',
          subscriptionsEnabled: subscriptionsEnabled.value,
          hasEligibleSubscription: subs.value.length > 0,
          schedulerEnabled: orgData.value?.capabilities?.eventScheduler === true,
        },
        now.value,
      )
    : null,
)
// событие «по приглашению» (20.4.7, D-06): запись открыта только приглашённому; владелец и
// организатор записывают себя без приглашения (D-06 C). Пока состояние не получено — закрыта.
const inviteAccess = ref<InviteAccessView | null>(null)
const inviteLoaded = ref(false)
const gate = computed(() =>
  inviteGate({
    joinMode: ev.value?.joinMode ?? 'open',
    isManager: isManager.value,
    hasBooking: eventView.value?.hasBooking ?? false,
    loaded: inviteLoaded.value,
    access: inviteAccess.value,
  }),
)
const compact = computed(() =>
  compactRoster(
    roster.value.length,
    eventView.value?.freeSeats ?? Math.max(0, (ev.value?.capacity ?? 0) - (ev.value?.taken ?? 0)),
  ),
)
const inviteChipView = computed(() => (gate.value.state ? inviteChip(gate.value.state) : null))
const bookable = computed(
  () => eventView.value?.action !== 'none' && !!eventView.value && gate.value.canBook,
)
// шкала и действие считают занятость одинаково: места под предложениями из очереди заняты (M4)
const occupiedSeats = computed(() =>
  ev.value
    ? ev.value.capacity - (eventView.value?.freeSeats ?? ev.value.capacity - ev.value.taken)
    : 0,
)
/** В Telegram действие живёт на MainButton — панель не показываем (5.14.1). */
const showActionBar = computed(() => bookable.value && !isTelegram.value)

const offer = computed(() => eventView.value?.offer ?? null)
const offerLeft = computed(() =>
  offer.value ? offerCountdown(offer.value.expiresAt, now.value) : null,
)
const offerActive = computed(() => !!offer.value && offerLeft.value?.expired === false)
let clock: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | undefined
const stopClock = () => {
  if (clock) {
    clearInterval(clock)
    clearTimeout(clock)
  }
  clock = undefined
}
watch(
  [() => offer.value?.id, () => eventView.value?.nextBoundary?.getTime() ?? null, clockSkew],
  ([offerId, boundary]) => {
    stopClock()
    now.value = serverDate()
    if (typeof window === 'undefined') return
    if (offerId !== undefined) {
      clock = setInterval(() => {
        now.value = serverDate()
      }, 1000)
    } else if (boundary !== null) {
      // таймер не длиннее 2^31 мс; при срабатывании вид пересчитывается и событие перечитывается
      const wait = Math.min(Math.max(boundary - serverDate().getTime(), 0) + 50, 2_000_000_000)
      clock = setTimeout(() => {
        now.value = serverDate()
        void refresh()
      }, wait)
    }
  },
  { immediate: true },
)

// выбор мест (20.4.5): степпер виден только при EVENT_MULTI_SEAT_ENABLED и лимите группы > 1
const multiSeatEnabled = computed(() => orgData.value?.capabilities?.eventMultiSeat === true)
const maxSeats = computed(() =>
  ev.value
    ? maxSeatsFor({
        maxSeatsPerBooking: organization.value?.maxSeatsPerBooking,
        capacity: ev.value.capacity,
        multiSeatEnabled: multiSeatEnabled.value,
      })
    : 1,
)
const seats = ref(1)
const consent = ref(false)
const chosenMethod = ref('')
const plan = computed(() => planSeats(seats.value, eventView.value?.freeSeats ?? 0))
const queueOnly = computed(() => plan.value.kind === 'queue')
watch(maxSeats, (max) => {
  seats.value = clampSeats(seats.value, max)
})
// согласие относится к конкретному разбиению: сменилось число мест или очередь — спросить заново
watch([() => plan.value.kind, () => plan.value.queueSeats], () => {
  consent.value = false
})

const cancelDeadline = computed(() => {
  if (!ev.value || ev.value.cancellationDeadlineHours == null) return null
  return new Date(
    new Date(ev.value.startsAt).getTime() - ev.value.cancellationDeadlineHours * 3600_000,
  )
})
const canCancel = computed(() => eventView.value?.canCancel === true)
const noCancelExplanation = computed(() => {
  if (ev.value?.pricing.mode === 'split' && ev.value.pricing.myAllocatedAmount !== null)
    return 'Доля зафиксирована — для отмены напишите организатору.'
  if (cancelDeadline.value && new Date() > cancelDeadline.value)
    return 'Дедлайн отмены прошёл — если не сможете прийти, напишите организатору.'
  return 'Самостоятельная отмена недоступна — напишите организатору.'
})

// выбор способа
const sheetOpen = ref(false)
const submitting = ref(false)
const actionError = ref('')
/** D-14: после отмены с оплатой деньгами — что оплаченные места не возвращаются (до перезагрузки). */
const refundNotice = ref('')
const loadErrorNotice = computed(() =>
  playerEventLoadErrorNotice(apiErrorStatus(loadError.value), actionError.value),
)
const pathname = () => route.fullPath.split(/[?#]/, 1)[0]?.replace(/\/$/, '')
let currentViewKey: string | null = `${orgId.value}:${eventId.value}`
let alive = true
const confirmationGuard = createPlayerRequestGuard(() => route.fullPath)
const routeGuard = createPlayerRequestGuard(() => currentViewKey)
const optionsGuard = createPlayerRequestGuard(() => route.fullPath)

// цена split — только из ответа GET …/price (`quoteEventPrice`, 20.1.1, D-01 (B)), не из `pricing`
// события (`readEventPricing`). Запрос без `seats`: места моей записи или одно место (20.4.6).
const splitMode = computed(() => ev.value?.pricing.mode === 'split')
const priceQuote = ref<(EventPriceQuote & { currency: string }) | null>(null)
const priceFailed = ref(false)
let priceRequest = 0
async function loadPrice() {
  const request = ++priceRequest
  const current = ev.value
  if (!current || current.pricing.mode !== 'split' || current.status === 'cancelled') {
    priceQuote.value = null
    priceFailed.value = false
    return
  }
  const key = route.fullPath
  try {
    const res = await $fetch<{ price?: EventPriceQuote & { currency: string } }>(
      `/api/organizations/${current.organizationId}/events/${current.id}/price`,
    )
    if (!alive || request !== priceRequest || key !== route.fullPath) return
    priceQuote.value = res?.price?.mode === 'split' ? res.price : null
    priceFailed.value = priceQuote.value === null
  } catch {
    if (!alive || request !== priceRequest || key !== route.fullPath) return
    priceQuote.value = null
    priceFailed.value = true
  }
}
// состав, моя запись, статус и фиксация доли меняются после записи, отмены и закрытия: цена заново
watch(
  () =>
    [
      ev.value?.id,
      ev.value?.status,
      ev.value?.pricing.mode,
      ev.value?.pricing.settledAt,
      ev.value?.taken,
      ev.value?.capacity,
      ev.value?.myBooking?.id,
      ev.value?.myBooking?.status,
      ev.value?.myBooking?.seats,
    ] as const,
  (now, before) => {
    // другое событие: цена прежнего не должна мелькать, пока грузится новая
    if (now[0] !== before?.[0]) {
      priceQuote.value = null
      priceFailed.value = false
    }
    void loadPrice()
  },
  { immediate: true },
)
const myActiveBooking = computed(
  () =>
    !!my.value && ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(my.value.status),
)
const splitView = computed(() =>
  ev.value && splitMode.value
    ? playerSplitViewOf(
        priceQuote.value,
        ev.value.currency,
        {
          status: ev.value.status,
          startsAt: ev.value.startsAt,
          endsAt: ev.value.endsAt,
          capacity: ev.value.capacity,
          taken: occupiedSeats.value,
        },
        now.value,
        {
          hasBooking: myActiveBooking.value,
          paid: ev.value.pricing.myPaymentStatus === 'succeeded',
          waitlisted: my.value?.status === 'waitlisted',
        },
      )
    : null,
)
const splitLabel = computed(() =>
  ev.value && splitMode.value
    ? quotePriceLabel(priceQuote.value, ev.value.currency, {
        hasBooking: myActiveBooking.value,
        waitlisted: my.value?.status === 'waitlisted',
      })
    : null,
)

// состояние приглашения (20.4.7): токен личной ссылки — из хранилища сессии, в теле, не в адресе
let inviteRequestSeq = 0
async function loadInviteAccess() {
  const request = ++inviteRequestSeq
  const current = ev.value
  if (
    !current ||
    current.joinMode !== 'invite' ||
    isManager.value ||
    access.value !== 'active' ||
    my.value?.status === 'confirmed' ||
    my.value?.status === 'pending_payment'
  ) {
    inviteAccess.value = null
    inviteLoaded.value = false
    return
  }
  const key = route.fullPath
  try {
    const stashed = readStashedInviteToken(current.id)
    const res = await $fetch<{ access: InviteAccessView }>(
      `/api/organizations/${current.organizationId}/events/${current.id}/invite-access`,
      { method: 'POST', body: stashed ? { inviteToken: stashed } : {} },
    )
    if (!alive || request !== inviteRequestSeq || key !== route.fullPath) return
    inviteAccess.value = res.access
    inviteLoaded.value = true
    // токен не дал приглашения по ссылке (отозван, использован, чужой, просрочен): больше не нужен
    if (stashed && !(res.access.state === 'invited' && res.access.invite?.source === 'link'))
      clearStashedInviteToken(current.id)
  } catch {
    if (!alive || request !== inviteRequestSeq || key !== route.fullPath) return
    // состояние неизвестно: запись остаётся закрытой, сервер проверит приглашение сам
    inviteAccess.value = null
    inviteLoaded.value = false
  }
}
watch(
  () =>
    [
      ev.value?.id,
      ev.value?.joinMode,
      isManager.value,
      access.value,
      my.value?.id,
      my.value?.status,
    ] as const,
  () => void loadInviteAccess(),
  { immediate: true },
)

const inviteBusy = ref(false)
async function requestInvite() {
  if (!alive || currentViewKey === null || inviteBusy.value || !ev.value) return
  const requestedOrgId = orgId.value
  const requestedEventId = eventId.value
  const request = routeGuard.begin()
  inviteBusy.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(
        `/api/organizations/${requestedOrgId}/events/${requestedEventId}/invite-requests` as string,
        { method: 'POST', body: {} },
      ),
    request.isCurrent,
    async () => {
      await Promise.all([refresh(), loadInviteAccess()])
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отправить запрос')
    if (request.isCurrent()) await Promise.all([loadInviteAccess(), refresh()])
  }
  if (request.isCurrent()) inviteBusy.value = false
}

async function withdrawInvite() {
  const requestId = inviteAccess.value?.request?.id
  if (!alive || currentViewKey === null || inviteBusy.value || !requestId) return
  const requestedOrgId = orgId.value
  const requestedEventId = eventId.value
  const request = routeGuard.begin()
  inviteBusy.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(
        `/api/organizations/${requestedOrgId}/events/${requestedEventId}/invite-requests/${requestId}/cancel` as string,
        { method: 'POST', body: {} },
      ),
    request.isCurrent,
    async () => {
      await Promise.all([refresh(), loadInviteAccess()])
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отозвать запрос')
    // организатор мог ответить раньше: показать актуальное состояние
    if (request.isCurrent()) await Promise.all([loadInviteAccess(), refresh()])
  }
  if (request.isCurrent()) inviteBusy.value = false
}

watch(sourcesReady, (ready) => {
  if (ready) return
  optionsGuard.invalidate()
  sheetOpen.value = false
})

async function retryPage() {
  await Promise.all([refresh(), refreshNuxtData(`player-event-org-${orgId.value}`)])
}

watch(
  [orgId, eventId, () => route.fullPath],
  () => {
    confirmationGuard.invalidate()
    optionsGuard.invalidate()
    sheetOpen.value = false
    subs.value = []
    const nextViewKey =
      pathname() === `/m/orgs/${orgId.value}/events/${eventId.value}`
        ? `${orgId.value}:${eventId.value}`
        : null
    if (nextViewKey === currentViewKey) return
    routeGuard.invalidate()
    currentViewKey = nextViewKey
    actionError.value = ''
    submitting.value = false
  },
  { flush: 'sync' },
)

async function openBooking() {
  if (!alive || currentViewKey === null || submitting.value || !bookable.value) return
  actionError.value = ''
  if (!ev.value) return
  seats.value = 1
  consent.value = false
  chosenMethod.value = ''
  // одно место и бесплатно — выбирать нечего, запись уходит сразу (как до 20.4.5)
  if (ev.value.pricing.mode === 'fixed' && ev.value.price === 0 && maxSeats.value === 1)
    return doBook('free')
  // абонементы нужны и очереди: занятия спишутся при переходе в состав (D-03, уточнение C)
  if (
    ev.value.pricing.mode === 'split' ||
    subscriptionsEnabled.value !== true ||
    ev.value.price === 0
  ) {
    subs.value = []
    sheetOpen.value = true
    return
  }
  const requestedOrgId = orgId.value
  const request = optionsGuard.begin()
  try {
    const res = await $fetch<{ subscriptions: Subscription[] }>(
      `/api/organizations/${requestedOrgId}/subscriptions/my`,
    )
    if (!request.isCurrent()) return
    subs.value = res.subscriptions.filter(
      (s) =>
        s.organizationId === requestedOrgId &&
        s.status === 'active' &&
        s.usedSessions < s.totalSessions &&
        (!s.expiresAt || new Date(s.expiresAt) > new Date()),
    )
  } catch {
    if (!request.isCurrent()) return
    subs.value = []
    actionError.value = 'Не удалось проверить абонементы. Можно выбрать оплату организатору.'
  }
  sheetOpen.value = true
}

async function doBook(
  method: 'free' | 'cash' | 'transfer' | 'subscription',
  subscriptionId?: number,
) {
  if (
    !alive ||
    currentViewKey === null ||
    submitting.value ||
    !eventView.value?.paymentMethods.includes(method)
  )
    return
  const requestedOrgId = orgId.value
  const requestedEventId = eventId.value
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(
        `/api/organizations/${requestedOrgId}/events/${requestedEventId}/bookings` as string,
        {
          method: 'POST',
          body: bookingPayload(method, subscriptionId, {
            // число мест уходит только из степпера; согласие — только при частичной очереди
            seats: sheetOpen.value && maxSeats.value > 1 ? seats.value : 1,
            allowWaitlist: sheetOpen.value && plan.value.needsConsent && consent.value,
            // токен личной ссылки — только если приглашение пришло по ней (20.4.7)
            inviteToken: inviteBookingToken(
              inviteAccess.value,
              readStashedInviteToken(requestedEventId),
            ),
          }),
        },
      ),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
    sheetOpen.value = false
    // однократная ссылка израсходована: токен больше не нужен
    clearStashedInviteToken(requestedEventId)
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось записаться')
    // приглашение могло истечь или быть использовано, пока экран был открыт
    if (request.isCurrent()) void loadInviteAccess()
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}

// способы оплаты листа записи: места основы (после согласия на частичную очередь) и абонементы
// к оплате сейчас: места основы; в очереди ничего не списывается — показываем сумму «если получите»
const payableSeats = computed(() => (queueOnly.value ? seats.value : plan.value.mainSeats))
const priceTotalText = computed(() => {
  if (!ev.value || ev.value.pricing.mode !== 'fixed' || ev.value.price <= 0) return null
  if (payableSeats.value <= 1) return priceLabel.value?.text ?? null
  return quote.value?.seats === payableSeats.value
    ? formatMoneyRu(quote.value.total, quote.value.currency)
    : null
})
// сумма за несколько мест split — прогноз из GET …/price?seats=N, а не умножение на клиенте
const splitTotalText = computed(() =>
  splitMode.value && payableSeats.value > 1 && quote.value?.seats === payableSeats.value
    ? `≈ ${formatMoneyRu(quote.value.total, quote.value.currency)}`
    : null,
)
const methodOptions = computed<BookingMethodOption[]>(() => {
  const methods = eventView.value?.paymentMethods ?? []
  if (!ev.value || methods.includes('free')) return []
  const split = ev.value.pricing.mode === 'split'
  const queued = queueOnly.value
  const options: BookingMethodOption[] = []
  for (const s of methods.includes('subscription') ? subs.value : []) {
    const left = s.totalSessions - s.usedSessions
    const rest = `осталось ${left} из ${s.totalSessions}`
    // очередь: занятия списываются при переходе в состав; не хватит — наличными (D-03, уточнение C)
    const enough = queued || left >= plan.value.mainSeats
    options.push({
      id: `subscription:${s.id}`,
      label: 'С абонемента',
      hint: queued
        ? `${rest}; спишется при переходе в состав, не хватит занятий — наличными`
        : !enough
          ? `${rest} — не хватает на ${seatsLabel(plan.value.mainSeats)}`
          : plan.value.queueSeats > 0
            ? `${rest}; места из очереди — по занятиям, не хватит — наличными`
            : rest,
      tag: `−${queued ? seats.value : plan.value.mainSeats} сесс.`,
      disabled: !enough,
    })
  }
  if (methods.includes('cash'))
    options.push({
      id: 'cash',
      label: 'Наличными организатору',
      hint: queued
        ? 'оплатите организатору, когда получите место'
        : split
          ? 'Точная сумма после закрытия записи'
          : 'подтвердит организатор',
      tag: queued ? undefined : (priceTotalText.value ?? undefined),
    })
  if (methods.includes('transfer'))
    options.push({
      id: 'transfer',
      label: 'Переводом',
      hint: queued
        ? 'реквизиты — у организатора, когда получите место'
        : 'реквизиты — у организатора',
      tag: queued ? undefined : (priceTotalText.value ?? undefined),
    })
  return options
})
watch(
  [methodOptions, sheetOpen],
  () => {
    if (methodOptions.value.some((o) => o.id === chosenMethod.value && !o.disabled)) return
    chosenMethod.value = methodOptions.value.find((o) => !o.disabled)?.id ?? ''
  },
  { flush: 'sync' },
)
const bookingMethod = computed<{
  method: 'free' | 'cash' | 'transfer' | 'subscription'
  subscriptionId?: number
} | null>(() => {
  // бесплатное событие: способа нет; иначе выбранный (в очереди — тот же выбор, ничего не списывается)
  if (eventView.value?.paymentMethods.includes('free')) return { method: 'free' }
  const picked = methodOptions.value.find((o) => o.id === chosenMethod.value && !o.disabled)
  if (!picked) return null
  if (picked.id.startsWith('subscription:'))
    return { method: 'subscription', subscriptionId: Number(picked.id.split(':')[1]) }
  return { method: picked.id as 'cash' | 'transfer' }
})
const canSubmit = computed(
  () =>
    sheetOpen.value &&
    !submitting.value &&
    bookingMethod.value !== null &&
    canSubmitBooking(plan.value, consent.value),
)
const submitLabel = computed(() => bookingSubmitLabel(plan.value))
const submitTag = computed(() => {
  if (queueOnly.value) return 'без оплаты'
  if (bookingMethod.value?.method === 'subscription') return `−${plan.value.mainSeats} сесс.`
  if (bookingMethod.value?.method === 'free') return ''
  return priceTotalText.value ?? ''
})
async function submitBooking() {
  if (!canSubmit.value || !bookingMethod.value) return
  await doBook(bookingMethod.value.method, bookingMethod.value.subscriptionId)
}

// цена нескольких мест — из единого расчёта GET …/price (20.1.1, D-01), не умножением на клиенте
const quote = ref<{ seats: number; total: number; currency: string } | null>(null)
const quoteGuard = createPlayerRequestGuard(() => route.fullPath)
watch(
  [sheetOpen, payableSeats],
  async ([open, count]) => {
    quote.value = null
    const current = ev.value
    const split = current?.pricing.mode === 'split'
    if (
      !open ||
      count <= 1 ||
      !current ||
      (!split && (current.pricing.mode !== 'fixed' || current.price <= 0))
    )
      return
    const request = quoteGuard.begin()
    try {
      const res = await $fetch<{
        price: { total: { min: number; max: number }; currency: string }
      }>(`/api/organizations/${orgId.value}/events/${eventId.value}/price`, {
        query: { seats: count },
      })
      if (!request.isCurrent()) return
      // split до закрытия — прогноз: берём верхнюю границу («≈ …»), как и цену места
      quote.value = {
        seats: count,
        total: split ? res.price.total.max : res.price.total.min,
        currency: res.price.currency,
      }
    } catch {
      // без суммы листу хватает цены места: сервер всё равно посчитает сам
      if (request.isCurrent()) quote.value = null
    }
  },
  { flush: 'sync' },
)

// предложение места из очереди (D-03, 20.3.1): принять, пока оно действует
async function acceptOffer() {
  const current = offer.value
  if (
    !alive ||
    currentViewKey === null ||
    submitting.value ||
    !current ||
    offerLeft.value?.expired !== false
  )
    return
  const requestedOrgId = orgId.value
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(
        `/api/organizations/${requestedOrgId}/waitlist-offers/${current.id}/accept` as string,
        { method: 'POST' },
      ),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось принять место')
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}
// срок вышел: сервер снимает игрока с очереди, перечитать, чтобы экран не держал старое предложение
watch(
  () => offerLeft.value?.expired === true,
  (expired) => {
    if (expired && alive) void refresh()
  },
)

// подпись основной кнопки записи; приглашённому — с ценой, как на утверждённом экране (D-06)
const bookLabel = computed(() => {
  if (eventView.value?.action === 'waitlist') return 'Встать в лист ожидания'
  const price =
    gate.value.state === 'invited' && ev.value?.pricing.mode === 'fixed' && ev.value.price > 0
      ? priceLabel.value?.text
      : null
  return price ? `Записаться · ${price}` : 'Записаться'
})

// MainButton Telegram: одно основное действие экрана — лист записи, предложение или открытие листа (20.4.1)
const mainButtonState = computed(() => {
  if (!isTelegram.value) return null
  if (sheetOpen.value)
    return { text: submitLabel.value, disabled: !canSubmit.value, loading: submitting.value }
  if (offerActive.value && offer.value)
    return { text: offerDeadlineLabel(offer.value.expiresAt, tz.value), loading: submitting.value }
  if (bookable.value)
    return {
      text: bookLabel.value,
      disabled: submitting.value,
    }
  return null
})
const mainButton = createMainButton(isTelegram.value ? webApp : undefined, () => {
  if (sheetOpen.value) void submitBooking()
  else if (offerActive.value) void acceptOffer()
  else void openBooking()
})
onMounted(() => {
  watchEffect(() => mainButton.update(mainButtonState.value))
})
onUnmounted(() => {
  alive = false
  confirmationGuard.invalidate()
  routeGuard.invalidate()
  optionsGuard.invalidate()
  quoteGuard.invalidate()
  stopClock()
  mainButton.destroy()
})

async function cancelMine() {
  if (!alive || currentViewKey === null || submitting.value || !my.value || !canCancel.value) return
  const requestedOrgId = orgId.value
  const confirmation = confirmationGuard.begin()
  const bookingId = my.value.id
  const method = my.value.method
  if (!(await confirm(cancelConfirmText('Отменить запись на тренировку?', method)))) return
  if (
    !alive ||
    !confirmation.isCurrent() ||
    submitting.value ||
    !canCancel.value ||
    requestedOrgId !== orgId.value ||
    bookingId !== my.value?.id
  )
    return
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  refundNotice.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(`/api/organizations/${requestedOrgId}/bookings/${bookingId}/cancel` as string, {
        method: 'POST',
      }),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
    if (cancelMayReleasePaidSeats(method)) refundNotice.value = CANCEL_REFUND_NOTE
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отменить запись')
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}

/** Частичная отмена мест (PATCH …/bookings/{id} {seats}, 20.1.2): сервер снимает очередь, затем основу. */
async function reduceMySeats(kept: number) {
  const booking = my.value
  if (!alive || currentViewKey === null || submitting.value || !booking || !canCancel.value) return
  const total = myTotalSeats.value
  if (kept < 1 || kept >= total) return
  const requestedOrgId = orgId.value
  const confirmation = confirmationGuard.begin()
  if (!(await confirm(seatsCancelConfirmText(total - kept, kept, booking.method)))) return
  if (
    !alive ||
    !confirmation.isCurrent() ||
    submitting.value ||
    !canCancel.value ||
    requestedOrgId !== orgId.value ||
    booking.id !== my.value?.id
  )
    return
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  refundNotice.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(`/api/organizations/${requestedOrgId}/bookings/${booking.id}`, {
        method: 'PATCH',
        body: { seats: kept },
      }),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
    if (cancelMayReleasePaidSeats(booking.method)) refundNotice.value = CANCEL_REFUND_NOTE
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отменить места')
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}
</script>

<template>
  <div class="min-h-screen" :class="showActionBar ? 'pb-44' : 'pb-24'">
    <VtMiniHeader
      :title="ev?.title ?? 'Событие'"
      :sub="ev ? `${formatDay(ev.startsAt, tz)} · ${formatTime(ev.startsAt, tz)}` : undefined"
      :back="pageState === 'ready' ? `/m/orgs/${orgId}/events` : '/m/orgs'"
    >
      <template v-if="isManager && ev" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/events/${ev.id}/manage`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          <VtIcon name="settings" :size="14" /> Управление
        </NuxtLink>
      </template>
    </VtMiniHeader>

    <main
      v-if="pageState === 'pending' || pageState === 'suspended' || pageState === 'denied'"
      class="px-4 py-5"
    >
      <div class="vt-card p-4" role="status">
        <VtChip :tone="pageState === 'pending' ? 'amber' : 'rose'" dot>
          {{
            pageState === 'pending'
              ? 'Заявка на рассмотрении'
              : pageState === 'suspended'
                ? 'Группа приостановлена'
                : 'Доступ в группу закрыт'
          }}
        </VtChip>
        <p class="text-sm text-vt-mute-2 mt-3">
          {{
            pageState === 'pending'
              ? 'После одобрения заявки откроются события и запись.'
              : pageState === 'suspended'
                ? 'Запись и покупки сейчас недоступны.'
                : 'Для просмотра события нужен доступ к группе.'
          }}
        </p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>
    </main>
    <div v-else-if="pageState === 'error'">
      <ErrorState
        :message="loadErrorNotice.message"
        :retry="loadErrorNotice.retry"
        @retry="retryPage"
      />
      <div v-if="loadErrorNotice.eventsLink" class="text-center px-4">
        <NuxtLink :to="`/m/orgs/${orgId}/events`" class="vt-btn vt-btn--ghost">
          Все события
        </NuxtLink>
      </div>
    </div>
    <SkeletonList v-else-if="pageState === 'loading' || !ev" :count="3" class="px-4 py-5" />
    <main v-else class="px-4 py-5 space-y-6">
      <section class="vt-card p-4" aria-label="Дата, место и стоимость">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 text-xs text-vt-mute-2">
            <div v-if="ev.venue || ev.locationText" class="flex items-start gap-1.5">
              <VtIcon name="pin" :size="12" class="shrink-0 mt-0.5" />
              <span class="break-words min-w-0">{{ ev.venue?.name ?? ev.locationText }}</span>
            </div>
            <p v-if="ev.venue?.address" class="mt-1 break-words">{{ ev.venue.address }}</p>
            <div class="flex items-start gap-1.5 mt-1">
              <VtIcon name="clock" :size="12" class="shrink-0 mt-0.5" />
              <span>{{
                started || ev.status !== 'published' || eventView?.closedBySchedule
                  ? 'Запись закрыта'
                  : `Начало в ${formatTime(ev.startsAt, tz)}`
              }}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <VtMyChip :booking="my" />
            <VtStateChip :event="ev" />
            <VtChip
              v-if="inviteChipView"
              :tone="inviteChipView.tone"
              :dot="inviteChipView.dot"
              data-invite-chip
            >
              <VtIcon v-if="!inviteChipView.dot" name="lock" :size="10" aria-hidden="true" />
              {{ inviteChipView.text }}
            </VtChip>
            <VtChip v-if="paymentChip" :tone="paymentChip.tone">{{ paymentChip.text }}</VtChip>
          </div>
        </div>
        <div class="vt-divider my-3" />
        <div class="grid grid-cols-2 gap-2.5">
          <div v-if="!splitMode">
            <div class="vt-cap text-vt-mute-2">Цена</div>
            <div class="vt-mono text-base mt-1 break-words">{{ priceLabel?.text }}</div>
            <p v-if="priceLabel?.description" class="text-xs text-vt-mute-2 mt-2">
              {{ priceLabel.description }}
            </p>
          </div>
          <div v-else-if="ev.status !== 'cancelled'">
            <div class="vt-cap text-vt-mute-2">
              {{ splitView?.stage === 'open' ? 'Прогноз' : 'За место' }}
            </div>
            <div class="vt-mono text-base mt-1 break-words" data-summary-price>
              {{ splitView?.headline ?? '—' }}
            </div>
          </div>
          <div>
            <div class="vt-cap text-vt-mute-2">Длительность</div>
            <div class="font-semibold text-sm mt-1">
              {{
                Math.round(
                  (new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()) / 60000,
                )
              }}
              мин.
            </div>
          </div>
        </div>
      </section>

      <PlayerInviteCard
        v-if="gate.show && gate.state && inviteAccess"
        part="card"
        :state="gate.state"
        :access="inviteAccess"
        :tz="tz"
        :now="now"
        :busy="inviteBusy"
        :events-href="`/m/orgs/${orgId}/events`"
      />

      <PlayerSplitPriceCard v-if="splitView" :view="splitView" />
      <p
        v-else-if="splitMode && ev.status !== 'cancelled' && priceFailed"
        class="vt-card p-4 text-sm text-vt-mute-2"
        role="status"
      >
        Прогноз цены сейчас недоступен. Точная сумма — когда организатор закроет запись.
      </p>

      <section v-if="ev.description" aria-labelledby="event-description-title">
        <h2 id="event-description-title" class="vt-cap mb-3">О тренировке</h2>
        <p class="vt-card p-4 text-sm text-vt-ink-3 whitespace-pre-line">{{ ev.description }}</p>
      </section>

      <section aria-labelledby="event-roster-title">
        <div class="flex items-center justify-between mb-2">
          <h2 id="event-roster-title" class="vt-cap">Состав</h2>
          <span v-if="ev.waitlist" class="text-xs text-vt-mute-2">{{
            waitlistPeopleLabel(ev.waitlist)
          }}</span>
        </div>
        <VtSeatsMini :taken="occupiedSeats" :capacity="ev.capacity" :event="ev" :width="120" />
        <p
          v-if="ev.players !== undefined && ev.players < ev.taken"
          class="flex items-center gap-1.5 text-[11px] text-vt-mute-2 mt-2"
        >
          <VtIcon name="users" :size="12" class="shrink-0" />
          {{ ev.players }} {{ playersWord(ev.players) }} заняли {{ seatsLabel(ev.taken) }} — кто-то
          приводит гостей
        </p>
        <!-- без записи на событие «по приглашению»: стопка аватаров, как на макете M-08 (2026-10-20) -->
        <div
          v-if="gate.show && roster.length"
          class="mt-3 flex items-center gap-2.5"
          data-compact-roster
        >
          <span class="flex -space-x-1.5 shrink-0" aria-hidden="true">
            <VtAvatar
              v-for="r in roster.slice(0, compact.shown)"
              :key="r.user.id"
              size="sm"
              class="compact-avatar"
              data-compact-avatar
              :name="displayName(r.user)"
              :src="r.user.image"
            />
          </span>
          <span class="text-xs text-vt-mute-2">{{ compact.text }}</span>
        </div>
        <ul v-else-if="roster.length" class="mt-3 grid grid-cols-2 gap-1.5" data-roster-list>
          <li
            v-for="r in roster"
            :key="r.user.id"
            class="vt-card flex items-center gap-2 p-2 min-w-0"
          >
            <VtAvatar size="sm" :name="displayName(r.user)" :src="r.user.image" />
            <span class="text-[13px] flex-1 truncate">{{ displayName(r.user) }}</span>
            <VtChip
              v-if="(r.seats ?? 1) > 1"
              tone="flame"
              class="shrink-0"
              :aria-label="`Занимает ${seatsLabel(r.seats ?? 1)}`"
              >+{{ (r.seats ?? 1) - 1 }}</VtChip
            >
            <VtChip v-else-if="levelTitle(r.level, levels)" class="shrink-0">{{
              levelTitle(r.level, levels)
            }}</VtChip>
          </li>
        </ul>
        <p v-else class="text-sm text-vt-mute-2 mt-3">
          {{
            ev.status === 'cancelled'
              ? 'Событие отменено — состав пуст.'
              : bookable
                ? 'Пока никто не записался — будьте первым.'
                : 'Состав пуст.'
          }}
        </p>
      </section>

      <PlayerInviteCard
        v-if="gate.show && gate.state && inviteAccess"
        part="actions"
        :state="gate.state"
        :access="inviteAccess"
        :tz="tz"
        :now="now"
        :busy="inviteBusy"
        :events-href="`/m/orgs/${orgId}/events`"
        @request="requestInvite"
        @withdraw="withdrawInvite"
      />

      <WaitlistOfferCard
        v-if="offer"
        :offer="offer"
        :now="now"
        :submitting="submitting"
        :show-action="!isTelegram"
        :tz="tz"
        @accept="acceptOffer"
      />

      <section
        v-if="my && eventView?.bookingCard"
        class="vt-card p-4"
        role="status"
        aria-label="Ваша запись"
      >
        <div class="flex flex-wrap items-center gap-2">
          <VtMyChip :booking="my" />
          <span class="text-sm font-semibold">{{ eventView.bookingCard.title }}</span>
        </div>
        <p class="text-sm text-vt-mute-2 mt-2">{{ eventView.bookingCard.text }}</p>
        <p v-if="eventView.seatsNote" class="text-sm font-semibold mt-2">
          {{ eventView.seatsNote }}
        </p>
        <div v-if="paymentLabel" class="mt-2 space-y-1">
          <p v-if="my.status !== 'waitlisted' && splitLabel" class="vt-mono text-sm">
            {{ splitView?.myTotal?.text ?? splitLabel.text }}
          </p>
          <VtChip v-if="my.status !== 'waitlisted'" :tone="paymentLabel.tone">{{
            paymentLabel.text
          }}</VtChip>
        </div>
        <button
          v-if="canCancel"
          type="button"
          class="vt-btn vt-btn--danger vt-btn--full mt-3"
          :disabled="submitting"
          @click="cancelMine"
        >
          Отменить запись
        </button>
        <p
          v-else-if="['confirmed', 'pending_payment', 'waitlisted'].includes(my.status) && !started"
          class="text-xs text-vt-mute-2 mt-3"
        >
          {{ noCancelExplanation }}
        </p>
        <p v-if="canCancel && eventView?.cancelDeadline" class="text-xs text-vt-mute-2 mt-2">
          Отменить можно до {{ formatDay(eventView.cancelDeadline, tz) }},
          {{ formatTime(eventView.cancelDeadline, tz) }}.
        </p>
        <PlayerSeatsCancel
          v-if="canCancel && my"
          :total="myTotalSeats"
          :disabled="submitting"
          @reduce="reduceMySeats"
        />
      </section>
      <p v-if="refundNotice" class="text-sm text-vt-mute-2 mt-3" role="status">
        {{ refundNotice }}
      </p>

      <p v-if="cancelDeadline && !eventView?.hasBooking && bookable" class="text-xs text-vt-mute-2">
        Отменить запись можно до {{ formatDay(cancelDeadline, tz) }},
        {{ formatTime(cancelDeadline, tz) }}.
      </p>
      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <!--
        Панель действия над таб-баром (z-30 > z-20) и с отступом на его высоту (Task 5.14.1).
        В Telegram не рендерится: то же действие уже на MainButton.
      -->
      <div
        v-if="showActionBar"
        class="player-event-action fixed inset-x-0 z-30 p-4 bg-vt-paper border-t border-vt-stroke"
      >
        <p
          v-if="eventView?.action === 'waitlist'"
          class="text-xs text-vt-amber-ink mb-2 text-center"
        >
          Мест нет — вы встанете в лист ожидания.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          :disabled="submitting"
          @click="openBooking"
        >
          {{ bookLabel }}
        </button>
      </div>
      <p
        v-else-if="eventView?.closedBySchedule && !eventView.hasBooking"
        class="text-sm text-vt-mute-2 text-center"
      >
        Запись закрыта — до начала осталось мало времени.
      </p>
      <p v-else-if="started && !eventView?.hasBooking" class="text-sm text-vt-mute-2 text-center">
        Запись закрыта — событие уже началось.
      </p>
      <p
        v-else-if="eventView?.opensAt && !eventView.hasBooking"
        class="vt-card flex items-center gap-2 p-3.5 text-sm text-vt-mute-2"
        role="status"
      >
        <VtIcon name="clock" :size="16" class="shrink-0" />
        Запись откроется {{ formatDay(eventView.opensAt, tz) }},
        {{ formatTime(eventView.opensAt, tz) }}.
      </p>
    </main>

    <VtSheet v-model="sheetOpen" :title="queueOnly ? 'Лист ожидания' : 'Запись'">
      <PlayerBookingForm
        v-model:seats="seats"
        v-model:consent="consent"
        v-model:method="chosenMethod"
        :plan="plan"
        :max-seats="maxSeats"
        :price-text="splitMode ? (splitLabel?.text ?? null) : (priceLabel?.text ?? null)"
        :price-note="
          splitMode
            ? queueOnly
              ? 'В листе ожидания начисления нет.'
              : (splitLabel?.description ?? '')
            : ''
        "
        :total="payableSeats > 1 ? (splitMode ? splitTotalText : priceTotalText) : null"
        :methods="methodOptions"
        :queued="ev?.waitlistSeats ?? 0"
        :note="
          queueOnly || !bookingMethod || ['free', 'subscription'].includes(bookingMethod.method)
            ? ''
            : 'Место закрепляется за вами сразу. Оплату подтвердит организатор вручную.'
        "
        :free="eventView?.paymentMethods.includes('free') ?? false"
        :error="actionError"
        :submit-label="submitLabel"
        :submit-tag="submitTag"
        :can-submit="canSubmit"
        :submitting="submitting"
        :show-submit="!isTelegram"
        @submit="submitBooking"
      />
    </VtSheet>
  </div>
</template>

<style scoped>
.compact-avatar {
  border-radius: 9999px;
  box-shadow: 0 0 0 2px var(--vt-paper);
}

.event-hero {
  background: var(--vt-ink);
  color: var(--vt-paper);
}

.event-hero__eyebrow {
  color: var(--vt-paper);
  opacity: 0.72;
}
</style>
