<script setup lang="ts">
import { DEFAULT_TIMEZONE, type ManagerReport } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import {
  currentMonthKey,
  miniappReportView,
  monthFromQuery,
  reportMonthPeriod,
  shiftReportMonth,
} from '~/utils/miniapp-report'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/** Отчёт за месяц (M-24, 21.1.3): цифры те же, что в отчётах кабинета (W-10, 21.2.7). */
const route = useRoute()
const router = useRouter()
const orgId = computed(() => Number(route.params.orgId))
const { data: orgData } = await useFetch<{ organization: { defaultTimezone: string } }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `m-reports-org-${orgId.value}` },
)
const tz = computed(() => orgData.value?.organization.defaultTimezone ?? DEFAULT_TIMEZONE)
const current = computed(() => currentMonthKey(new Date(), tz.value))
const month = computed(() => monthFromQuery(route.query.month, current.value))
const period = computed(() => reportMonthPeriod(month.value))
const canNext = computed(() => month.value < current.value)

const { data, pending, error, refresh } = await useFetch<ManagerReport>(
  () => `/api/organizations/${orgId.value}/reports`,
  {
    query: computed(() => ({ from: period.value.from, to: period.value.to })),
    key: () => `m-reports-${orgId.value}-${period.value.from}`,
  },
)
const forbidden = computed(() => apiErrorStatus(error.value) === 403)
const view = computed(() => (data.value ? miniappReportView(data.value) : null))

function go(delta: number) {
  void router.replace({ query: { month: shiftReportMonth(month.value, delta) } })
}
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="Отчёт за месяц" :back="`/m/orgs/${orgId}/members`" />

    <main class="px-4 pb-4">
      <div class="flex items-center justify-center gap-2 py-2">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44 !px-2"
          aria-label="Предыдущий месяц"
          @click="go(-1)"
        >
          <VtIcon name="chevron-l" :size="16" />
        </button>
        <span class="text-base font-semibold" aria-live="polite">{{ period.label }}</span>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44 !px-2"
          aria-label="Следующий месяц"
          :disabled="!canNext"
          @click="go(1)"
        >
          <VtIcon name="chevron-r" :size="16" />
        </button>
      </div>

      <SkeletonList v-if="pending && !data" :count="3" />
      <ErrorState
        v-else-if="forbidden"
        message="Отчёт доступен организатору группы"
        @retry="refresh()"
      />
      <ErrorState
        v-else-if="error || !view"
        message="Не удалось загрузить отчёт"
        @retry="refresh()"
      />
      <div v-else class="space-y-2.5" :aria-busy="pending">
        <section class="vt-card vt-card--hero p-4" aria-labelledby="m-report-net">
          <p id="m-report-net" class="vt-cap opacity-60">Итог месяца · касса</p>
          <p class="vt-mono mt-1.5 text-3xl font-bold" data-report="net">{{ view.net.value }}</p>
          <dl class="mt-3.5 flex gap-4">
            <div>
              <dt class="vt-cap opacity-60">поступило</dt>
              <dd class="vt-mono mt-1 font-semibold" data-report="income">{{ view.income }}</dd>
            </div>
            <div>
              <dt class="vt-cap opacity-60">расходы</dt>
              <dd class="vt-mono mt-1 font-semibold" data-report="expense">{{ view.expense }}</dd>
            </div>
          </dl>
        </section>

        <ul class="grid grid-cols-2 gap-2" aria-label="Итоги месяца">
          <li class="vt-card px-3.5 py-3">
            <span class="vt-cap text-vt-mute-2">Событий</span>
            <strong class="vt-mono mt-1 block text-xl" data-report="events">{{
              view.events.value
            }}</strong>
            <small class="text-[11px] text-vt-mute-2">{{ view.events.caption }}</small>
          </li>
          <li class="vt-card px-3.5 py-3">
            <span class="vt-cap text-vt-mute-2">Заполняемость</span>
            <strong class="vt-mono mt-1 block text-xl" data-report="occupancy">{{
              view.occupancy.value
            }}</strong>
            <small class="text-[11px] text-vt-mute-2">{{ view.occupancy.caption }}</small>
          </li>
          <li class="vt-card col-span-2 px-3.5 py-3">
            <span class="vt-cap text-vt-mute-2">Посещаемость</span>
            <strong class="vt-mono mt-1 block text-xl" data-report="visits">{{
              view.visits.value
            }}</strong>
            <small class="text-[11px] text-vt-mute-2">визитов · {{ view.visits.caption }}</small>
          </li>
        </ul>

        <section aria-labelledby="m-report-top">
          <h2 id="m-report-top" class="vt-cap mx-1 mb-2 mt-5 text-vt-mute-2">Самые активные</h2>
          <p v-if="view.top.length === 0" class="vt-card px-3.5 py-3 text-sm text-vt-mute-2">
            За месяц никто не отмечен как пришедший.
          </p>
          <ol v-else class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
            <li
              v-for="(player, index) in view.top"
              :key="player.userId"
              class="flex items-center gap-3 px-3.5 py-2.5"
            >
              <span
                class="vt-mono w-4 text-sm font-bold"
                :class="{ 'text-vt-flame': index === 0 }"
                >{{ index + 1 }}</span
              >
              <VtAvatar :name="player.name" size="sm" />
              <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{{
                player.name
              }}</span>
              <span class="vt-mono text-sm">{{ player.visits }}</span>
            </li>
          </ol>
        </section>
      </div>
    </main>
  </div>
</template>
