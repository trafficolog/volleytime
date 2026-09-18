<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<template>
  <ul class="space-y-3" aria-busy="true" aria-label="Загрузка">
    <li v-for="i in count" :key="i" class="vt-card p-4">
      <div class="animate-pulse space-y-2">
        <div class="h-4 bg-vt-bone-2 rounded w-2/3" />
        <div class="h-3 bg-vt-bone-2 rounded w-1/3" />
      </div>
    </li>
  </ul>
</template>
