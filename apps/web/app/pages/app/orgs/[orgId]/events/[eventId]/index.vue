<script setup lang="ts">
import type { EventBookingRow } from '@volley-time/core'
import type { Event } from '@volley-time/db'
import {
  formatDay,
  formatTime,
  type EventPricingView,
  type PricingFinancials,
  type PricingPermissions,
} from '@volley-time/shared'

import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'
import {
  BOOKING_METHOD_LABELS,
  BOOKING_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  displayName,
  formatPrice,
  formatMoneyRu,
} from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

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
    waitlist: number
    venue: { name: string } | null
    pricing: EventPricingView
    pricingPermissions?: PricingPermissions
    pricingFinancials?: PricingFinancials
  }
}>(() => `/api/organizations/${orgId.value}/events/${eventId.value}`, {
  key: () => `desktop-event-${orgId.value}-${eventId.value}`,
})
const event = computed(() => {
  const candidate = data.value?.event
  return candidate?.id === eventId.value && candidate.organizationId === orgId.value
    ? candidate
    : null
})
const rows = ref<EventBookingRow[]>([])
const rosterLoading = ref(false)
const rosterError = ref('')
const actionError = ref('')
const busy = ref(false)
let generation = 0
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

watch(
  [orgId, eventId],
  () => {
    generation++
    rows.value = []
    actionError.value = ''
    void loadRoster()
  },
  { immediate: true },
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
      await Promise.all([refresh(), loadRoster()])
  } catch (cause) {
    if (settlementRouteCurrent(target.organizationId, target.id))
      actionError.value = apiErrorMessage(
        cause,
        'Не удалось распределить сумму. Обновите событие и попробуйте снова.',
      )
  } finally {
    if (settlementRouteCurrent(target.organizationId, target.id)) busy.value = false
  }
}

async function afterAction(targetOrgId: number, targetEventId: number) {
  if (!alive || route.path !== livePath(targetOrgId, targetEventId)) return
  await Promise.all([refresh(), loadRoster()])
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

async function cancelEvent() {
  const target = event.value
  if (!target || !canAct(target.organizationId, target.id)) return
  if (!window.confirm('Отменить событие? Записи будут отменены, оплаты и абонементы возвращены.'))
    return
  if (!canAct(target.organizationId, target.id)) return
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
  if (!window.confirm(`Снять ${displayName(booking.user)} с события?`)) return
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
          <p class="vt-cap">{{ EVENT_STATUS_LABELS[event.status] ?? event.status }}</p>
          <h1 tabindex="-1">{{ event.title }}</h1>
          <p class="text-vt-mute-2">
            {{ formatDay(event.startsAt, tz) }}, {{ formatTime(event.startsAt, tz) }} ·
            {{ event.venue?.name ?? event.locationText ?? 'Площадка не указана' }}
          </p>
        </div>
        <NuxtLink
          v-if="event.status !== 'cancelled' && !started"
          :to="`${base}/${event.id}/edit`"
          class="vt-btn vt-btn--ghost"
          >Изменить событие</NuxtLink
        >
      </header>

      <div class="vt-desktop-event-detail__stats">
        <div class="vt-card">
          <strong class="vt-mono">{{ event.taken }}/{{ event.capacity }}</strong
          ><span>В составе</span>
        </div>
        <div class="vt-card">
          <strong class="vt-mono">{{
            rosterLoading || rosterError
              ? '—'
              : inRoster.filter((b) => b.status === 'pending_payment' && b.paymentId !== null)
                  .length
          }}</strong
          ><span>Ждут оплаты</span>
        </div>
        <div class="vt-card">
          <strong class="vt-mono">{{ event.waitlist }}</strong
          ><span>В ожидании</span>
        </div>
        <div class="vt-card">
          <strong class="vt-mono">{{
            event.pricing?.mode === 'split'
              ? 'После закрытия'
              : formatPrice(event.price, event.currency)
          }}</strong
          ><span>Цена участия</span>
        </div>
      </div>

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
      <EventPricingPanel
        v-if="event.pricing?.mode === 'split'"
        :pricing="event.pricing"
        :financials="event.pricingFinancials ?? null"
        :currency="event.currency"
        :can-settle="event.pricingPermissions?.canSettle === true"
        :pending="busy"
        @settle="settlePricing"
      />

      <section
        class="vt-card vt-desktop-event-detail__roster"
        aria-labelledby="desktop-roster-title"
      >
        <div class="vt-desktop-dashboard__section-heading">
          <h2 id="desktop-roster-title">Состав{{ started ? ' · посещаемость' : '' }}</h2>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="loadRoster">
            Обновить состав
          </button>
        </div>
        <SkeletonList v-if="rosterLoading" :count="2" />
        <ErrorState v-else-if="rosterError" :message="rosterError" @retry="loadRoster" />
        <p v-else-if="inRoster.length === 0" class="text-vt-mute-2">Пока никто не записан.</p>
        <ul v-else class="vt-desktop-event-detail__rows">
          <li v-for="booking in inRoster" :key="booking.id">
            <VtAvatar size="sm" :name="displayName(booking.user)" :src="booking.user.image" />
            <div class="vt-desktop-event-detail__person">
              <strong>{{ displayName(booking.user) }}</strong>
              <span>{{ BOOKING_METHOD_LABELS[booking.method] ?? booking.method }}</span>
            </div>
            <span>{{
              booking.status === 'pending_payment' &&
              !booking.paymentId &&
              event.pricing?.mode === 'split'
                ? 'Сумма после закрытия'
                : (BOOKING_STATUS_LABELS[booking.status] ?? booking.status)
            }}</span>
            <div class="vt-desktop-event-detail__actions">
              <template
                v-if="
                  started && event.status !== 'cancelled' && booking.status !== 'pending_payment'
                "
              >
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  :disabled="busy"
                  :aria-label="`Был: ${displayName(booking.user)}`"
                  @click="mark(booking, true)"
                >
                  Был
                </button>
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  :disabled="busy"
                  :aria-label="`Не пришёл: ${displayName(booking.user)}`"
                  @click="mark(booking, false)"
                >
                  Не пришёл
                </button>
              </template>
              <button
                v-else-if="!started && event.status !== 'cancelled'"
                type="button"
                class="vt-btn vt-btn--ghost vt-btn--sm"
                :disabled="busy"
                :aria-label="`Снять с события: ${displayName(booking.user)}`"
                @click="removeBooking(booking)"
              >
                Снять
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="waitlist.length"
        class="vt-card vt-desktop-event-detail__roster"
        aria-labelledby="desktop-waitlist-title"
      >
        <h2 id="desktop-waitlist-title">Лист ожидания</h2>
        <ol class="vt-desktop-event-detail__rows">
          <li v-for="booking in waitlist" :key="booking.id">{{ displayName(booking.user) }}</li>
        </ol>
      </section>

      <button
        v-if="event.status !== 'cancelled' && !started"
        type="button"
        class="vt-btn vt-btn--danger"
        :disabled="busy"
        @click="cancelEvent"
      >
        Отменить событие
      </button>
    </template>
  </div>
</template>
