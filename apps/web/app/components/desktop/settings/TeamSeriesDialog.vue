<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import { apiErrorMessage } from '~/utils/api-error'
import {
  eligibleCoachIds,
  planSeriesAssignment,
  seriesOptions,
  upcomingSeriesEvents,
  type SeriesEventRow,
  type SeriesOption,
  type TeamMember,
} from '~/utils/team-settings'

/**
 * «Назначить на серию» (W-17, 30.1.2): серии группы берутся из предстоящих событий, тренер
 * добавляется в шаблон серии и в её будущие даты (`PATCH …/series/{id}?scope=following`).
 * Списки тренеров не затираются: новый добавляется к списку шаблона и к собственному списку каждой
 * будущей даты (тренеры отдельных дат сохраняются), чужие тренеры не отбрасываются.
 */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{
  orgId: number
  member: { userId: number; name: string } | null
  /** Участники группы (все статусы): по ним определяется, кто ещё допустим как тренер. */
  members: TeamMember[]
  timeZone: string
}>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger']; assigned: [] }>()

const options = ref<SeriesOption[]>([])
const loading = ref(false)
const loadError = ref('')
const chosen = ref<number | null>(null)
const busy = ref(false)
const formError = ref('')

const base = computed(() => `/api/organizations/${props.orgId}`)

async function load() {
  loading.value = true
  loadError.value = ''
  options.value = []
  chosen.value = null
  formError.value = ''
  try {
    const data = await $fetch<{ events: SeriesEventRow[] }>(`${base.value}/events?limit=100`)
    options.value = seriesOptions(data.events, props.timeZone)
    chosen.value = options.value[0]?.seriesId ?? null
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить серии')
  } finally {
    loading.value = false
  }
}
watch(open, (isOpen) => {
  if (isOpen) void load()
})

/** Все предстоящие события серии с их собственными списками тренеров (постранично, по 100). */
async function futureEvents(option: SeriesOption): Promise<SeriesEventRow[]> {
  const found: SeriesEventRow[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await $fetch<{ events: SeriesEventRow[] }>(
      `${base.value}/events?limit=100&offset=${offset}`,
    )
    found.push(...upcomingSeriesEvents(page.events, option.seriesId, option.from, new Date()))
    if (page.events.length < 100) return found
  }
}

/** Дата позже любой даты серии: `following` с ней меняет только шаблон, не затрагивая события. */
const TEMPLATE_ONLY_FROM = '9999-12-31'

function patchSeries(
  option: SeriesOption,
  scope: 'single' | 'following',
  from: string,
  ids: number[],
) {
  return $fetch(`${base.value}/series/${option.seriesId}?scope=${scope}&from=${from}`, {
    method: 'PATCH',
    body: { coachUserIds: ids },
  })
}

async function submit() {
  const member = props.member
  const option = options.value.find((o) => o.seriesId === chosen.value)
  if (!member || !option || busy.value) return
  busy.value = true
  formError.value = ''
  let changed = false
  try {
    const { series } = await $fetch<{ series: { template: { coachUserIds?: number[] } } }>(
      `${base.value}/series/${option.seriesId}`,
    )
    const template = series.template.coachUserIds ?? []
    const plan = planSeriesAssignment(
      template,
      await futureEvents(option),
      member.userId,
      eligibleCoachIds(props.members),
    )
    if (plan.template === null && plan.dates.length === 0) {
      emit('toast', `${member.name} уже ведёт серию «${option.title}»`, 'ok')
      open.value = false
      return
    }
    // Шаблон и каждая будущая дата получают добавку к СВОЕМУ списку: `following` с общим списком затёр
    // бы тренеров отдельных дат, поэтому шаблон правится «пустым» following, а даты — по одной.
    if (plan.template) {
      await patchSeries(option, 'following', TEMPLATE_ONLY_FROM, plan.template)
      changed = true
    }
    for (const d of plan.dates) {
      await patchSeries(option, 'single', d.date, d.coachUserIds)
      changed = true
    }
    emit('toast', `${member.name} назначен на серию «${option.title}»`, 'ok')
    open.value = false
  } catch (cause) {
    formError.value = `${apiErrorMessage(cause, 'Не удалось назначить на серию')}${
      changed ? '. Часть дат уже обновлена: повторите назначение, оно докончит остальные' : ''
    }`
  } finally {
    busy.value = false
    if (changed) emit('assigned')
  }
}
</script>

<template>
  <VtDialog
    v-model="open"
    :title="`Назначить на серию: ${member?.name ?? ''}`"
    sub="Тренер появится в будущих датах серии и в шаблоне, прошедшие события не меняются."
    :busy="busy"
  >
    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем серии…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <p v-else-if="options.length === 0" class="vt-settings-hint">
      Предстоящих серий нет. Серия создаётся в разделе «События».
    </p>
    <fieldset v-else class="vt-team-series">
      <legend class="sr-only">Серия</legend>
      <label v-for="o in options" :key="o.seriesId" class="vt-team-series__option">
        <input v-model="chosen" type="radio" name="team-series" :value="o.seriesId" />
        <span>{{ o.label }}</span>
      </label>
    </fieldset>
    <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
      {{ formError }}
    </p>
    <template #footer>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        :disabled="busy"
        @click="open = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="vt-btn vt-btn--ink vt-btn--sm"
        :disabled="busy || chosen === null"
        @click="submit"
      >
        {{ busy ? 'Назначаем…' : 'Назначить' }}
      </button>
    </template>
  </VtDialog>
</template>
