<script setup lang="ts">
import type { EventBookingRow } from '@volley-time/core'
import type { Event } from '@volley-time/db'
import {
  formatDay,
  formatTime,
  type EventPriceQuote,
  type EventPricingView,
  type PricingFinancials,
  type PricingPermissions,
} from '@volley-time/shared'

import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'
import { bookingWindowOf } from '~/utils/event-booking-window'
import { cancelConsequencesOf } from '~/utils/event-cancel'
import { priceViewOf } from '~/utils/event-price-view'
import { displayName, formatMoneyRu } from '~/utils/labels'
import {
  paymentSummaryOf,
  rejectPaymentText,
  removeBookingText,
  resolvablePaymentId,
  seatsWordRu,
} from '~/utils/organizer-roster'
import { levelTitle, type PlayerLevelView } from '~/utils/player-level'
import { pendingLabel } from '~/utils/status-model'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

interface RosterEntry {
  user: { id: number }
  level?: string | null
}

const route = useRoute()
const router = useRouter()
const mountedPath = route.fullPath
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const base = computed(() => `/app/orgs/${orgId.value}/events`)
const { tz } = useOrgTimezone(orgId)
const { data, pending, error, refresh } = await useFetch<{
  event: Event & {
    taken: number
    players?: number
    waitlist: number
    waitlistSeats?: number
    venue: { name: string } | null
    pricing: EventPricingView
    pricingPermissions?: PricingPermissions
    pricingFinancials?: PricingFinancials
    manualClose?: boolean
  }
  /** Состав для участников группы: уровень игрока приходит только отсюда (20.4.10). */
  roster?: RosterEntry[]
}>(() => `/api/organizations/${orgId.value}/events/${eventId.value}`, {
  key: () => `desktop-event-${orgId.value}-${eventId.value}`,
})
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const levels = computed(() => levelsData.value?.levels ?? [])
const { data: orgData } = await useFetch<{ capabilities?: { eventScheduler?: boolean } }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-event-org-${orgId.value}` },
)
const schedulerOn = computed(() => orgData.value?.capabilities?.eventScheduler === true)
const event = computed(() => {
  const candidate = data.value?.event
  return candidate?.id === eventId.value && candidate.organizationId === orgId.value
    ? candidate
    : null
})
const levelByUser = computed(
  () => new Map((data.value?.roster ?? []).map((r) => [r.user.id, r.level ?? null] as const)),
)
const rows = ref<EventBookingRow[]>([])
const rosterLoading = ref(false)
const rosterError = ref('')
const quote = ref<EventPriceQuote | null>(null)
const actionError = ref('')
const busy = ref(false)
const cancelOpen = ref(false)
let settlementOperation = 0
let generation = 0
let priceRequest = 0
let alive = true

function livePath(targetOrgId: number, targetEventId: number) {
  return `/app/orgs/${targetOrgId}/events/${targetEventId}`
}

function canAct(targetOrgId: number, targetEventId: number) {
  return (
    alive &&
    canSubmitDesktopEventAction(route.path, livePath(targetOrgId, targetEventId), busy.value)
  )
}

async function loadRoster() {
  const token = generation
  const targetOrgId = orgId.value
  const targetEventId = eventId.value
  rosterLoading.value = true
  rosterError.value = ''
  try {
    const result = await $fetch<{ bookings: EventBookingRow[] }>(
      `/api/organizations/${targetOrgId}/events/${targetEventId}/bookings`,
    )
    if (
      alive &&
      token === generation &&
      canSubmitDesktopEventAction(route.path, livePath(targetOrgId, targetEventId), false)
    )
      rows.value = result.bookings
  } catch (cause) {
    if (alive && token === generation && route.path === livePath(targetOrgId, targetEventId))
      rosterError.value = apiErrorMessage(cause, 'Не удалось загрузить состав')
  } finally {
    if (alive && token === generation) rosterLoading.value = false
  }
}

/**
 * Цена и прогноз — единый расчёт `quoteEventPrice` через `GET …/price` (20.1.1, D-01 (B)), одно место
 * игрока. Для отменённого события не запрашиваем: интерфейс цену отменённого события не показывает.
 */
async function loadPrice() {
  const token = generation
  const request = ++priceRequest
  const target = event.value
  if (!target || target.status === 'cancelled') {
    quote.value = null
    return
  }
  try {
    const result = await $fetch<{ price?: EventPriceQuote }>(
      `/api/organizations/${target.organizationId}/events/${target.id}/price`,
      { query: { seats: 1 } },
    )
    if (
      alive &&
      token === generation &&
      request === priceRequest &&
      canSubmitDesktopEventAction(route.path, livePath(target.organizationId, target.id), false)
    )
      quote.value = result?.price ?? null
  } catch {
    if (alive && token === generation && request === priceRequest) quote.value = null
  }
}

watch(
  [orgId, eventId],
  () => {
    generation++
    rows.value = []
    quote.value = null
    actionError.value = ''
    void loadRoster()
    void loadPrice()
  },
  { immediate: true },
)
// статус и занятость меняются после действий (publish, cancel, запись игроков): цену берём заново
watch(
  () => [event.value?.status, event.value?.taken, event.value?.capacity] as const,
  (now, before) => {
    if (before && (now[0] !== before[0] || now[1] !== before[1] || now[2] !== before[2]))
      void loadPrice()
  },
)
onBeforeUnmount(() => {
  alive = false
  generation++
})

const inRoster = computed(() =>
  rows.value.filter((booking) =>
    ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(booking.status),
  ),
)
const waitlist = computed(() => rows.value.filter((booking) => booking.status === 'waitlisted'))
const started = computed(() => !!event.value && new Date(event.value.startsAt) <= new Date())
const cancelled = computed(() => event.value?.status === 'cancelled')
const rosterPricing = computed(() => ({
  priceMode: event.value?.pricing?.mode === 'split' ? ('split' as const) : ('fixed' as const),
  perSeat: quote.value?.mode === 'fixed' ? quote.value.perSeat.max : null,
  free: event.value?.pricing?.mode !== 'split' && (event.value?.price ?? 0) === 0,
  settled: !!event.value?.pricing?.settledAt,
}))
const payments = computed(() =>
  rosterLoading.value || rosterError.value
    ? null
    : paymentSummaryOf(rows.value, rosterPricing.value),
)
const showPayments = computed(
  () =>
    !cancelled.value && (event.value?.pricing?.mode === 'split' || (event.value?.price ?? 0) > 0),
)
const priceView = computed(() =>
  event.value
    ? priceViewOf(quote.value, event.value.currency, {
        status: event.value.status,
        startsAt: event.value.startsAt,
        endsAt: event.value.endsAt,
        capacity: event.value.capacity,
        taken: event.value.taken,
      })
    : null,
)
const consequences = computed(() =>
  cancelConsequencesOf(rosterLoading.value || rosterError.value ? null : rows.value, {
    bookingOpensAt: event.value?.bookingOpensAt ?? null,
  }),
)
const bookingWindow = computed(() =>
  event.value ? bookingWindowOf(event.value, tz.value, schedulerOn.value) : null,
)
const eventLevel = computed(() => levelTitle(event.value?.level ?? null, levels.value))

function levelOf(booking: EventBookingRow) {
  return levelTitle(levelByUser.value.get(booking.user.id), levels.value)
}

function settlementRouteCurrent(targetOrgId: number, targetEventId: number) {
  const current = router.currentRoute.value
  return (
    alive &&
    current.fullPath === mountedPath &&
    route.fullPath === mountedPath &&
    Number(current.params.orgId) === targetOrgId &&
    Number(current.params.eventId) === targetEventId
  )
}

async function settlePricing() {
  const target = event.value
  if (
    !target?.pricingPermissions?.canSettle ||
    busy.value ||
    !settlementRouteCurrent(target.organizationId, target.id)
  )
    return
  const operation = ++settlementOperation
  busy.value = true
  actionError.value = ''
  try {
    const ok = window.confirm(
      `Закрыть запись и распределить ${formatMoneyRu(target.pricing.targetAmount ?? 0, target.currency)} между ${target.taken} участниками? Доли будут зафиксированы; лист ожидания не участвует. Состав и суммы окончательно проверит сервер.`,
    )
    if (
      !ok ||
      !settlementRouteCurrent(target.organizationId, target.id) ||
      !event.value?.pricingPermissions?.canSettle
    )
      return
    await $fetch(`/api/organizations/${target.organizationId}/events/${target.id}/settle`, {
      method: 'POST',
    })
    if (settlementRouteCurrent(target.organizationId, target.id))
      await Promise.all([refresh(), loadRoster(), loadPrice()])
  } catch (cause) {
    if (settlementRouteCurrent(target.organizationId, target.id))
      actionError.value = apiErrorMessage(
        cause,
        'Не удалось распределить сумму. Обновите событие и попробуйте снова.',
      )
  } finally {
    if (alive && operation === settlementOperation) busy.value = false
  }
}

async function afterAction(targetOrgId: number, targetEventId: number) {
  if (!alive || route.path !== livePath(targetOrgId, targetEventId)) return
  await Promise.all([refresh(), loadRoster(), loadPrice()])
}

async function publish() {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${target.organizationId}/events/${target.id}`, {
      method: 'PATCH',
      body: { status: 'published' },
    })
    await afterAction(target.organizationId, target.id)
  } catch (cause) {
    if (alive && route.path === livePath(target.organizationId, target.id))
      actionError.value = apiErrorMessage(cause, 'Не удалось опубликовать событие')
  } finally {
    busy.value = false
  }
}

