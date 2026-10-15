<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import SettingsField from './SettingsField.vue'
import SettingsRow from './SettingsRow.vue'

import {
  SETTING_IMPACT,
  textOrNull,
  validateProfile,
  type GroupSettings,
  type SettingsErrors,
} from '~/utils/group-settings'
import type { OrgProfile, SettingsController } from '~/utils/group-settings-controller'

const props = defineProps<{
  org: OrgProfile
  settings: GroupSettings
  canEdit: boolean
  controller: SettingsController
}>()

const draft = reactive({ name: '', description: '', city: '', district: '' })
const errors = ref<SettingsErrors>({})
const formError = ref('')
const saving = ref(false)

function reset() {
  draft.name = props.org.name
  draft.description = props.org.description ?? ''
  draft.city = props.settings.city ?? ''
  draft.district = props.settings.district ?? ''
  errors.value = {}
  formError.value = ''
}
const dirty = computed(
  () =>
    draft.name.trim() !== props.org.name ||
    textOrNull(draft.description) !== props.org.description ||
    textOrNull(draft.city) !== props.settings.city ||
    textOrNull(draft.district) !== props.settings.district,
)
reset()
watch(
  () => [props.org, props.settings.city, props.settings.district],
  () => {
    if (!dirty.value) reset()
  },
)

async function submit() {
  if (!props.canEdit || saving.value) return
  errors.value = validateProfile(draft)
  formError.value = ''
  const first = Object.keys(errors.value)[0]
  if (first) {
    document.querySelector<HTMLElement>(`[data-settings-field="${first}"]`)?.focus()
    return
  }
  saving.value = true
  try {
    const orgPatch: Partial<Pick<OrgProfile, 'name' | 'description'>> = {}
    if (draft.name.trim() !== props.org.name) orgPatch.name = draft.name.trim()
    if (textOrNull(draft.description) !== props.org.description)
      orgPatch.description = textOrNull(draft.description)
    const settingsPatch: Partial<Pick<GroupSettings, 'city' | 'district'>> = {}
    if (textOrNull(draft.city) !== props.settings.city) settingsPatch.city = textOrNull(draft.city)
    if (textOrNull(draft.district) !== props.settings.district)
      settingsPatch.district = textOrNull(draft.district)
    const result = await props.controller.saveProfile(orgPatch, settingsPatch)
    if (!result.ok) formError.value = result.message ?? 'Не удалось сохранить профиль'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="vt-settings-stack">
    <form class="vt-card vt-settings-card" novalidate @submit.prevent="submit">
      <h2 class="vt-settings-card__title">Профиль группы</h2>
      <div class="vt-settings-grid">
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Название"
          :hint="SETTING_IMPACT.name"
          :error="errors.name"
        >
          <input
            :id="id"
            v-model="draft.name"
            class="vt-field"
            data-settings-field="name"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="!canEdit || saving"
          />
        </SettingsField>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Город"
          :hint="SETTING_IMPACT.city"
          :error="errors.city"
        >
          <input
            :id="id"
            v-model="draft.city"
            class="vt-field"
            data-settings-field="city"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="!canEdit || saving"
          />
        </SettingsField>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Район"
          :hint="SETTING_IMPACT.district"
          :error="errors.district"
        >
          <input
            :id="id"
            v-model="draft.district"
            class="vt-field"
            data-settings-field="district"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="!canEdit || saving"
          />
        </SettingsField>
        <div class="vt-settings-grid__wide">
          <SettingsField
            v-slot="{ id, describedby, invalid }"
            label="Описание"
            :hint="SETTING_IMPACT.description"
            :error="errors.description"
          >
            <textarea
              :id="id"
              v-model="draft.description"
              class="vt-field vt-settings-textarea"
              rows="3"
              data-settings-field="description"
              :aria-describedby="describedby"
              :aria-invalid="invalid"
              :disabled="!canEdit || saving"
            />
          </SettingsField>
        </div>
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
    <section class="vt-card vt-settings-card">
      <h2 class="vt-settings-card__title">Видимость</h2>
      <SettingsRow
        label="Показывать страницу группы в поиске"
        :hint="SETTING_IMPACT.seoIndex"
        :model-value="settings.seoIndex"
        :disabled="!canEdit || controller.isPending('seoIndex')"
        @update:model-value="controller.toggle('seoIndex', $event)"
      />
    </section>
  </div>
</template>
