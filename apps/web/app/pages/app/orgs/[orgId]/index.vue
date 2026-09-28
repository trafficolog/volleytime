<script setup lang="ts">
import { formatDay, formatTime } from '@volley-time/shared'

import type { DashboardResponse } from '~/utils/desktop-dashboard'
import { desktopDashboardView } from '~/utils/desktop-dashboard'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
const { data, pending, error, refresh } = await useFetch<DashboardResponse>(
  () => `/api/organizations/${orgId.value}/dashboard`,
  { key: () => `desktop-dashboard-${orgId.value}` },
)
const view = computed(() => desktopDashboardView(data.value ?? null))
</script>

<template>
  <div class="vt-desktop-dashboard space-y-6">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Кабинет организатора</p>
        <h1 tabindex="-1">Обзор</h1>
        <p class="text-vt-mute-2">Состояние группы по последним данным сервера</p>
      </div>
      <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary">
        <VtIcon name="plus" :size="16" /> Новая тренировка
      </NuxtLink>
    </header>

    <SkeletonList v-if="pending" :count="3" />
    <ErrorState
      v-else-if="error || !view"
      message="Не удалось загрузить обзор группы"
      @retry="refresh()"
    />
    <template v-else>
      <DesktopDashboardCards :view="view" />

      <section
        class="vt-card vt-desktop-dashboard__upcoming"
        aria-labelledby="desktop-upcoming-title"
      >
        <div class="vt-desktop-dashboard__section-heading">
          <h2 id="desktop-upcoming-title">Ближайшие события</h2>
          <NuxtLink :to="`${base}/events`" class="vt-btn vt-btn--ghost vt-btn--sm"
            >Все события</NuxtLink
          >
        </div>
        <div v-if="view.upcoming.length === 0" class="vt-desktop-dashboard__empty">
          <p>Ближайших событий пока нет.</p>
          <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--ghost"
            >Создать событие</NuxtLink
          >
        </div>
        <ul v-else class="vt-desktop-dashboard__event-list">
          <li v-for="event in view.upcoming.slice(0, 4)" :key="event.id">
            <NuxtLink :to="`${base}/events/${event.id}`" class="vt-desktop-dashboard__event">
              <span class="vt-desktop-dashboard__date vt-mono">{{
                formatDay(event.startsAt, tz)
              }}</span>
              <span class="vt-desktop-dashboard__event-text">
                <strong>{{ event.title }}</strong>
                <small>
                  {{ formatTime(event.startsAt, tz) }} ·
                  {{ event.venue?.name ?? event.locationText ?? 'Площадка не указана' }}
                </small>
              </span>
              <span class="vt-desktop-dashboard__seats vt-mono"
                >{{ event.taken }}/{{ event.capacity }}</span
              >
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
