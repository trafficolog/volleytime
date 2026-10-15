<script setup lang="ts">
import { onMounted, ref } from 'vue'

import SettingsField from './SettingsField.vue'

import { apiErrorMessage } from '~/utils/api-error'

/** Залы группы: список и добавление (GET/POST /venues; доступно владельцу и организатору). */
interface VenueRow {
  id: number
  name: string
  address: string | null
}

const props = defineProps<{ orgId: number; canManage: boolean }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const venues = ref<VenueRow[]>([])
const loading = ref(true)
const loadError = ref('')
const adding = ref(false)
const name = ref('')
const address = ref('')
const nameError = ref('')
const formError = ref('')
const saving = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ venues: VenueRow[] }>(`/api/organizations/${props.orgId}/venues`)
    venues.value = data.venues
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить залы')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function cancelAdd() {
  adding.value = false
  name.value = ''
  address.value = ''
  nameError.value = ''
  formError.value = ''
}

async function submit() {
  if (saving.value) return
  nameError.value = name.value.trim() ? '' : 'Укажите название зала'
  formError.value = ''
  if (nameError.value) return
  saving.value = true
  try {
    const body: { name: string; address?: string } = { name: name.value.trim() }
    if (address.value.trim()) body.address = address.value.trim()
    const data = await $fetch<{ venue: VenueRow }>(`/api/organizations/${props.orgId}/venues`, {
      method: 'POST',
      body,
    })
    venues.value = [...venues.value, data.venue]
    emit('toast', 'Зал добавлен', 'ok')
    cancelAdd()
  } catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не удалось добавить зал')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card">
    <div class="vt-settings-card__head">
      <h2 class="vt-settings-card__title">Залы и площадки</h2>
      <button
        v-if="canManage && !adding"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        @click="adding = true"
      >
        Добавить зал
      </button>
    </div>
    <p class="vt-settings-hint">
      Залы выбираются при создании события и показываются игрокам в карточке события.
    </p>

    <form v-if="adding" class="vt-settings-venue-form" novalidate @submit.prevent="submit">
      <SettingsField
        v-slot="{ id, describedby, invalid }"
        label="Название зала"
        hint="Например, «Школа №24, малый зал»."
        :error="nameError"
      >
        <input
          :id="id"
          v-model="name"
          class="vt-field"
          maxlength="200"
          :aria-describedby="describedby"
          :aria-invalid="invalid"
          :disabled="saving"
        />
      </SettingsField>
      <SettingsField
        v-slot="{ id, describedby }"
        label="Адрес"
        hint="Показывается игрокам рядом с названием зала."
      >
        <input
          :id="id"
          v-model="address"
          class="vt-field"
          maxlength="500"
          :aria-describedby="describedby"
          :disabled="saving"
        />
      </SettingsField>
      <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
        {{ formError }}
      </p>
      <div class="vt-settings-actions">
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="cancelAdd">
          Отмена
        </button>
        <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="saving">
          {{ saving ? 'Добавляем…' : 'Добавить' }}
        </button>
      </div>
    </form>

    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем залы…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <p v-else-if="venues.length === 0" class="vt-settings-hint">
      Залов пока нет. Добавьте первый, чтобы выбирать его в событиях.
    </p>
    <ul v-else class="vt-settings-list">
      <li v-for="venue in venues" :key="venue.id" class="vt-settings-list__item">
        <span class="vt-settings-row__title">{{ venue.name }}</span>
        <span v-if="venue.address" class="vt-settings-hint">{{ venue.address }}</span>
      </li>
    </ul>
  </section>
</template>
