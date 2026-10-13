<script setup lang="ts">
/** Переключатель 36×20 (role=switch). Зона нажатия 44×44 — через ::after. */
const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string; disabled?: boolean }>()
</script>

<template>
  <button
    type="button"
    class="vt-toggle"
    role="switch"
    :aria-checked="model"
    :aria-label="label"
    :disabled="disabled"
    @click="model = !model"
  >
    <span class="vt-toggle__thumb" aria-hidden="true" />
  </button>
</template>
