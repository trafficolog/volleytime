<script setup lang="ts">
import { useId } from 'vue'

/** Подпись, подсказка «на что влияет» и ошибка вокруг одного поля. */
defineProps<{ label: string; hint: string; error?: string }>()
const id = useId()
</script>

<template>
  <div class="vt-settings-field">
    <label class="vt-label" :for="id">{{ label }}</label>
    <slot :id="id" :describedby="`${id}-hint ${id}-err`" :invalid="!!error" />
    <p :id="`${id}-hint`" class="vt-settings-hint">{{ hint }}</p>
    <p :id="`${id}-err`" class="vt-settings-error" role="alert">{{ error }}</p>
  </div>
</template>
