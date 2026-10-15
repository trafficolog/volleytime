<script setup lang="ts">
import { useId } from 'vue'

import VtToggle from '~/components/vt/Toggle.vue'

/** Строка-переключатель: название, подсказка влияния и VtToggle (сохраняется сразу). */
defineProps<{ label: string; hint: string; disabled?: boolean }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="vt-settings-row">
    <div class="vt-settings-row__text">
      <div :id="`${id}-label`" class="vt-settings-row__title">{{ label }}</div>
      <div :id="`${id}-hint`" class="vt-settings-hint">{{ hint }}</div>
    </div>
    <VtToggle
      v-model="model"
      :labelledby="`${id}-label`"
      :aria-describedby="`${id}-hint`"
      :disabled="disabled"
    />
  </div>
</template>