/** Отмена события: сначала диалог с последствиями, запрос — только после подтверждения. */
function requestCancel() {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  cancelOpen.value = true
}

async function cancelEvent() {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${target.organizationId}/events/${target.id}/cancel`, {
      method: 'POST',
    })
    await afterAction(target.organizationId, target.id)
  } catch (cause) {
    if (alive && route.path === livePath(target.organizationId, target.id))
      actionError.value = apiErrorMessage(cause, 'Не удалось отменить событие')
  } finally {
    busy.value = false
  }
}

async function mark(booking: EventBookingRow, attended: boolean) {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${target.organizationId}/events/${target.id}/attendance`, {
      method: 'POST',
      body: { marks: [{ bookingId: booking.id, attended }] },
    })
    await afterAction(target.organizationId, target.id)
  } catch (cause) {
    if (alive && route.path === livePath(target.organizationId, target.id))
      actionError.value = apiErrorMessage(cause, 'Не удалось сохранить посещаемость')
  } finally {
    busy.value = false
  }
}

async function removeBooking(booking: EventBookingRow) {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  if (!window.confirm(removeBookingText(displayName(booking.user), booking))) return
  if (!canAct(target.organizationId, target.id)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${target.organizationId}/bookings/${booking.id}/cancel`, {
      method: 'POST',
    })
    await afterAction(target.organizationId, target.id)
  } catch (cause) {
    if (alive && route.path === livePath(target.organizationId, target.id))
      actionError.value = apiErrorMessage(cause, 'Не удалось снять запись')
  } finally {
    busy.value = false
  }
}

/**
 * Оплата записи: подтвердить или отклонить ожидающий платёж записи. `booking.paymentId` — самый
 * ранний платёж и может быть уже оплачен (после добавления мест), поэтому действуем по `pendingPaymentIds`.
 */
async function resolvePayment(booking: EventBookingRow, action: 'confirm' | 'reject') {
  const target = event.value
  const paymentId = resolvablePaymentId(booking)
  if (!target || paymentId === null || cancelled.value || !canAct(target.organizationId, target.id))
    return
  if (
    action === 'reject' &&
    !window.confirm(rejectPaymentText(booking, displayName(booking.user), rosterPricing.value))
  )
    return
  if (!canAct(target.organizationId, target.id)) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${target.organizationId}/payments/${paymentId}/${action}`, {
      method: 'POST',
    })
    await afterAction(target.organizationId, target.id)
  } catch (cause) {
    if (!alive || route.path !== livePath(target.organizationId, target.id)) return
    if (apiErrorCode(cause) === 'payment.not_pending') {
      await afterAction(target.organizationId, target.id)
      actionError.value = 'Платёж уже обработан — состав обновлён'
    } else {
      actionError.value = apiErrorMessage(cause, 'Не удалось обработать платёж')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="vt-desktop-event-detail space-y-5">
    <NuxtLink :to="base" class="vt-btn vt-btn--ghost">К событиям</NuxtLink>
    <SkeletonList v-if="pending" :count="3" />
    <ErrorState
      v-else-if="error || !event"
      message="Не удалось открыть событие"
      @retry="refresh()"
    />
    <template v-else>
      <header class="vt-desktop-dashboard__heading">
        <div>
          <VtStateChip :event="event" />
          <h1 tabindex="-1">{{ event.title }}</h1>
          <p class="text-vt-mute-2">
            {{ formatDay(event.startsAt, tz) }}, {{ formatTime(event.startsAt, tz) }} ·
            {{ event.venue?.name ?? event.locationText ?? 'Площадка не указана' }}
          </p>
        </div>
        <div class="vt-desktop-event-detail__actions">
          <NuxtLink
            v-if="!cancelled && !started"
            :to="`${base}/${event.id}/edit`"
            class="vt-btn vt-btn--ghost"
            >Изменить событие</NuxtLink
          >
          <button
            v-if="!cancelled && !started"
            type="button"
            class="vt-btn vt-btn--ghost vt-desktop-event-detail__cancel"
            :disabled="busy"
            @click="requestCancel"
          >
            Отменить событие
          </button>
        </div>
      </header>

      <div v-if="event.status === 'draft'" class="vt-card vt-desktop-event-detail__notice">
        <p>Черновик виден только организаторам.</p>
        <button type="button" class="vt-btn vt-btn--primary" :disabled="busy" @click="publish">
          Опубликовать событие
        </button>
      </div>
      <p v-if="event.description" class="vt-card vt-desktop-event-detail__description">
        {{ event.description }}
      </p>
      <p v-if="actionError" class="text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <button
        v-if="actionError && event.pricing?.mode === 'split'"
        class="vt-btn vt-btn--ghost"
        type="button"
        :disabled="busy"
        @click="refresh()"
      >
        Обновить событие
      </button>

      <div class="vt-desktop-event-detail__grid">
        <div class="vt-desktop-event-detail__main">
          <section
            class="vt-card vt-desktop-event-detail__roster"
            aria-labelledby="desktop-roster-title"
          >
            <div class="vt-desktop-event-detail__roster-head">
              <h2 id="desktop-roster-title">Состав{{ started ? ' · посещаемость' : '' }}</h2>
              <div class="vt-desktop-event-detail__seats">
                <VtSeatsMini
                  :taken="event.taken"
                  :capacity="event.capacity"
                  :event="event"
                  :width="120"
                />
                <span v-if="event.taken < event.capacity || started || cancelled" class="vt-mono"
                  >мест</span
                >
                <span v-if="event.players !== undefined && event.players !== event.taken"
                  >· {{ event.players }} игроков</span
                >
              </div>
              <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="loadRoster">
                Обновить состав
              </button>
            </div>
            <SkeletonList v-if="rosterLoading" :count="2" />
            <ErrorState v-else-if="rosterError" :message="rosterError" @retry="loadRoster" />
            <p v-else-if="cancelled" class="text-vt-mute-2">
              Событие отменено: записи отменены, игроки уведомлены.
            </p>
            <p v-else-if="inRoster.length === 0" class="text-vt-mute-2">Пока никто не записан.</p>
            <ol v-else class="vt-desktop-event-detail__rows">
              <li v-for="(booking, i) in inRoster" :key="booking.id">
                <OrganizerRosterRow
                  :booking="booking"
                  :pricing="rosterPricing"
                  :currency="event.currency"
                  :level-label="levelOf(booking)"
                  :index="i + 1"
                  :tz="tz"
                >
                  <template #actions="{ view }">
                    <div class="vt-desktop-event-detail__actions">
                      <template v-if="view.canResolvePayment && !cancelled">
                        <button
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm !px-2 text-vt-grass-ink"
                          :disabled="busy"
                          :aria-label="`Подтвердить оплату: ${displayName(booking.user)}`"
                          title="Подтвердить оплату"
                          @click="resolvePayment(booking, 'confirm')"
                        >
                          <VtIcon name="check" :size="14" />
                        </button>
                        <button
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busy"
                          :aria-label="`Отклонить оплату: ${displayName(booking.user)}`"
                          title="Отклонить оплату"
                          @click="resolvePayment(booking, 'reject')"
                        >
                          <VtIcon name="close" :size="14" />
                        </button>
                      </template>
                      <template
                        v-if="started && !cancelled && booking.status !== 'pending_payment'"
                      >
                        <button
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busy"
                          :aria-label="`Был: ${displayName(booking.user)}`"
                          title="Был"
                          @click="mark(booking, true)"
                        >
                          <VtIcon name="check" :size="14" />
                        </button>
                        <button
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busy"
                          :aria-label="`Не пришёл: ${displayName(booking.user)}`"
                          title="Не пришёл"
                          @click="mark(booking, false)"
                        >
                          <VtIcon name="close" :size="14" />
                        </button>
                      </template>
                      <button
                        v-else-if="!started && !cancelled"
                        type="button"
                        class="vt-btn vt-btn--ghost vt-btn--sm"
                        :disabled="busy"
                        :aria-label="`Снять с события: ${displayName(booking.user)}`"
                        title="Снять с события"
                        @click="removeBooking(booking)"
                      >
                        <VtIcon name="trash" :size="14" />
                      </button>
                    </div>
                  </template>
                </OrganizerRosterRow>
              </li>
            </ol>

            <div
              v-if="!cancelled && (waitlist.length || event.waitlist > 0)"
              class="vt-desktop-event-detail__waitlist"
              aria-labelledby="desktop-waitlist-title"
              role="group"
            >
              <h3 id="desktop-waitlist-title" class="vt-cap">
                Лист ожидания · {{ seatsWordRu(event.waitlistSeats ?? event.waitlist) }}
              </h3>
              <ol v-if="waitlist.length">
                <li v-for="booking in waitlist" :key="booking.id">
                  <OrganizerRosterRow
                    :booking="booking"
                    :pricing="rosterPricing"
                    :currency="event.currency"
                    :level-label="levelOf(booking)"
                    :tz="tz"
                  />
                </li>
              </ol>
              <p v-else class="text-vt-mute-2">
                Очередь собрана из дополнительных мест игроков, которые уже в составе.
              </p>
            </div>
          </section>
        </div>

        <aside class="vt-desktop-event-detail__side" aria-label="Параметры и оплаты">
          <EventPriceBlock v-if="priceView && priceView.mode === 'split'" :view="priceView" />

          <EventPricingPanel
            v-if="event.pricing?.mode === 'split'"
            :pricing="event.pricing"
            :financials="event.pricingFinancials ?? null"
            :currency="event.currency"
            :tz="tz"
            :can-settle="event.pricingPermissions?.canSettle === true"
            :pending="busy"
            hide-per-seat
            @settle="settlePricing"
          />

          <section
            class="vt-card vt-desktop-event-detail__params"
            aria-labelledby="event-params-title"
          >
            <h2 id="event-params-title">Параметры</h2>
            <dl>
              <dt>Тип оплаты</dt>
              <dd>
                {{ event.pricing?.mode === 'split' ? 'Делим общую сумму' : 'Фиксированная цена' }}
              </dd>
              <template v-if="event.pricing?.mode === 'split'">
                <dt>Сумма к сбору</dt>
                <dd class="vt-mono">
                  {{ formatMoneyRu(event.pricing.targetAmount ?? 0, event.currency) }}
                </dd>
              </template>
              <template v-if="priceView">
                <dt>{{ event.pricing?.mode === 'split' ? 'За место' : 'Цена за место' }}</dt>
                <dd class="vt-mono" data-price-param>{{ priceView.headline }}</dd>
              </template>
              <dt>Состав</dt>
              <dd>{{ seatsWordRu(event.capacity) }} + лист ожидания</dd>
              <template v-if="bookingWindow">
                <dt>Запись</dt>
                <dd data-booking-opens>{{ bookingWindow.opens }}</dd>
                <template v-if="bookingWindow.closes">
                  <dt>Закроется</dt>
                  <dd data-booking-closes>{{ bookingWindow.closes }}</dd>
                </template>
              </template>
              <template v-if="eventLevel">
                <dt>Уровень</dt>
                <dd>{{ eventLevel }}</dd>
              </template>
              <template v-if="event.seriesId">
                <dt>Серия</dt>
                <dd>Событие повторяющейся серии</dd>
              </template>
            </dl>
          </section>

          <section
            v-if="showPayments && payments"
            class="vt-card vt-desktop-event-detail__payments"
            aria-labelledby="event-payments-title"
          >
            <div class="vt-desktop-event-detail__payments-head">
              <h2 id="event-payments-title">Оплаты</h2>
              <span class="vt-mono"
                >{{ payments.paid + payments.subscription }} / {{ payments.total }} мест</span
              >
              <DesktopAllPaymentsLink :org-id="orgId" />
            </div>
            <div
              class="vt-desktop-event-detail__segments"
              role="img"
              :aria-label="`Оплачено ${payments.paid}, по абонементу ${payments.subscription}, ждут ${payments.pending}, сумма после закрытия ${payments.afterClose}`"
            >
              <span
                v-for="n in payments.paid"
                :key="`p${n}`"
                class="vt-desktop-event-detail__segment is-paid"
              />
              <span
                v-for="n in payments.subscription"
                :key="`s${n}`"
                class="vt-desktop-event-detail__segment is-subscription"
              />
              <span
                v-for="n in payments.pending"
                :key="`w${n}`"
                class="vt-desktop-event-detail__segment is-pending"
              />
              <span
                v-for="n in payments.afterClose"
                :key="`a${n}`"
                class="vt-desktop-event-detail__segment is-after-close"
              />
            </div>
            <ul class="vt-desktop-event-detail__legend">
              <li>Оплачено {{ payments.paid }}</li>
              <li v-if="payments.subscription > 0">Абон. {{ payments.subscription }}</li>
              <li>{{ pendingLabel(payments.pending) }}</li>
              <li v-if="payments.afterClose > 0">Сумма после закрытия {{ payments.afterClose }}</li>
            </ul>
          </section>
        </aside>
      </div>

      <VtAlert
        v-model="cancelOpen"
        wide
        danger
        title="Отменить событие?"
        confirm-label="Отменить событие"
        cancel-label="Не отменять"
        @confirm="cancelEvent"
      >
        <ul class="vt-desktop-event-detail__consequences">
          <li v-for="line in consequences.lines" :key="line">{{ line }}</li>
        </ul>
      </VtAlert>
    </template>
  </div>
</template>
