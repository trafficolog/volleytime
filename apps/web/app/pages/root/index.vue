<script setup lang="ts">
import type { PlatformOverview } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import { rootOverviewFailure, rootOverviewView } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })

const { data, pending, error, refresh } = await useFetch<PlatformOverview>(
  '/api/platform/overview',
  { key: 'root-platform-overview' },
)
// Роль root решает API: вошедший не-root получает 403 (страница ошибки), истёкшая сессия — вход
const failure = rootOverviewFailure(apiErrorStatus(error.value))
if (error.value && failure === 'forbidden') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Раздел доступен только администратору платформы',
    fatal: true,
  })
}
if (error.value && failure === 'login') await navigateTo('/auth/login')
const view = computed(() => (data.value ? rootOverviewView(data.value) : null))
</script>

<template>
  <div class="vt-root-overview">
    <header class="vt-root-overview__heading">
      <div>
        <h1 tabindex="-1">
          Обзор платформы <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p v-if="view" class="text-vt-mute-2">{{ view.subtitle }}</p>
      </div>
    </header>

    <SkeletonList v-if="pending && !view" :count="3" />
    <ErrorState
      v-else-if="error || !view"
      message="Не удалось загрузить обзор платформы"
      @retry="refresh()"
    />
    <template v-else>
      <div class="vt-root-overview__tiles">
        <section class="vt-card vt-card--hero vt-root-overview__north" aria-labelledby="root-north">
          <span class="vt-root-overview__ball" aria-hidden="true" />
          <h2 id="root-north" class="vt-cap">Главная метрика · активные группы за неделю</h2>
          <p class="vt-root-overview__north-value vt-mono" data-metric="north-star">
            {{ view.northStar.value }}
          </p>
          <p class="vt-root-overview__north-meta">
            <span :data-direction="view.northStar.delta.direction">{{
              view.northStar.delta.text
            }}</span>
            <span>{{ view.northStar.caption }}</span>
          </p>
        </section>

        <section class="vt-card vt-root-overview__tile" aria-labelledby="root-events">
          <h2 id="root-events" class="vt-cap">Событий за неделю</h2>
          <p class="vt-root-overview__tile-value vt-mono" data-metric="events-week">
            {{ view.events.value }}
          </p>
          <p class="vt-root-overview__delta" :data-direction="view.events.delta.direction">
            {{ view.events.delta.text }}
          </p>
        </section>

        <section class="vt-card vt-root-overview__tile" aria-labelledby="root-bookings">
          <h2 id="root-bookings" class="vt-cap">Записей за неделю</h2>
          <p class="vt-root-overview__tile-value vt-mono" data-metric="bookings-week">
            {{ view.bookings.value }}
          </p>
          <p class="vt-root-overview__delta" :data-direction="view.bookings.delta.direction">
            {{ view.bookings.delta.text }}
          </p>
        </section>
      </div>

      <div class="vt-root-overview__panels">
        <section class="vt-card vt-root-overview__panel" aria-labelledby="root-gate">
          <div class="vt-root-overview__panel-head">
            <h2 id="root-gate">Гипотезы Phase 10</h2>
            <span class="vt-mono"> {{ view.reachedCount }} / {{ view.gate.length }} </span>
          </div>
          <ul class="vt-root-overview__gate">
            <li v-for="m in view.gate" :key="m.key" :data-state="m.state">
              <div class="vt-root-overview__gate-row">
                <span>{{ m.label }}</span>
                <b class="vt-mono">{{ m.valueText }}</b>
              </div>
              <VtMeter :value="m.percent" :max="100" :label="m.label" />
              <div class="vt-root-overview__gate-foot vt-mono">
                <span>{{ m.targetText }}</span>
                <span>{{ m.statusText }}</span>
              </div>
            </li>
          </ul>
        </section>

        <section class="vt-card vt-root-overview__panel" aria-labelledby="root-chart">
          <div class="vt-root-overview__panel-head">
            <h2 id="root-chart">Записи · 14 дней</h2>
            <span class="vt-mono">{{ view.bookingsTotal14d }}</span>
          </div>
          <ol class="vt-root-overview__bars" aria-label="Записи по дням, сутки UTC">
            <li
              v-for="bar in view.bars"
              :key="bar.date"
              :data-today="bar.today"
              :title="`${bar.date}: ${bar.count}`"
            >
              <i :style="{ height: `${bar.height}%` }" />
              <span class="sr-only">{{ bar.date }}: {{ bar.count }}</span>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>
