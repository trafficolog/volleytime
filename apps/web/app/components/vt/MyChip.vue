<script setup lang="ts">
import { computed } from 'vue'

import { participationOf } from '~/utils/status-model'

/** Ось «Моё участие»: синий чип словом, только у игрока (19.1.2). */
const props = withDefaults(
  defineProps<{
    booking:
      { status: string; waitPos?: number | null; waitlistSeats?: number | null } | null | undefined
    onDark?: boolean
  }>(),
  { onDark: false },
)
const participation = computed(() => participationOf(props.booking))
</script>

<template>
  <span
    v-if="participation"
    class="vt-chip"
    :class="[
      {
        'vt-chip--mine': participation.key === 'going',
        'vt-chip--queue': participation.key === 'waitlist',
      },
      { 'vt-chip--on-hero': onDark },
    ]"
    :data-participation="participation.key"
  >
    <VtIcon :name="participation.icon" :size="12" :stroke-width="2.4" />{{ participation.label }}
  </span>
</template>
