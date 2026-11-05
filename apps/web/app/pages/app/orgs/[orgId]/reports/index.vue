<script setup lang="ts">
import type { Organization } from '@volley-time/db'
import {
  DEFAULT_TIMEZONE,
  reportPeriodPresets,
  type ManagerReport,
  type ReportExportType,
} from '@volley-time/shared'

import { periodFromQuery, reportQuery, type ReportDates } from '~/utils/desktop-reports'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
// организация уже загружена layout `desktop-org` под тем же ключом
const { data: orgData } = await useFetch<{ organization: Organization }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-org-${orgId.value}` },
)
const tz = computed(() => orgData.value?.organization.defaultTimezone ?? DEFAULT_TIMEZONE)
const presets = computed(() => reportPeriodPresets(new Date(), tz.value))
const dates = computed<ReportDates>(() =>
  periodFromQuery(route.query, { from: presets.value[0]!.from, to: presets.value[0]!.to }),
)

const { data, pending, error, refresh } = await useFetch<ManagerReport>(
  () => `/api/organizations/${orgId.value}/reports`,
  {
    query: computed(() => reportQuery(dates.value)),
    key: () => `desktop-reports-${orgId.value}-${dates.value.from}-${dates.value.to}`,
  },
)

function select(next: ReportDates) {
  void router.replace({ query: { from: next.from, to: next.to } })
}

function exportQuery(type: ReportExportType) {
  return { type, from: dates.value.from, to: dates.value.to }
}

const READY_REPORTS: { type: ReportExportType; title: string; text: string; icon: string }[] = [
  {
    type: 'finance',
    title: 'Финансовый отчёт',
    text: 'Касса, поступления, расходы по категориям',
    icon: 'wallet',
  },
  {
    type: 'attendance',
    title: 'Посещаемость',
    text: 'Кто сколько ходил, неявки, отмены',
    icon: 'users',
  },
]
</script>

<template>
  <div class="vt-desktop-reports space-y-6">
    <header class="vt-desktop-reports__heading">
      <div>
        <p class="vt-cap">Кабинет организатора</p>
        <h1 tabindex="-1">Отчёты</h1>
        <p class="text-vt-mute-2">Аналитика по кассе, событиям и игрокам</p>
      </div>
      <NuxtLink
        :to="{ path: `${base}/reports/export`, query: exportQuery('finance') }"
        class="vt-btn vt-btn--primary vt-btn--sm"
      >
        <VtIcon name="arrow-d" :size="14" /> Экспорт CSV
      </NuxtLink>
    </header>

    <DesktopReportsPeriodPicker :presets="presets" :dates="dates" @select="select" />

    <SkeletonList v-if="pending && !data" :count="3" />
    <ErrorState
      v-else-if="error || !data"
      message="Не удалось загрузить отчёты"
      @retry="refresh()"
    />
    <div v-else :aria-busy="pending">
      <DesktopReportsOverview :report="data" />

      <h2 class="vt-desktop-reports__ready-title">Готовые отчёты</h2>
      <div class="vt-desktop-reports__ready">
        <NuxtLink
          v-for="item in READY_REPORTS"
          :key="item.type"
          :to="{ path: `${base}/reports/export`, query: exportQuery(item.type) }"
          class="vt-card vt-desktop-reports__ready-card"
        >
          <VtIcon :name="item.icon" :size="22" />
          <strong>{{ item.title }}</strong>
          <small>{{ item.text }}</small>
          <span class="vt-desktop-reports__ready-link"
            >Скачать CSV <VtIcon name="arrow-d" :size="12"
          /></span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
