<script setup lang="ts">
import type { Event, Organization, OrganizationMember, Subscription } from '@volley-time/db'
import { formatDay, formatTime, type EventPricingView } from '@volley-time/shared'

import {
  type BookingMethodOption,
  bookingSubmitLabel,
  canSubmitBooking,
  clampSeats,
  maxSeatsFor,
  offerCountdown,
  planSeats,
  playersWord,
  seatsLabel,
} from '~/utils/booking-seats'
import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { displayName, formatMoneyRu } from '~/utils/labels'
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
import { levelTitle, type PlayerLevelView } from '~/utils/player-level'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type EventDetails = Event & {
  pricing: EventPricingView
  taken: number
  /** Игроков в составе: меньше `taken`, когда кто-то занял несколько мест (20.1.2). */
  players?: number
  waitlist: number
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
} = await useFetch<{ event: EventDetails; roster: RosterItem[] }>(
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
  capabilities?: { eventMultiSeat?: boolean }
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
const priceLabel = computed(() =>
  ev.value ? eventPricingLabel(ev.value.pricing, ev.value.currency) : null,
)
const paymentLabel = computed(() =>
  ev.value && my.value ? splitBookingPaymentLabel(ev.value.pricing, my.value.status) : null,
)
const paymentChip = computed(() =>
  my.value ? bookingPaymentChip(my.value.status, ev.value?.pricing) : null,
)
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= new Date())
const subs = ref<Subscription[]>([])
const eventView = computed(() =>
  sourcesReady.value && ev.value
    ? projectPlayerEvent(
        ev.value,
        {
          memberActive: access.value === 'active',
          subscriptionsEnabled: subscriptionsEnabled.value,
          hasEligibleSubscription: subs.value.length > 0,
        },
        new Date(),
      )
    : null,
)
const bookable = computed(() => eventView.value?.action !== 'none' && !!eventView.value)
/** В Telegram действие живёт на MainButton — панель не показываем (5.14.1). */
const showActionBar = computed(() => bookable.value && !isTelegram.value)

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
watch(
  () => [plan.value.kind, plan.value.queueSeats],
  () => {
    consent.value = false
  },
)

