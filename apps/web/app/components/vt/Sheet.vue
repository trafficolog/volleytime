<script setup lang="ts">
/** Нижний лист (bottom sheet) для выбора действия. */
const open = defineModel<boolean>({ default: false })
defineProps<{ title?: string }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/40"
        aria-label="Закрыть"
        @click="open = false"
      />
      <div
        class="relative w-full rounded-t-2xl bg-vt-paper border-t border-vt-stroke p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-vt-stroke-2" aria-hidden="true" />
        <h2 v-if="title" class="text-base font-semibold mb-3">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
