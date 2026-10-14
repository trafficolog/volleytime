<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useToast } from '~/composables/useToast'

/**
 * Хост тоста: смонтировать один раз в layout. Live-регион существует всегда.
 * После монтирования уезжает в body, чтобы VtAlert не делал его inert вместе с приложением
 * (на сервере рендерится на месте).
 */
const { current } = useToast()
const mounted = ref(false)
onMounted(() => (mounted.value = true))
</script>

<template>
  <Teleport to="body" :disabled="!mounted">
    <div
      class="vt-toast-host"
      data-vt-toast-host
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        v-if="current"
        :key="current.id"
        class="vt-toast"
        :class="{ 'vt-toast--danger': current.tone === 'danger' }"
      >
        {{ current.message }}
      </div>
    </div>
  </Teleport>
</template>
