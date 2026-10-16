<script setup lang="ts">
import type { SeriesFreq } from '@volley-time/shared'
import { computed, useId } from 'vue'

import VtIcon from '~/components/vt/Icon.vue'
import VtSegment from '~/components/vt/Segment.vue'
import {
  SERIES_SPANS,
  WEEKDAYS,
  describeSeriesRule,
  eventsWord,
  seriesChipLabel,
  toggleWeekday,
  type SeriesEndMode,
  type SeriesPreviewView,
} from '~/utils/event-series'

/**
 * Блок повтора формы события (W-04, P-06): правило, предпросмотр дат, исключения.
 * Баланс и последствия публикации показывает форма отдельной панелью.
 */
const props = defineProps<{
  preview: SeriesPreviewView | null
  loading: boolean
  /** Сообщение, если предпросмотр не удалось получить. */
  error: string
  countError: string
}>()
defineEmits<{ retry: [] }>()

const freq = defineModel<string>('freq', { required: true })
const weekdays = defineModel<number[]>('weekdays', { required: true })
const endMode = defineModel<SeriesEndMode>('endMode', { required: true })
const span = defineModel<string>('span', { required: true })
const count = defineModel<string>('count', { required: true })
const exceptions = defineModel<string[]>('exceptions', { required: true })

const uid = useId()
const MAX_CHIPS = 12

const freqOptions = [
  { value: 'once', label: 'Один раз' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'biweekly', label: 'Раз в 2 недели' },
]
const endOptions = [
  ...SERIES_SPANS.map((s) => ({ value: s.value, label: s.label })),
  { value: 'count', label: 'N раз' },
]
const endValue = computed({
  get: () => (endMode.value === 'count' ? 'count' : span.value),
  set: (v: string) => {
    if (v === 'count') endMode.value = 'count'
    else {
      endMode.value = 'span'
      span.value = v
    }
  },
})
const isSeries = computed(() => freq.value !== 'once')
const visibleDates = computed(() => props.preview?.dates.slice(0, MAX_CHIPS) ?? [])
const hiddenCount = computed(() => Math.max(0, (props.preview?.dates.length ?? 0) - MAX_CHIPS))
const range = computed(() => {
  const dates = props.preview?.dates
  if (!dates?.length) return ''
  const first = dates[0]!.date
  const last = dates.at(-1)!.date
  return first === last
    ? seriesChipLabel(first)
    : `${seriesChipLabel(first)} — ${seriesChipLabel(last)}`
})
const conflictDates = computed(
  () => props.preview?.dates.filter((d) => d.draftReason === 'venue_conflict') ?? [],
)

function toggleDay(day: number) {
  weekdays.value = toggleWeekday(weekdays.value, day)
}
function excludeDate(date: string) {
  if (!exceptions.value.includes(date)) exceptions.value = [...exceptions.value, date].sort()
}
function restoreDate(date: string) {
  exceptions.value = exceptions.value.filter((d) => d !== date)
}
</script>

<template>
  <div class="space-y-4" data-testid="series-block">
    <div>
      <span class="vt-label">Повторять</span>
      <VtSegment v-model="freq" :options="freqOptions" label="Повторять" />
    </div>

    <template v-if="isSeries">
      <div>
        <span :id="`${uid}-days`" class="vt-label">По дням</span>
        <div class="grid grid-cols-7 gap-1.5" role="group" :aria-labelledby="`${uid}-days`">
          <button
            v-for="d in WEEKDAYS"
            :key="d.value"
            type="button"
            class="vt-weekday min-h-11"
            :aria-pressed="weekdays.includes(d.value)"
            :aria-label="d.name"
            @click="toggleDay(d.value)"
          >
            {{ d.short }}
          </button>
        </div>
      </div>

      <div>
        <span class="vt-label">Как долго</span>
        <VtSegment v-model="endValue" :options="endOptions" label="Как долго" />
        <div v-if="endMode === 'count'" class="mt-3">
          <label class="vt-label" for="ev-series-count">Сколько раз</label>
          <input
            id="ev-series-count"
            v-model="count"
            inputmode="numeric"
            class="vt-field vt-mono max-w-32"
            :aria-invalid="countError ? 'true' : undefined"
            :aria-describedby="countError ? 'ev-series-count-error' : 'ev-series-count-hint'"
          />
          <p
            v-if="countError"
            id="ev-series-count-error"
            class="mt-1 text-xs text-vt-rose-ink"
            role="alert"
          >
            {{ countError }}
          </p>
          <p id="ev-series-count-hint" class="mt-1 text-xs text-vt-mute-2">
            Повторения считаются до исключений: исключённая дата уменьшает число событий.
          </p>
        </div>
      </div>

      <div class="vt-card vt-card--cool space-y-3 p-4" aria-live="polite" :aria-busy="loading">
        <template v-if="preview">
          <div class="flex items-baseline justify-between gap-3">
            <p class="flex items-baseline gap-2">
              <span class="vt-mono text-5xl font-bold leading-none" data-testid="series-total">{{
                preview.total
              }}</span>
              <span class="text-sm font-semibold">{{ eventsWord(preview.total) }}</span>
            </p>
            <span class="text-right text-xs text-vt-mute-2">{{ range }}</span>
          </div>
          <p class="text-sm text-vt-ink-3">
            {{ describeSeriesRule(freq as SeriesFreq, weekdays) }}
          </p>
          <ul class="flex flex-wrap gap-1.5" aria-label="Даты серии">
            <li v-for="d in visibleDates" :key="d.date">
              <button
                type="button"
                class="vt-chip"
                :class="d.status === 'draft' ? 'vt-chip--amber' : ''"
                :aria-label="`${seriesChipLabel(d.date)}${d.status === 'draft' ? ', черновик' : ''}. Исключить дату`"
                :title="d.status === 'draft' ? 'Будет создана черновиком' : 'Исключить дату'"
                @click="excludeDate(d.date)"
              >
                {{ seriesChipLabel(d.date) }}
              </button>
            </li>
            <li v-if="hiddenCount > 0">
              <span class="vt-chip vt-chip--state">+{{ hiddenCount }}</span>
            </li>
          </ul>
          <p v-for="d in conflictDates" :key="d.date" class="flex gap-2 text-xs text-vt-ink-3">
            <VtIcon name="bell" :size="14" />
            <span>
              {{ seriesChipLabel(d.date) }} — в зале уже есть бронь на это время. Дата будет создана
              черновиком, её можно перенести.
            </span>
          </p>
        </template>
        <p v-else-if="loading" class="text-sm text-vt-mute-2" role="status">Считаем даты…</p>
        <div v-else-if="error" class="space-y-2">
          <p class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="$emit('retry')">
            Повторить предпросмотр
          </button>
        </div>
        <p v-else class="text-sm text-vt-mute-2">
          Укажите дату начала и число мест — покажем даты серии.
        </p>

        <div v-if="exceptions.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs text-vt-mute-2">Исключены:</span>
          <button
            v-for="date in exceptions"
            :key="date"
            type="button"
            class="vt-chip"
            :aria-label="`Вернуть дату ${seriesChipLabel(date)}`"
            @click="restoreDate(date)"
          >
            {{ seriesChipLabel(date) }} <VtIcon name="close" :size="12" />
          </button>
        </div>
      </div>
      <p class="text-xs text-vt-mute-2">
        Серию можно отредактировать целиком или любую дату отдельно. Отмена будущих дат возвращает
        баланс событий.
      </p>
    </template>
  </div>
</template>
