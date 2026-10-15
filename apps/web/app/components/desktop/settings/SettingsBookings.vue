<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'

import SettingsRow from './SettingsRow.vue'

import VtSegment from '~/components/vt/Segment.vue'
import VtSelect from '~/components/vt/Select.vue'
import {
  MAX_SEATS_LIMITS,
  SETTING_IMPACT,
  cancellationHint,
  deadlineOptions,
  deadlineToValue,
  seatsHint,
  settingsPatch,
  sortLevels,
  validateBookings,
  valueToDeadline,
  type GroupSettings,
  type PlayerLevelCode,
  type SettingsErrors,
} from '~/utils/group-settings'
import type { SettingsController } from '~/utils/group-settings-controller'

const props = defineProps<{
  settings: GroupSettings
  levelOptions: { code: PlayerLevelCode; title: string; description: string }[]
  canEdit: boolean
  controller: SettingsController
}>()

const FIELDS = [
  'maxSeatsPerBooking',
  'cancellationDeadlineHours',
  'defaultPriceMode',
  'defaultJoinMode',
  'levels',
] as const

const uid = useId()
const draft = reactive({
  maxSeatsPerBooking: 3 as number | string,
  cancellationDeadlineHours: null as number | null,
  defaultPriceMode: 'fixed' as GroupSettings['defaultPriceMode'],
  defaultJoinMode: 'open' as GroupSettings['defaultJoinMode'],
  levels: [] as PlayerLevelCode[],
})
const errors = ref<SettingsErrors>({})
const formError = ref('')
const saving = ref(false)

function reset() {
  draft.maxSeatsPerBooking = props.settings.maxSeatsPerBooking
  draft.cancellationDeadlineHours = props.settings.cancellationDeadlineHours
  draft.defaultPriceMode = props.settings.defaultPriceMode
  draft.defaultJoinMode = props.settings.defaultJoinMode
  draft.levels = [...props.settings.levels]
  errors.value = {}
  formError.value = ''
}

function typed(): GroupSettings {
  return {
    ...props.settings,
    maxSeatsPerBooking: draft.maxSeatsPerBooking === '' ? NaN : Number(draft.maxSeatsPerBooking),
    cancellationDeadlineHours: draft.cancellationDeadlineHours,
    defaultPriceMode: draft.defaultPriceMode,
    defaultJoinMode: draft.defaultJoinMode,
    levels: sortLevels(draft.levels),
  }
}
const dirty = computed(() => Object.keys(settingsPatch(props.settings, typed(), FIELDS)).length > 0)
reset()
watch(
  () => props.settings,
  () => {
    if (!dirty.value) reset()
  },
)

const seats = computed(() => Number(draft.maxSeatsPerBooking))
const seatsValid = computed(() => !('maxSeatsPerBooking' in validateBookings(typed())))
const deadlineValue = computed({
  get: () => deadlineToValue(draft.cancellationDeadlineHours),
  set: (value: string) => (draft.cancellationDeadlineHours = valueToDeadline(value)),
})
const options = computed(() => deadlineOptions(props.settings.cancellationDeadlineHours))
const locked = computed(() => !props.canEdit || saving.value)

function step(delta: number) {
  const current = Number.isFinite(seats.value) ? seats.value : MAX_SEATS_LIMITS.min
  draft.maxSeatsPerBooking = Math.min(
    MAX_SEATS_LIMITS.max,
    Math.max(MAX_SEATS_LIMITS.min, current + delta),
  )
}

function toggleLevel(code: PlayerLevelCode) {
  if (locked.value) return
  draft.levels = draft.levels.includes(code)
    ? draft.levels.filter((c) => c !== code)
    : [...draft.levels, code]
}

