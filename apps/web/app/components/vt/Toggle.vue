<script setup lang="ts">
/**
 * Переключатель 36×20 (role=switch). Зона нажатия 44×44 — через ::after.
 * Доступное имя обязательно: `label` или `labelledby` (id видимой подписи).
 */
const model = defineModel<boolean>({ default: false })
const props = defineProps<{ label?: string; labelledby?: string; disabled?: boolean }>()
if (import.meta.dev && !props.label && !props.labelledby) {
  console.warn('[VtToggle] нужен label или labelledby: у переключателя нет доступного имени')
}
</script>

<template>
  <button
    type="button"
    class="vt-toggle"
    role="switch"
    :aria-checked="model"
    :aria-label="labelledby ? undefined : label"
    :aria-labelledby="labelledby"
    :disabled="disabled"
    @click="model = !model"
  >
    <span class="vt-toggle__thumb" aria-hidden="true" />
  </button>
</template>
