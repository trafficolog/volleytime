<script setup lang="ts">
import { resolveReportPeriod, type ReportPeriodPreset } from '@volley-time/shared'
import { computed, ref, watch } from 'vue'

import type { ReportDates } from '~/utils/desktop-reports'

/**
 * Период отчётов (W-10, 21.2.7): быстрые периоды группы и произвольные даты. Даты — локальные
 * даты группы, обе включительно; неверный диапазон не применяется и подсвечивается.
 */
const props = defineProps<{ presets: ReportPeriodPreset[]; dates: ReportDates }>()
const emit = defineEmits<{ select: [dates: ReportDates] }>()

const from = ref(props.dates.from)
const to = ref(props.dates.to)
watch(
  () => props.dates,
  (next) => {
    from.value = next.from
    to.value = next.to
  },
)

const valid = computed(() => resolveReportPeriod(from.value, to.value, 'UTC') !== null)
const current = computed(
  () =>
    props.presets.find((p) => p.from === props.dates.from && p.to === props.dates.to)?.key ?? null,
)

function applyCustom() {
  if (valid.value) emit('select', { from: from.value, to: to.value })
}
</script>

<template>
  <div class="vt-desktop-reports__period" role="group" aria-label="Период отчёта">
    <div class="vt-desktop-reports__range">
      <label>
        <VtIcon name="calendar" :size="14" /> С
        <input
          v-model="from"
          type="date"
          class="vt-field"
          :aria-invalid="!valid"
          @change="applyCustom"
        />
      </label>
      <label>
        По
        <input
          v-model="to"
          type="date"
          class="vt-field"
          :aria-invalid="!valid"
          @change="applyCustom"
        />
      </label>
    </div>
    <button
      v-for="preset in presets"
      :key="preset.key"
      type="button"
      class="vt-btn vt-btn--sm vt-desktop-reports__preset"
      :class="{ 'is-active': current === preset.key }"
      :aria-pressed="current === preset.key"
      @click="emit('select', { from: preset.from, to: preset.to })"
    >
      {{ preset.label }}
    </button>
    <p v-if="!valid" class="vt-desktop-reports__error" role="alert">
      Начало периода не позже конца, не длиннее года.
    </p>
  </div>
</template>