async function submit() {
  if (!props.canEdit || saving.value) return
  const next = typed()
  errors.value = validateBookings(next)
  formError.value = ''
  if (Object.keys(errors.value).length > 0) {
    document.querySelector<HTMLElement>('[data-settings-field="maxSeatsPerBooking"]')?.focus()
    return
  }
  saving.value = true
  try {
    const result = await props.controller.saveSettings(settingsPatch(props.settings, next, FIELDS))
    if (!result.ok) formError.value = result.message ?? 'Не удалось сохранить настройки'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="vt-settings-stack">
    <section class="vt-card vt-settings-card">
      <div class="vt-settings-card__head">
        <h2 class="vt-settings-card__title">Абонементы</h2>
        <span class="vt-chip">опционально</span>
      </div>
      <SettingsRow
        label="Включить абонементы в группе"
        :hint="SETTING_IMPACT.subscriptionsEnabled"
        :model-value="settings.subscriptionsEnabled"
        :disabled="controller.isPending('subscriptionsEnabled')"
        :readonly="!canEdit"
        @update:model-value="controller.toggle('subscriptionsEnabled', $event)"
      />
    </section>

    <section class="vt-card vt-settings-card">
      <div class="vt-settings-card__head">
        <h2 class="vt-settings-card__title">Политика отмены записи</h2>
        <span class="vt-chip">для всей группы</span>
      </div>
      <p class="vt-settings-hint">На уровне отдельного события срок не настраивается.</p>
      <SettingsRow
        label="Разрешить игрокам отменять запись"
        :hint="SETTING_IMPACT.cancellationAllowed"
        :model-value="settings.cancellationAllowed"
        :disabled="controller.isPending('cancellationAllowed')"
        :readonly="!canEdit"
        @update:model-value="controller.toggle('cancellationAllowed', $event)"
      />
    </section>

    <form class="vt-card vt-settings-card" novalidate @submit.prevent="submit">
      <h2 class="vt-settings-card__title">Значения по умолчанию для новых событий</h2>

      <div class="vt-settings-field">
        <span :id="`${uid}-deadline`" class="vt-label"
          >Срок, до которого можно отменить запись</span
        >
        <VtSelect
          v-model="deadlineValue"
          :labelledby="`${uid}-deadline`"
          :options="options"
          :disabled="saving || !settings.cancellationAllowed"
          :readonly="!canEdit"
        />
        <p class="vt-settings-hint">
          {{ cancellationHint(settings.cancellationAllowed, draft.cancellationDeadlineHours) }}
          {{ SETTING_IMPACT.cancellationDeadlineHours }}
        </p>
        <p class="vt-settings-error" role="alert">{{ errors.cancellationDeadlineHours }}</p>
      </div>

      <div class="vt-settings-field">
        <label class="vt-label" :for="`${uid}-seats`">Мест на одного игрока</label>
        <div class="vt-settings-stepper">
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            aria-label="Меньше мест"
            :disabled="locked || seats <= MAX_SEATS_LIMITS.min"
            @click="step(-1)"
          >
            −
          </button>
          <input
            :id="`${uid}-seats`"
            v-model="draft.maxSeatsPerBooking"
            class="vt-field vt-mono vt-settings-stepper__input"
            type="number"
            inputmode="numeric"
            data-settings-field="maxSeatsPerBooking"
            :min="MAX_SEATS_LIMITS.min"
            :max="MAX_SEATS_LIMITS.max"
            :aria-describedby="`${uid}-seats-hint ${uid}-seats-err`"
            :aria-invalid="!seatsValid"
            :readonly="!canEdit"
            :disabled="saving"
          />
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            aria-label="Больше мест"
            :disabled="locked || seats >= MAX_SEATS_LIMITS.max"
            @click="step(1)"
          >
            +
          </button>
        </div>
        <p :id="`${uid}-seats-hint`" class="vt-settings-hint">
          {{ seatsValid ? seatsHint(seats) : '' }} {{ SETTING_IMPACT.maxSeatsPerBooking }}
        </p>
        <p :id="`${uid}-seats-err`" class="vt-settings-error" role="alert">
          {{ errors.maxSeatsPerBooking }}
        </p>
      </div>

      <div class="vt-settings-field">
        <span class="vt-label" aria-hidden="true">Оплата по умолчанию</span>
        <VtSegment
          v-model="draft.defaultPriceMode"
          :readonly="!canEdit"
          label="Оплата по умолчанию"
          :options="[
            { value: 'fixed', label: 'Фиксированная цена', disabled: saving },
            { value: 'split', label: 'Делим общую сумму', disabled: saving },
          ]"
        />
        <p class="vt-settings-hint">
          {{
            draft.defaultPriceMode === 'fixed'
              ? 'Каждый платит одну и ту же сумму за место.'
              : 'Известна стоимость аренды: сумма делится на всех после закрытия записи.'
          }}
          {{ SETTING_IMPACT.defaultPriceMode }}
        </p>
        <p v-if="draft.defaultPriceMode === 'split'" class="vt-settings-note" role="note">
          Итоговая сумма станет известна после закрытия записи. До этого игрок видит прогноз, он
          меняется по мере записи.
        </p>
      </div>

      <div class="vt-settings-field">
        <span class="vt-label" aria-hidden="true">Режим записи по умолчанию</span>
        <VtSegment
          v-model="draft.defaultJoinMode"
          :readonly="!canEdit"
          label="Режим записи по умолчанию"
          :options="[
            { value: 'open', label: 'Свободная запись', disabled: saving },
            { value: 'invite', label: 'По приглашению', disabled: saving },
          ]"
        />
        <p class="vt-settings-hint">{{ SETTING_IMPACT.defaultJoinMode }}</p>
      </div>

      <div class="vt-settings-field">
        <span :id="`${uid}-levels`" class="vt-label">Уровни группы</span>
        <div
          class="vt-seg vt-seg--chips"
          role="group"
          :aria-labelledby="`${uid}-levels`"
          :aria-describedby="`${uid}-levels-hint`"
        >
          <button
            v-for="level in levelOptions"
            :key="level.code"
            type="button"
            class="vt-seg__item"
            role="checkbox"
            :aria-checked="draft.levels.includes(level.code)"
            :title="level.description"
            :disabled="saving"
            :aria-disabled="!canEdit || undefined"
            @click="toggleLevel(level.code)"
          >
            {{ level.title }}
          </button>
        </div>
        <p :id="`${uid}-levels-hint`" class="vt-settings-hint">{{ SETTING_IMPACT.levels }}</p>
      </div>

      <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
        {{ formError }}
      </p>
      <div v-if="canEdit" class="vt-settings-actions">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="!dirty || saving"
          @click="reset"
        >
          Отмена
        </button>
        <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="!dirty || saving">
          {{ saving ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </div>
    </form>
  </div>
</template>