// часы для отсчёта предложения места: один таймер на экран, только пока предложение есть
const now = ref(new Date())
const offer = computed(() => eventView.value?.offer ?? null)
const offerLeft = computed(() =>
  offer.value ? offerCountdown(offer.value.expiresAt, now.value) : null,
)
const offerActive = computed(() => !!offer.value && offerLeft.value?.expired === false)
let clock: ReturnType<typeof setInterval> | undefined
watch(
  () => offer.value?.id,
  (id) => {
    if (clock) clearInterval(clock)
    clock = undefined
    if (id === undefined || typeof window === 'undefined') return
    now.value = new Date()
    clock = setInterval(() => {
      now.value = new Date()
    }, 1000)
  },
  { immediate: true },
)
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
const loadErrorNotice = computed(() =>
  playerEventLoadErrorNotice(apiErrorStatus(loadError.value), actionError.value),
)
const pathname = () => route.fullPath.split(/[?#]/, 1)[0]?.replace(/\/$/, '')
let currentViewKey: string | null = `${orgId.value}:${eventId.value}`
let alive = true
const confirmationGuard = createPlayerRequestGuard(() => route.fullPath)
const routeGuard = createPlayerRequestGuard(() => currentViewKey)
const optionsGuard = createPlayerRequestGuard(() => route.fullPath)

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
  // очереди абонемент не нужен: способ оплаты выбирается, когда место предложат (D-03)
  if (
    ev.value.pricing.mode === 'split' ||
    subscriptionsEnabled.value !== true ||
    ev.value.price === 0 ||
    (eventView.value?.freeSeats ?? 0) === 0
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
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось записаться')
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
const priceTotalText = computed(() => {
  if (!ev.value || ev.value.pricing.mode !== 'fixed' || ev.value.price <= 0) return null
  if (seats.value <= 1) return priceLabel.value?.text ?? null
  return quote.value?.seats === seats.value
    ? formatMoneyRu(quote.value.total, quote.value.currency)
    : null
})
const methodOptions = computed<BookingMethodOption[]>(() => {
  const methods = eventView.value?.paymentMethods ?? []
  if (queueOnly.value || !ev.value || methods.includes('free')) return []
  const split = ev.value.pricing.mode === 'split'
  const options: BookingMethodOption[] = []
  for (const s of methods.includes('subscription') ? subs.value : []) {
    const left = s.totalSessions - s.usedSessions
    const enough = left >= plan.value.mainSeats
    options.push({
      id: `subscription:${s.id}`,
      label: 'С абонемента',
      hint: enough
        ? `осталось ${left} из ${s.totalSessions}`
        : `осталось ${left} из ${s.totalSessions} — не хватает на ${seatsLabel(plan.value.mainSeats)}`,
      tag: `−${plan.value.mainSeats} сесс.`,
      disabled: !enough,
    })
  }
  if (methods.includes('cash'))
    options.push({
      id: 'cash',
      label: 'Наличными организатору',
      hint: split ? 'Точная сумма после закрытия записи' : 'подтвердит организатор',
      tag: priceTotalText.value ?? undefined,
    })
  if (methods.includes('transfer'))
    options.push({
      id: 'transfer',
      label: 'Переводом',
      hint: 'реквизиты — у организатора',
      tag: priceTotalText.value ?? undefined,
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
  const methods = eventView.value?.paymentMethods ?? []
  // очередь и бесплатное событие: способа не выбирают, сервер получает free либо cash (D-03)
  if (queueOnly.value || methods.includes('free')) {
    const first = methods[0]
    return first === 'free' || first === 'cash' ? { method: first } : null
  }
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
  [sheetOpen, seats],
  async ([open, count]) => {
    quote.value = null
    const current = ev.value
    if (!open || count <= 1 || !current || current.pricing.mode !== 'fixed' || current.price <= 0)
      return
    const request = quoteGuard.begin()
    try {
      const res = await $fetch<{ price: { total: { min: number }; currency: string } }>(
        `/api/organizations/${orgId.value}/events/${eventId.value}/price`,
        { query: { seats: count } },
      )
      if (!request.isCurrent()) return
      quote.value = { seats: count, total: res.price.total.min, currency: res.price.currency }
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

// MainButton Telegram: одно основное действие экрана — лист записи, предложение или открытие листа (20.4.1)
const mainButtonState = computed(() => {
  if (!isTelegram.value) return null
  if (sheetOpen.value)
    return { text: submitLabel.value, disabled: !canSubmit.value, loading: submitting.value }
  if (offerActive.value) return { text: 'Принять место', loading: submitting.value }
  if (bookable.value)
    return {
      text: eventView.value?.action === 'waitlist' ? 'Встать в лист ожидания' : 'Записаться',
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
  if (clock) clearInterval(clock)
  mainButton.destroy()
})

async function cancelMine() {
  if (!alive || currentViewKey === null || submitting.value || !my.value || !canCancel.value) return
  const requestedOrgId = orgId.value
  const confirmation = confirmationGuard.begin()
  const bookingId = my.value.id
  if (!(await confirm('Отменить запись на тренировку?'))) return
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
                started || ev.status !== 'published'
                  ? 'Запись закрыта'
                  : `Начало в ${formatTime(ev.startsAt, tz)}`
              }}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <VtMyChip :booking="my" />
            <VtStateChip :event="ev" />
            <VtChip v-if="paymentChip" :tone="paymentChip.tone">{{ paymentChip.text }}</VtChip>
          </div>
        </div>
        <div class="vt-divider my-3" />
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <div class="vt-cap text-vt-mute-2">Цена</div>
            <div class="vt-mono text-base mt-1 break-words">{{ priceLabel?.text }}</div>
            <p v-if="priceLabel?.description" class="text-xs text-vt-mute-2 mt-2">
              {{ priceLabel.description }}
            </p>
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

      <section v-if="ev.description" aria-labelledby="event-description-title">
        <h2 id="event-description-title" class="vt-cap mb-3">О тренировке</h2>
        <p class="vt-card p-4 text-sm text-vt-ink-3 whitespace-pre-line">{{ ev.description }}</p>
      </section>

      <section aria-labelledby="event-roster-title">
        <div class="flex items-center justify-between mb-2">
          <h2 id="event-roster-title" class="vt-cap">Состав</h2>
          <span v-if="ev.waitlist" class="text-xs text-vt-mute-2">ожидают {{ ev.waitlist }}</span>
        </div>
        <VtSeatsMini :taken="ev.taken" :capacity="ev.capacity" :event="ev" :width="120" />
        <p
          v-if="ev.players !== undefined && ev.players < ev.taken"
          class="flex items-center gap-1.5 text-[11px] text-vt-mute-2 mt-2"
        >
          <VtIcon name="users" :size="12" class="shrink-0" />
          {{ ev.players }} {{ playersWord(ev.players) }} заняли {{ seatsLabel(ev.taken) }} — кто-то
          приводит гостей
        </p>
        <ul v-if="roster.length" class="mt-3 grid grid-cols-2 gap-1.5">
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

      <WaitlistOfferCard
        v-if="offer"
        :offer="offer"
        :now="now"
        :submitting="submitting"
        :show-action="!isTelegram"
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
          <p v-if="my.status !== 'waitlisted'" class="vt-mono text-sm">{{ priceLabel?.text }}</p>
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
      </section>

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
          {{ eventView?.action === 'waitlist' ? 'Встать в лист ожидания' : 'Записаться' }}
        </button>
      </div>
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
        :price-text="priceLabel?.text ?? null"
        :price-note="
          ev?.pricing.mode === 'split'
            ? queueOnly
              ? 'В листе ожидания начисления нет.'
              : priceLabel?.description
            : ''
        "
        :total="priceTotalText"
        :methods="methodOptions"
        :queued="ev?.waitlist ?? 0"
        :note="
          queueOnly || !bookingMethod || ['free', 'subscription'].includes(bookingMethod.method)
            ? ''
            : 'Место закрепляется за вами сразу. Оплату подтвердит организатор вручную.'
        "
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
.event-hero {
  background: var(--vt-ink);
  color: var(--vt-paper);
}

.event-hero__eyebrow {
  color: var(--vt-paper);
  opacity: 0.72;
}
</style>
