<script setup lang="ts">
import { useToast } from '~/composables/useToast'

/** Хост тоста: смонтировать один раз в layout. Live-регион существует всегда. */
const { current } = useToast()
</script>

<template>
  <div class="vt-toast-host" role="status" aria-live="polite" aria-atomic="true">
    <div
      v-if="current"
      :key="current.id"
      class="vt-toast"
      :class="{ 'vt-toast--danger': current.tone === 'danger' }"
    >
      {{ current.message }}
    </div>
  </div>
</template>
