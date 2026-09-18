<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), {
  icon: 'calendar',
  description: '',
})
</script>

<template>
  <div class="text-center py-14 px-6">
    <div
      class="mx-auto mb-3 w-12 h-12 rounded-full bg-vt-bone-2 border border-vt-stroke flex items-center justify-center text-vt-mute"
    >
      <VtIcon :name="icon" :size="22" />
    </div>
    <p class="font-display font-semibold text-vt-ink">{{ title }}</p>
    <p v-if="description" class="text-vt-mute text-sm mt-1">{{ description }}</p>
    <div class="mt-4 flex flex-col gap-2 items-center">
      <slot name="action" />
    </div>
  </div>
</template>
