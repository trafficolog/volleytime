<script setup lang="ts">
import { ref } from 'vue'

import VtAlert from '~/components/vt/Alert.vue'

/** Опасная зона: архивирование с подтверждением через VtAlert (передача владения и удаление API нет). */
defineProps<{ busy: boolean; error: string }>()
const emit = defineEmits<{ archive: [] }>()
const confirmOpen = ref(false)
</script>

<template>
  <section class="vt-card vt-settings-card vt-settings-card--danger">
    <h2 class="vt-settings-card__title vt-settings-card__title--danger">Опасная зона</h2>
    <div class="vt-settings-row">
      <div class="vt-settings-row__text">
        <div class="vt-settings-row__title">Архивировать группу</div>
        <div class="vt-settings-hint">
          Группа исчезнет из активного списка, события скроются. Данные и история сохранятся.
        </div>
      </div>
      <button
        type="button"
        class="vt-btn vt-btn--danger vt-btn--sm"
        :disabled="busy"
        @click="confirmOpen = true"
      >
        {{ busy ? 'Архивируем…' : 'Архивировать' }}
      </button>
    </div>
    <p v-if="error" class="vt-settings-error vt-settings-error--form" role="alert">{{ error }}</p>
    <VtAlert
      v-model="confirmOpen"
      title="Архивировать группу?"
      body="Она исчезнет из активного списка, но данные сохранятся."
      confirm-label="Архивировать"
      danger
      @confirm="emit('archive')"
    />
  </section>
</template>
