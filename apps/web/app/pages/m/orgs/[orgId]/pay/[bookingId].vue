<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { MyBooking } from '~/components/PlayerBookingRow.vue'
import PlayerPaymentInstructions from '~/components/PlayerPaymentInstructions.vue'
import { seatsLabel } from '~/utils/booking-seats'
import { canPayBooking } from '~/utils/player-booking-payment'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Экран оплаты записи (21.4.8, M-13): включённые способы группы и реквизиты организатора
 * (21.2.11). Только показ: записи и платежа экран не меняет, онлайн-оплаты нет. Запись берётся
 * из собственного списка `bookings/my`, поэтому чужой или чужегрупповой id просто не находится.
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const bookingId = computed(() => Number(route.params.bookingId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)

const booking = ref<MyBooking | null>(null)
const loading = ref(false)
const loadError = ref('')
let loadSeq = 0

async function load() {
  const mine = ++loadSeq
  const requestedOrgId = orgId.value
  loading.value = true
  loadError.value = ''
  try {
    const { bookings } = await $fetch<{ bookings: MyBooking[] }>(
      `/api/organizations/${requestedOrgId}/bookings/my`,
      { query: { filter: 'upcoming', limit: 100 } },
    )
    if (mine !== loadSeq) return
    booking.value =
      bookings.find(
        (b) =>
          b.id === bookingId.value &&
          b.organizationId === requestedOrgId &&
          b.event.organizationId === requestedOrgId,
      ) ?? null
  } catch (e) {
    if (mine !== loadSeq) return
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить запись')
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
await load()

const payable = computed(() => !!booking.value && canPayBooking(booking.value))
const seats = computed(() => booking.value?.seats ?? 1)
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Оплата" :back="`${base}/bookings`" />
    <main class="space-y-3 px-4 py-3">
      <SkeletonList v-if="loading" :count="2" />
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <EmptyState v-else-if="!booking" icon="calendar" title="Запись не найдена">
        <template #action>
          <NuxtLink :to="`${base}/bookings`" class="vt-btn vt-btn--ghost">Мои записи</NuxtLink>
        </template>
      </EmptyState>
      <EmptyState v-else-if="!payable" icon="check" title="Оплата не требуется">
        <template #action>
          <NuxtLink :to="`${base}/bookings`" class="vt-btn vt-btn--ghost">Мои записи</NuxtLink>
        </template>
      </EmptyState>
      <template v-else>
        <section class="vt-card vt-card--raised p-3.5" aria-label="Запись">
          <p class="vt-cap text-vt-mute-2">{{ formatDay(booking.event.startsAt, tz) }}</p>
          <p class="mt-1 text-base font-bold">{{ booking.event.title }}</p>
          <p class="mt-0.5 text-xs text-vt-mute-2">
            {{ formatTime(booking.event.startsAt, tz)
            }}<template v-if="booking.event.venue"> · {{ booking.event.venue.name }}</template>
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <VtChip tone="amber">Ждёт оплаты</VtChip>
            <VtChip v-if="seats > 1">{{ seatsLabel(seats) }}</VtChip>
          </div>
          <PlayerPaymentInstructions :org-id="orgId" />
        </section>
        <p class="px-1 text-xs text-vt-mute-2">
          Организатор подтвердит оплату после получения: статус записи обновится в «Моих записях».
        </p>
        <NuxtLink :to="`${base}/bookings`" class="vt-btn vt-btn--ghost vt-btn--full"
          >К моим записям</NuxtLink
        >
      </template>
    </main>
  </div>
</template>
