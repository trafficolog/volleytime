<script setup lang="ts">
import { periodError } from '~/utils/event-list-query'

/**
 * Панель «Фильтры» списка событий (21.2.10, W-03): период и зал. Период применяется только когда обе
 * даты верны; ошибка показывается рядом, страница не перезапрашивается с неверным периодом.
 */
const props = defineProps<{
  venues: { id: number; name: string }[]
  venueId: number | null
  from: string
  to: string
  /** В календаре период задаёт месяц сетки: поля периода скрыты. */
  hidePeriod?: boolean
}>()
const emit = defineEmits<{
  change: [patch: { venueId?: number | null; from?: string; to?: string }]
  reset: []
}>()

const draftFrom = ref(props.from)
const draftTo = ref(props.to)
const error = ref('')
watch(
  () => [props.from, props.to],
  ([from, to]) => {
    draftFrom.value = from!
    draftTo.value = to!
    error.value = ''
  },
)

function applyPeriod() {
  const problem = periodError(draftFrom.value, draftTo.value)
  error.value = problem ?? ''
  if (problem) return
  emit('change', { from: draftFrom.value, to: draftTo.value })
}
const venueModel = computed({
  get: () => (props.venueId === null ? '' : String(props.venueId)),
  set: (value: string) => emit('change', { venueId: Number(value) > 0 ? Number(value) : null }),
})
</script>

<template>
  <section class="vt-card vt-desktop-event-filters" aria-label="Фильтры событий">
    <label v-if="!hidePeriod" class="vt-desktop-payment-filter"
      >С<input
        v-model="draftFrom"
        type="date"
        class="vt-field"
        data-testid="filter-from"
        @change="applyPeriod"
    /></label>
    <label v-if="!hidePeriod" class="vt-desktop-payment-filter"
      >По<input
        v-model="draftTo"
        type="date"
        class="vt-field"
        data-testid="filter-to"
        @change="applyPeriod"
    /></label>
    <label class="vt-desktop-payment-filter"
      >Зал<select v-model="venueModel" class="vt-field" data-testid="filter-venue">
        <option value="">Все залы</option>
        <option v-for="v in venues" :key="v.id" :value="String(v.id)">
          {{ v.name }}
        </option>
      </select></label
    >
    <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="emit('reset')">
      Сбросить
    </button>
    <p v-if="error" class="text-sm text-vt-rose" role="alert">{{ error }}</p>
  </section>
</template>
