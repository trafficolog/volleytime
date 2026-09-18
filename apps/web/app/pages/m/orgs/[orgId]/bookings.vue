<script setup lang="ts">
import type { Booking, Event, Venue } from '@volley-time/db'
import { formatDay, formatTime } from '@volley-time/shared'
import { BOOKING_STATUS_LABELS, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type MyBooking = Booking & { event: Event & { venue: Venue | null } }

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { confirm, haptic } = useTelegram()

const filter = ref<'upcoming' | 'past'>('upcoming')
const items = ref<MyBooking[]>([])
const loading = ref(false)
const loadError = ref('')
const actionError = ref('')
const cancelling = ref<number | null>(null)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = (
      await $fetch<{ bookings: MyBooking[] }>(`/api/organizations/${orgId.value}/bookings/my`, {
        query: { filter: filter.value },
      })
    ).bookings.filter((b) => b.status !== 'cancelled')
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить записи')
  } finally {
    loading.value = false
  }
}
await load()
watch(filter, load)

const TONE: Record<string, 'grass' | 'amber' | 'default' | 'rose'> = {
  confirmed: 'grass',
  attended: 'grass',
  pending_payment: 'amber',
  waitlisted: 'default',
  no_show: 'rose',
}

async function onCancel(b: MyBooking) {
  actionError.value = ''
  if (!(await confirm(`Отменить запись на «${b.event.title}»?`))) return
  cancelling.value = b.id
  try {
    await $fetch(`/api/organizations/${orgId.value}/bookings/${b.id}/cancel`, { method: 'POST' })
    haptic('success')
    await load()
  } catch (e) {
    haptic('error')
    actionError.value = apiErrorMessage(e, 'Не удалось отменить запись')
  } finally {
    cancelling.value = null
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Мои записи" :back="`/m/orgs/${orgId}`" />
    <div class="px-4 pt-3 flex gap-1" role="tablist">
      <button
        v-for="f in [
          { id: 'upcoming', label: 'Предстоящие' },
          { id: 'past', label: 'Прошедшие' },
        ] as const"
        :key="f.id"
        type="button"
        role="tab"
        :aria-selected="filter === f.id"
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
          <NuxtLink :to="`/m/orgs/${orgId}/events/${b.event.id}`" class="flex items-center gap-3">
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
            </div>
            <VtChip :tone="TONE[b.status] ?? 'default'">{{
              label(BOOKING_STATUS_LABELS, b.status)
            }}</VtChip>
          </NuxtLink>
          <button
            v-if="
              filter === 'upcoming' &&
              ['confirmed', 'pending_payment', 'waitlisted'].includes(b.status)
            "
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
