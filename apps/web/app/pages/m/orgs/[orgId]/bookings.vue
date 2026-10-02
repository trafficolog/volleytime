<script setup lang="ts">
import type { Booking, Event, Venue } from '@volley-time/db'
import { formatDay, formatTime, type EventPricingView } from '@volley-time/shared'

import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { BOOKING_STATUS_LABELS, label } from '~/utils/labels'
import {
  canCancelPlayerBooking,
  createPlayerBookingsLoader,
  runPlayerBookingCancellation,
} from '~/utils/player-bookings-loader'
import { playerAccessFromApiError } from '~/utils/player-home'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type MyBooking = Booking & { pricing: EventPricingView; event: Event & { venue: Venue | null } }

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { confirm, haptic } = useTelegram()

const filter = ref<'upcoming' | 'past'>('upcoming')
const items = ref<MyBooking[]>([])
const loading = ref(false)
const loadError = ref('')
const accessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const actionError = ref('')
const cancelling = ref<number | null>(null)
const cancellationGuard = createPlayerRequestGuard(() => `${orgId.value}:${filter.value}`)
const loadView = createPlayerBookingsLoader<MyBooking>(
  () => orgId.value,
  () => filter.value,
  async (requestedOrgId, requestedFilter) =>
    (
      await $fetch<{ bookings: MyBooking[] }>(`/api/organizations/${requestedOrgId}/bookings/my`, {
        query: { filter: requestedFilter },
      })
    ).bookings.filter(
      (booking) =>
        (booking.status !== 'cancelled' ||
          (booking.pricing?.mode === 'split' && booking.pricing.myAllocatedAmount !== null)) &&
        booking.organizationId === requestedOrgId &&
        booking.event.organizationId === requestedOrgId,
    ),
)
let currentLoad: ReturnType<typeof loadView> | null = null

async function load() {
  const request = loadView()
  currentLoad = request
  loading.value = true
  loadError.value = ''
  accessNotice.value = null
  try {
    const result = await request
    if (result.stale) return
    items.value = result.bookings
  } catch (e) {
    if (currentLoad === request) {
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить записи')
      accessNotice.value = playerAccessFromApiError(apiErrorCode(e))
    }
  } finally {
    if (currentLoad === request) loading.value = false
  }
}
await load()
watch(
  [orgId, filter],
  () => {
    cancellationGuard.invalidate()
    items.value = []
    actionError.value = ''
    cancelling.value = null
    void load()
  },
  { flush: 'sync' },
)

const TONE: Record<string, 'grass' | 'amber' | 'default' | 'rose'> = {
  confirmed: 'grass',
  attended: 'grass',
  pending_payment: 'amber',
  waitlisted: 'default',
  no_show: 'rose',
}

async function onCancel(b: MyBooking) {
  if (cancelling.value !== null || !canCancel(b)) return
  const request = cancellationGuard.begin()
  actionError.value = ''
  if (!(await confirm(`Отменить запись на «${b.event.title}»?`))) return
  if (!request.isCurrent() || !items.value.some((item) => item.id === b.id)) return
  cancelling.value = b.id
  const requestedOrgId = orgId.value
  const outcome = await runPlayerBookingCancellation(
    bookingPolicy(b),
    new Date(),
    (bookingId) =>
      $fetch<void>(`/api/organizations/${requestedOrgId}/bookings/${bookingId}/cancel` as string, {
        method: 'POST',
      }),
    request.isCurrent,
    load,
  )
  if (outcome.kind === 'success') {
    haptic('success')
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отменить запись')
  } else if (outcome.kind === 'blocked') {
    actionError.value = 'Отменить запись уже нельзя — прошёл дедлайн отмены.'
  }
  if (request.isCurrent()) cancelling.value = null
}

function bookingPolicy(booking: MyBooking) {
  return {
    id: booking.id,
    status: booking.status,
    startsAt: booking.event.startsAt,
    cancellationDeadlineHours: booking.event.cancellationDeadlineHours,
  }
}

function canCancel(booking: MyBooking) {
  return (
    filter.value === 'upcoming' &&
    booking.pricing.myAllocatedAmount === null &&
    canCancelPlayerBooking(bookingPolicy(booking), new Date())
  )
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Мои записи" :back="`/m/orgs/${orgId}`" />
    <div class="px-4 pt-3 flex gap-1" role="group" aria-label="Период записей">
      <button
        v-for="f in [
          { id: 'upcoming', label: 'Предстоящие' },
          { id: 'past', label: 'Прошедшие' },
        ] as const"
        :key="f.id"
        type="button"
        :aria-pressed="filter === f.id"
        class="vt-btn vt-btn--sm flex-1 !rounded-full"
        :class="filter === f.id ? 'vt-btn--ink' : 'text-vt-mute-2'"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>
    <main class="px-4 py-3 space-y-3">
      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <SkeletonList v-if="loading" :count="2" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="items.length === 0"
        icon="calendar"
        :title="filter === 'upcoming' ? 'Нет предстоящих записей' : 'Прошедших записей нет'"
      >
        <template v-if="filter === 'upcoming'" #action>
          <NuxtLink :to="`/m/orgs/${orgId}/events`" class="vt-btn vt-btn--primary"
            >Посмотреть события</NuxtLink
          >
        </template>
      </EmptyState>
      <ul v-else class="space-y-2.5">
        <li v-for="b in items" :key="b.id" class="vt-card p-3.5">
          <NuxtLink
            :to="`/m/orgs/${orgId}/events/${b.event.id}`"
            class="vt-hit-44 flex items-center gap-3"
          >
            <div class="w-14 text-center shrink-0">
              <div class="vt-cap !text-[10px]">
                {{ formatDay(b.event.startsAt, tz).split(',')[0] }}
              </div>
              <div class="vt-mono font-bold">{{ formatTime(b.event.startsAt, tz) }}</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold truncate">{{ b.event.title }}</div>
              <div class="text-xs text-vt-mute-2 truncate">
                {{ formatDay(b.event.startsAt, tz)
                }}<template v-if="b.event.venue"> · {{ b.event.venue.name }}</template>
              </div>
              <div class="vt-mono text-xs mt-1">
                {{ eventPricingLabel(b.pricing, b.event.currency).text }}
              </div>
              <p
                v-if="b.pricing.mode === 'split' && b.pricing.basis !== 'settled'"
                class="text-xs text-vt-mute-2 mt-1"
              >
                {{ eventPricingLabel(b.pricing, b.event.currency).description }}
              </p>
              <p
                v-if="b.status === 'waitlisted' && b.pricing.mode === 'split'"
                class="text-xs text-vt-mute-2 mt-1"
              >
                {{ splitBookingPaymentLabel(b.pricing, b.status)?.description }}
              </p>
            </div>
            <VtChip
              v-if="splitBookingPaymentLabel(b.pricing, b.status)"
              :tone="splitBookingPaymentLabel(b.pricing, b.status)!.tone"
              >{{ splitBookingPaymentLabel(b.pricing, b.status)!.text }}</VtChip
            >
            <VtChip v-else :tone="TONE[b.status] ?? 'default'">{{
              label(BOOKING_STATUS_LABELS, b.status)
            }}</VtChip>
          </NuxtLink>
          <button
            v-if="canCancel(b)"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm vt-btn--full mt-3"
            :disabled="cancelling === b.id"
            @click="onCancel(b)"
          >
            Отменить запись
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
