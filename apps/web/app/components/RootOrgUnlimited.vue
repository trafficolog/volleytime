<script setup lang="ts">
import {
  addIsoDays,
  isValidIsoDate,
  minskToday,
  UNLIMITED_MAX_DAYS_AHEAD,
  UNLIMITED_REASON_MAX,
  UNLIMITED_REASON_MIN,
} from '@volley-time/shared'

import { apiErrorCode, apiErrorMessage } from '~/utils/api-error'
import { formatIsoDateRu } from '~/utils/event-balance-billing'

/**
 * Блок «Безлимит событий» в карточке организации Root Admin (22.3.1, ADR-22-3-1): включить до даты
 * (последний день по Минску включительно), изменить дату, отключить. Причина обязательна и пишется в
 * журнал вместе с действием. Баланс и журнал баланса не меняются.
 */
const props = defineProps<{
  orgId: number
  /** Активный безлимит группы: последний день по Минску; `null` — безлимита нет. */
  unlimited: { until: string } | null
  /** Группа удалена: безлимит не меняется на время окна восстановления. */
  disabled?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

type Mode = 'set' | 'cancel' | null
const mode = ref<Mode>(null)
const until = ref('')
const reason = ref('')
const busy = ref(false)
const failure = ref('')
const errors = ref<{ until?: string; reason?: string }>({})

const today = computed(() => minskToday())
const max = computed(() => addIsoDays(today.value, UNLIMITED_MAX_DAYS_AHEAD))
const toast = useToast()

function open(next: Exclude<Mode, null>) {
  mode.value = next
  failure.value = ''
  errors.value = {}
  reason.value = ''
  until.value = props.unlimited?.until ?? addIsoDays(today.value, 30)
}

function close() {
  mode.value = null
  failure.value = ''
  errors.value = {}
}

function validate(): boolean {
  const next: { until?: string; reason?: string } = {}
  if (mode.value === 'set') {
    if (!isValidIsoDate(until.value) || until.value < today.value || until.value > max.value) {
      next.until = `Дата — от сегодняшней до ${formatIsoDateRu(max.value)} (по Минску)`
    }
  }
  const text = reason.value.trim()
  if (text.length < UNLIMITED_REASON_MIN || text.length > UNLIMITED_REASON_MAX) {
    next.reason = `Причина: от ${UNLIMITED_REASON_MIN} до ${UNLIMITED_REASON_MAX} символов`
  }
  errors.value = next
  return Object.keys(next).length === 0
}

async function submit() {
  if (busy.value || !mode.value || !validate()) return
  busy.value = true
  failure.value = ''
  const url = `/api/platform/organizations/${props.orgId}/event-balance/unlimited`
  try {
    if (mode.value === 'set') {
      await $fetch(url, {
        method: 'PUT',
        body: { until: until.value, reason: reason.value.trim() },
      })
      toast.show(`Безлимит до ${formatIsoDateRu(until.value)}`)
    } else {
      await $fetch(`${url}/cancel`, { method: 'POST', body: { reason: reason.value.trim() } })
      toast.show('Безлимит отключён')
    }
    close()
    emit('changed')
  } catch (e) {
    failure.value =
      apiErrorCode(e) === 'organization.deleted'
        ? 'Организация удалена: безлимит нельзя менять до восстановления'
        : apiErrorMessage(e, 'Не удалось изменить безлимит')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-card vt-root-org__panel vt-root-unlimited" aria-labelledby="org-unlimited">
    <h2 id="org-unlimited">Безлимит событий</h2>
    <p v-if="unlimited" class="vt-root-unlimited__state" data-testid="unlimited-state">
      Активен до <b class="vt-mono">{{ formatIsoDateRu(unlimited.until) }}</b> включительно (по
      Минску). Публикации не списывают баланс.
    </p>
    <p v-else class="vt-root-org__empty" data-testid="unlimited-state">
      Не включён: публикация списывает по одному событию.
    </p>

    <div v-if="!mode" class="vt-root-orgs__actions">
      <button
        type="button"
        class="vt-btn vt-btn--ink vt-btn--sm"
        :disabled="disabled"
        @click="open('set')"
      >
        {{ unlimited ? 'Продлить / изменить дату' : 'Включить до…' }}
      </button>
      <button
        v-if="unlimited"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        :disabled="disabled"
        @click="open('cancel')"
      >
        Отключить
      </button>
    </div>

    <form v-else class="vt-root-unlimited__form" novalidate @submit.prevent="submit">
      <p v-if="failure" class="vt-root-billing__error" role="alert">{{ failure }}</p>
      <label v-if="mode === 'set'" class="vt-root-billing__field">
        <span class="vt-label">Последний день безлимита (по Минску)</span>
        <input
          v-model="until"
          class="vt-field vt-mono"
          name="until"
          type="date"
          :min="today"
          :max="max"
          :aria-invalid="errors.until ? 'true' : undefined"
        />
        <span v-if="errors.until" class="vt-root-billing__error">{{ errors.until }}</span>
      </label>
      <label class="vt-root-billing__field">
        <span class="vt-label">Причина (попадёт в журнал)</span>
        <textarea
          v-model="reason"
          class="vt-field"
          name="reason"
          rows="2"
          :maxlength="UNLIMITED_REASON_MAX"
          :aria-invalid="errors.reason ? 'true' : undefined"
        />
        <span v-if="errors.reason" class="vt-root-billing__error">{{ errors.reason }}</span>
      </label>
      <div class="vt-root-orgs__actions">
        <button type="submit" class="vt-btn vt-btn--primary vt-btn--sm" :disabled="busy">
          {{ busy ? 'Сохраняем…' : mode === 'set' ? 'Включить' : 'Отключить безлимит' }}
        </button>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="busy"
          @click="close"
        >
          Отмена
        </button>
      </div>
    </form>
  </section>
</template>
