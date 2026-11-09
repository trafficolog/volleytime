<script setup lang="ts">
import { onMounted, ref } from 'vue'

import SettingsRow from './SettingsRow.vue'

import { apiErrorMessage } from '~/utils/api-error'

/**
 * Уведомления бота (W-11, 21.2.14). Напоминания переключаются и сохраняются сразу; обязательные
 * (место из листа ожидания, оплата) показаны включёнными и недоступными: без них ломается процесс.
 * «Итог тренировки» и «Еженедельный отчёт» ещё не существуют (v0.3.1): строки видны, но выключены
 * и недоступны, API-поля для них нет. Доступно владельцу и организатору.
 */
type Switchable = 'reminder_24h' | 'reminder_2h'
interface ApiRow {
  type: string
  enabled: boolean
  mandatory: boolean
}

const props = defineProps<{ orgId: number }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const SWITCHES: { type: Switchable; label: string; hint: string }[] = [
  {
    type: 'reminder_24h',
    label: 'Напоминание за 24 часа',
    hint: 'Игрокам основного состава за сутки до начала. Выключите, если напоминаете сами.',
  },
  {
    type: 'reminder_2h',
    label: 'Напоминание за 2 часа',
    hint: 'Игрокам основного состава за два часа до начала, с кнопкой отмены записи.',
  },
]
const MANDATORY = [
  {
    label: 'Освободилось место',
    hint: 'Первому из листа ожидания, предложение действует 30 минут. Без него место сгорит впустую.',
  },
  {
    label: 'Подтверждение оплаты',
    hint: 'Игроку, когда организатор подтвердил или отклонил оплату. Без него игрок не узнает о решении.',
  },
]
const SOON = [
  { label: 'Итог тренировки', hint: 'Сводка организатору после события.' },
  { label: 'Еженедельный отчёт', hint: 'Организатору по понедельникам.' },
]

const base = `/api/organizations/${props.orgId}/notification-settings`
const state = ref<Record<Switchable, boolean>>({ reminder_24h: true, reminder_2h: true })
const loading = ref(true)
const loadError = ref('')
const busy = ref<Record<Switchable, boolean>>({ reminder_24h: false, reminder_2h: false })
const alwaysOn = ref(true)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ notifications: ApiRow[] }>(base)
    for (const row of data.notifications) {
      if (!row.mandatory) state.value[row.type as Switchable] = row.enabled
    }
    alwaysOn.value = data.notifications.filter((r) => r.mandatory).every((r) => r.enabled)
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить настройки уведомлений')
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** Сохраняется сразу; при ошибке переключатель возвращается к прежнему значению. */
async function toggle(type: Switchable, value: boolean) {
  if (busy.value[type]) return
  const previous = state.value[type]
  state.value[type] = value
  busy.value[type] = true
  try {
    const data = await $fetch<{ notifications: ApiRow[] }>(base, {
      method: 'PATCH',
      body: { [type]: value },
    })
    const saved = data.notifications.find((r) => r.type === type)
    if (saved) state.value[type] = saved.enabled
    emit('toast', value ? 'Уведомление включено' : 'Уведомление выключено', 'ok')
  } catch (cause) {
    state.value[type] = previous
    emit('toast', apiErrorMessage(cause, 'Не удалось сохранить настройку'), 'danger')
  } finally {
    busy.value[type] = false
  }
}
</script>

<template>
  <div class="vt-settings-stack">
    <section class="vt-card vt-settings-card">
      <div class="vt-settings-card__head">
        <div>
          <h2 class="vt-settings-card__title">Уведомления</h2>
          <p class="vt-settings-hint">Что и когда бот присылает игрокам и организаторам.</p>
        </div>
      </div>

      <p v-if="loading" role="status" class="vt-settings-hint">Загружаем настройки…</p>
      <div v-else-if="loadError" class="vt-settings-load-error">
        <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">
          Повторить
        </button>
      </div>
      <div v-else class="vt-settings-stack">
        <SettingsRow
          v-for="item in SWITCHES"
          :key="item.type"
          :model-value="state[item.type]"
          :label="item.label"
          :hint="item.hint"
          :disabled="busy[item.type]"
          @update:model-value="toggle(item.type, $event)"
        />
        <SettingsRow
          v-for="item in MANDATORY"
          :key="item.label"
          :model-value="alwaysOn"
          :label="item.label"
          :hint="item.hint"
          badge="обязательное"
          disabled
        />
        <SettingsRow
          v-for="item in SOON"
          :key="item.label"
          :model-value="false"
          :label="item.label"
          :hint="item.hint"
          badge="скоро"
          disabled
        />
      </div>
    </section>
    <p class="vt-settings-hint">
      Выключенное напоминание не уходит игрокам этой группы; лента уведомлений в приложении не
      меняется. Обязательные уведомления выключить нельзя.
    </p>
  </div>
</template>
