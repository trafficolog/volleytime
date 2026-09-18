<script setup lang="ts">
import type { EventBookingRow } from '@volley-time/core'
import type { Event } from '@volley-time/db'
import { formatDay, formatTime } from '@volley-time/shared'
import { displayName } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const { tz } = useOrgTimezone(orgId)
const { confirm, haptic } = useTelegram()

const { data: evData, refresh: refreshEvent } = await useFetch<{
  event: Event & { taken: number; waitlist: number }
}>(() => `/api/organizations/${orgId.value}/events/${eventId.value}`)
const ev = computed(() => evData.value?.event ?? null)
const rows = ref<EventBookingRow[]>([])
const loadError = ref('')
const actionError = ref('')
const busy = ref(false)

async function loadRoster() {
  loadError.value = ''
  try {
    rows.value = (
      await $fetch<{ bookings: EventBookingRow[] }>(
        `/api/organizations/${orgId.value}/events/${eventId.value}/bookings`,
      )
    ).bookings
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить состав')
  }
}
await loadRoster()

const inRoster = computed(() =>
  rows.value.filter((b) =>
    ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(b.status),
  ),
)
const waitlist = computed(() => rows.value.filter((b) => b.status === 'waitlisted'))
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= new Date())

const STATUS_CHIP: Record<string, { tone: 'grass' | 'amber' | 'rose' | 'default'; text: string }> =
  {
    confirmed: { tone: 'grass', text: 'в составе' },
    pending_payment: { tone: 'amber', text: 'ждёт оплаты' },
    attended: { tone: 'grass', text: 'был' },
    no_show: { tone: 'rose', text: 'не пришёл' },
  }

async function mark(b: EventBookingRow, attended: boolean) {
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}/attendance`, {
      method: 'POST',
      body: { marks: [{ bookingId: b.id, attended }] },
    })
    haptic('light')
    await loadRoster()
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось отметить')
  } finally {
    busy.value = false
  }
}

async function removeBooking(b: EventBookingRow) {
  if (!(await confirm(`Снять ${displayName(b.user)} с события?`))) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/bookings/${b.id}/cancel`, { method: 'POST' })
    await Promise.all([loadRoster(), refreshEvent()])
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось снять запись')
  } finally {
    busy.value = false
  }
}

async function cancelEvent() {
  if (
    !(await confirm(
      'Отменить событие? Все записи будут отменены, абонементы и оплаты — возвращены.',
    ))
  )
    return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}/cancel`, {
      method: 'POST',
    })
    haptic('success')
    await Promise.all([loadRoster(), refreshEvent()])
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось отменить событие')
  } finally {
    busy.value = false
  }
}

async function publish() {
  busy.value = true
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}`, {
      method: 'PATCH',
      body: { status: 'published' },
    })
    await refreshEvent()
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось опубликовать')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader
      :title="ev?.title ?? 'Событие'"
      :sub="ev ? `${formatDay(ev.startsAt, tz)}, ${formatTime(ev.startsAt, tz)}` : undefined"
      :back="`/m/orgs/${orgId}/events/${eventId}`"
    >
      <template v-if="ev && ev.status !== 'cancelled' && !started" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/events/${eventId}/edit`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          <VtIcon name="edit" :size="14" /> Изменить
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <main v-if="ev" class="px-4 py-4 space-y-5">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="vt-card p-2.5">
          <div class="vt-mono font-bold text-lg">{{ ev.taken }}/{{ ev.capacity }}</div>
          <div class="vt-cap !text-[10px]">в составе</div>
        </div>
        <div class="vt-card p-2.5">
          <div class="vt-mono font-bold text-lg">
            {{ inRoster.filter((b) => b.status === 'pending_payment').length }}
          </div>
          <div class="vt-cap !text-[10px]">ждут оплаты</div>
        </div>
        <div class="vt-card p-2.5">
          <div class="vt-mono font-bold text-lg">{{ ev.waitlist }}</div>
          <div class="vt-cap !text-[10px]">в ожидании</div>
        </div>
      </div>

      <div v-if="ev.status === 'draft'" class="vt-card p-3.5 flex items-center gap-3">
        <VtChip tone="amber">Черновик</VtChip>
        <span class="text-sm text-vt-mute-2 flex-1">Игроки не видят событие</span>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--sm"
          :disabled="busy"
          @click="publish"
        >
          Опубликовать
        </button>
      </div>
      <VtChip v-if="ev.status === 'cancelled'" tone="rose">Событие отменено</VtChip>

      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <ErrorState v-if="loadError" :message="loadError" @retry="loadRoster" />

      <section>
        <h2 class="vt-cap mb-2">Состав{{ started ? ' · отметьте посещаемость' : '' }}</h2>
        <EmptyState v-if="inRoster.length === 0" icon="users" title="Никто не записан" />
        <ul v-else class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
          <li v-for="b in inRoster" :key="b.id" class="flex items-center gap-3 px-3.5 py-2.5">
            <VtAvatar size="sm" :name="displayName(b.user)" :src="b.user.image" />
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-semibold truncate">{{ displayName(b.user) }}</div>
              <div class="text-[11px] text-vt-mute-2">
                {{
                  b.method === 'subscription'
                    ? 'абонемент'
                    : b.method === 'cash'
                      ? 'наличные'
                      : b.method === 'transfer'
                        ? 'перевод'
                        : 'бесплатно'
                }}
              </div>
            </div>
            <VtChip :tone="STATUS_CHIP[b.status]?.tone ?? 'default'">{{
              STATUS_CHIP[b.status]?.text
            }}</VtChip>
            <template v-if="started && ev.status !== 'cancelled' && b.status !== 'pending_payment'">
              <button
                type="button"
                class="vt-btn vt-btn--sm"
                :class="b.status === 'attended' ? 'vt-btn--grass' : 'vt-btn--ghost'"
                :disabled="busy"
                aria-label="Был"
                @click="mark(b, true)"
              >
                <VtIcon name="check" :size="14" />
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--sm"
                :class="b.status === 'no_show' ? 'vt-btn--danger' : 'vt-btn--ghost'"
                :disabled="busy"
                aria-label="Не пришёл"
                @click="mark(b, false)"
              >
                <VtIcon name="close" :size="14" />
              </button>
            </template>
            <button
              v-else-if="!started && ev.status !== 'cancelled'"
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
              :disabled="busy"
              aria-label="Снять с события"
              @click="removeBooking(b)"
            >
              <VtIcon name="trash" :size="14" />
            </button>
          </li>
        </ul>
      </section>

      <section v-if="waitlist.length">
        <h2 class="vt-cap mb-2">Лист ожидания</h2>
        <ol class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
          <li v-for="(b, i) in waitlist" :key="b.id" class="flex items-center gap-3 px-3.5 py-2">
            <span class="vt-mono text-[11px] text-vt-mute w-4">{{ i + 1 }}</span>
            <VtAvatar size="sm" :name="displayName(b.user)" :src="b.user.image" />
            <span class="text-[13px] flex-1 truncate">{{ displayName(b.user) }}</span>
          </li>
        </ol>
      </section>

      <button
        v-if="ev.status !== 'cancelled' && !started"
        type="button"
        class="vt-btn vt-btn--danger vt-btn--full"
        :disabled="busy"
        @click="cancelEvent"
      >
        Отменить событие
      </button>
    </main>
  </div>
</template>
