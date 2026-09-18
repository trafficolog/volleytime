<script setup lang="ts">
withDefaults(defineProps<{ message?: string; retryLabel?: string; retry?: boolean }>(), {
  message: 'Не удалось загрузить данные',
  retryLabel: 'Повторить',
  retry: true,
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="text-center py-12 px-6" role="alert">
    <div
      class="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center bg-[var(--vt-rose-soft)] text-vt-rose-ink"
    >
      <VtIcon name="alert" :size="22" />
    </div>
    <p class="text-vt-ink-3 mb-4">{{ message }}</p>
    <button v-if="retry" type="button" class="vt-btn vt-btn--ghost" @click="$emit('retry')">
      {{ retryLabel }}
    </button>
  </div>
</template>
