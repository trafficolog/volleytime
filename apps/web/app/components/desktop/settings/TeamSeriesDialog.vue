<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import { apiErrorMessage } from '~/utils/api-error'
import { seriesOptions, type SeriesEventRow, type SeriesOption } from '~/utils/team-settings'

/**
 * «Назначить на серию» (W-17, 30.1.2): серии группы берутся из предстоящих событий, тренер
 * добавляется в шаблон серии и в её будущие даты (`PATCH …/series/{id}?scope=following`).
 * Список тренеров серии не затирается: прежние добавляются к новому, кроме тех, кто уже не в команде.
 */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{
  orgId: number
  member: { userId: number; name: string } | null
  timeZone: string
  /** Пользователи, которые сейчас в команде (владелец, организаторы, тренеры). */
  teamUserIds: number[]
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

async function submit() {
  const member = props.member
  const option = options.value.find((o) => o.seriesId === chosen.value)
  if (!member || !option || busy.value) return
  busy.value = true
  formError.value = ''
  try {
    const { series } = await $fetch<{ series: { template: { coachUserIds?: number[] } } }>(
      `${base.value}/series/${option.seriesId}`,
    )
    const current = (series.template.coachUserIds ?? []).filter((id) =>
      props.teamUserIds.includes(id),
    )
    if (current.includes(member.userId)) {
      emit('toast', `${member.name} уже ведёт серию «${option.title}»`, 'ok')
      open.value = false
      return
    }
    await $fetch(`${base.value}/series/${option.seriesId}?scope=following&from=${option.from}`, {
      method: 'PATCH',
      body: { coachUserIds: [...current, member.userId] },
    })
    emit('toast', `${member.name} назначен на серию «${option.title}»`, 'ok')
    emit('assigned')
    open.value = false
  } catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не удалось назначить на серию')
  } finally {
    busy.value = false
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
