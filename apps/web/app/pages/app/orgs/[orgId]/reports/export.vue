<script setup lang="ts">
import type { Organization } from '@volley-time/db'
import {
  DEFAULT_TIMEZONE,
  REPORT_EXPORT_COLUMNS,
  reportPeriodPresets,
  type ReportExportPreview,
  type ReportExportType,
} from '@volley-time/shared'

import {
  REPORT_TYPE_OPTIONS,
  exportTypeFromQuery,
  formatExportSize,
  periodFromQuery,
  reportExportHref,
  type ReportDates,
} from '~/utils/desktop-reports'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { data: orgData } = await useFetch<{ organization: Organization }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-org-${orgId.value}` },
)
const tz = computed(() => orgData.value?.organization.defaultTimezone ?? DEFAULT_TIMEZONE)
const presets = computed(() => reportPeriodPresets(new Date(), tz.value))
const dates = computed<ReportDates>(() =>
  periodFromQuery(route.query, { from: presets.value[0]!.from, to: presets.value[0]!.to }),
)
const type = computed<ReportExportType>(() => exportTypeFromQuery(route.query.type))
const allColumns = computed(() => REPORT_EXPORT_COLUMNS[type.value])
const selected = ref<string[]>([])
const resetColumns = () => {
  selected.value = allColumns.value.filter((c) => c.default).map((c) => c.key)
}
resetColumns()
watch(type, resetColumns)

const preview = ref<ReportExportPreview | null>(null)
const loading = ref(false)
const loadError = ref('')
let generation = 0
let alive = true

/** Колонки уходят в порядке макета, а не в порядке нажатий. */
const orderedColumns = computed(() =>
  allColumns.value.filter((c) => selected.value.includes(c.key)).map((c) => c.key),
)
const href = computed(() =>
  reportExportHref(orgId.value, type.value, dates.value, orderedColumns.value),
)

async function load() {
  const token = ++generation
  preview.value = null
  loadError.value = ''
  if (orderedColumns.value.length === 0) return
  loading.value = true
  try {
    const result = await $fetch<ReportExportPreview>(
      `/api/organizations/${orgId.value}/reports/export`,
      {
        query: {
          type: type.value,
          ...dates.value,
          columns: orderedColumns.value.join(','),
          preview: '1',
        },
      },
    )
    if (alive && token === generation) preview.value = result
  } catch (cause) {
    if (alive && token === generation)
      loadError.value = apiErrorMessage(cause, 'Не удалось подготовить предпросмотр')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}
watch([orgId, type, dates, orderedColumns], () => void load(), { immediate: true })
onBeforeUnmount(() => {
  alive = false
  generation++
})

function patchQuery(patch: Record<string, string>) {
  void router.replace({
    query: { type: type.value, from: dates.value.from, to: dates.value.to, ...patch },
  })
}
const toggle = (key: string) => {
  selected.value = selected.value.includes(key)
    ? selected.value.filter((k) => k !== key)
    : [...selected.value, key]
}
const canDownload = computed(
  () => preview.value !== null && !loading.value && orderedColumns.value.length > 0,
)
const typeTitle = computed(() => REPORT_TYPE_OPTIONS.find((o) => o.type === type.value)!.title)
</script>

<template>
  <div class="vt-desktop-reports space-y-6">
    <header class="vt-desktop-reports__heading">
      <div>
        <p class="vt-cap">Кабинет организатора</p>
        <h1 tabindex="-1">Экспорт отчёта</h1>
        <p class="text-vt-mute-2">Период, колонки и предпросмотр выгрузки</p>
      </div>
      <div class="vt-desktop-reports__actions">
        <NuxtLink
          :to="{ path: `${base}/reports`, query: { from: dates.from, to: dates.to } }"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          >Отмена</NuxtLink
        >
        <a
          v-if="canDownload"
          :href="href"
          download
          class="vt-btn vt-btn--primary vt-btn--sm"
          data-testid="reports-download"
        >
          <VtIcon name="arrow-d" :size="14" /> Скачать CSV
        </a>
        <button v-else type="button" class="vt-btn vt-btn--primary vt-btn--sm" disabled>
          <VtIcon name="arrow-d" :size="14" /> Скачать CSV
        </button>
      </div>
    </header>

    <div class="vt-desktop-reports__export">
      <div class="vt-desktop-reports__controls">
        <section class="vt-card vt-card--raised" aria-labelledby="reports-type-title">
          <h2 id="reports-type-title" class="vt-label">Отчёт</h2>
          <div class="vt-desktop-reports__types" role="group" aria-labelledby="reports-type-title">
            <button
              v-for="option in REPORT_TYPE_OPTIONS"
              :key="option.type"
              type="button"
              :aria-pressed="type === option.type"
              :class="{ 'is-active': type === option.type }"
              @click="patchQuery({ type: option.type })"
            >
              <VtIcon :name="option.icon" :size="17" />
              <span>{{ option.title }}</span>
              <VtIcon v-if="type === option.type" name="check" :size="15" />
            </button>
          </div>
          <h2 class="vt-label">Период</h2>
          <DesktopReportsPeriodPicker
            :presets="presets"
            :dates="dates"
            @select="(next) => patchQuery({ from: next.from, to: next.to })"
          />
          <p class="vt-desktop-reports__hint">
            Формат файла: CSV, UTF-8 с BOM — откроется в Excel.
          </p>
        </section>

        <section class="vt-card vt-card--raised" aria-labelledby="reports-columns-title">
          <div class="vt-desktop-reports__section-heading">
            <h2 id="reports-columns-title" class="vt-label">Колонки</h2>
            <span class="vt-desktop-reports__hint"
              >{{ orderedColumns.length }} из {{ allColumns.length }}</span
            >
          </div>
          <div
            class="vt-desktop-reports__chips"
            role="group"
            aria-labelledby="reports-columns-title"
          >
            <button
              v-for="column in allColumns"
              :key="column.key"
              type="button"
              class="vt-chip"
              :class="{ 'is-on': selected.includes(column.key) }"
              :aria-pressed="selected.includes(column.key)"
              @click="toggle(column.key)"
            >
              <VtIcon v-if="selected.includes(column.key)" name="check" :size="11" />{{
                column.label
              }}
            </button>
          </div>
        </section>
      </div>

      <div class="vt-desktop-reports__preview" :aria-busy="loading">
        <ul class="vt-desktop-reports__kpis vt-desktop-reports__kpis--export">
          <li class="vt-card vt-desktop-reports__kpi vt-desktop-reports__kpi--hero">
            <span class="vt-cap">{{ typeTitle }}</span>
            <strong class="vt-mono" data-testid="reports-total">{{ preview?.total ?? '—' }}</strong>
            <small>строк за период</small>
          </li>
          <li class="vt-card vt-desktop-reports__kpi">
            <span class="vt-cap">Колонки</span>
            <strong class="vt-mono">{{ orderedColumns.length }}</strong>
          </li>
          <li class="vt-card vt-desktop-reports__kpi">
            <span class="vt-cap">Размер</span>
            <strong class="vt-mono">{{ preview ? formatExportSize(preview.bytes) : '—' }}</strong>
          </li>
        </ul>

        <section class="vt-card vt-card--raised vt-desktop-reports__table-card">
          <div class="vt-desktop-reports__section-heading">
            <h2>Предпросмотр</h2>
            <span v-if="preview" class="vt-desktop-reports__hint"
              >первые {{ preview.rows.length }} из {{ preview.total }}</span
            >
          </div>
          <p v-if="orderedColumns.length === 0" class="vt-desktop-reports__empty">
            Выберите хотя бы одну колонку.
          </p>
          <p v-else-if="loadError" class="vt-desktop-reports__error" role="alert">
            {{ loadError }}
            <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load()">
              Повторить
            </button>
          </p>
          <p v-else-if="preview && preview.total === 0" class="vt-desktop-reports__empty">
            За период нет данных для выгрузки.
          </p>
          <div v-else-if="preview" class="vt-desktop-reports__table-scroll">
            <table class="vt-desktop-reports__table">
              <thead>
                <tr>
                  <th v-for="column in preview.columns" :key="column.key" scope="col">
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in preview.rows" :key="index">
                  <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p class="vt-desktop-reports__hint">
          Файл формируется по данным на момент скачивания; время — в часовом поясе группы.
        </p>
      </div>
    </div>
  </div>
</template>
