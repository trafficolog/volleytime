<script setup lang="ts">
import { computed } from 'vue'

import { eventStateOf } from '~/utils/status-model'

/** Ось «Событие»: нейтральный серый чип словом — «Запись закрыта», «Прошла», «Отменена» (19.1.2). */
const props = defineProps<{
  event: { status: string; startsAt: string | Date; endsAt?: string | Date | null }
  now?: Date
}>()
const state = computed(() => eventStateOf(props.event, props.now))
</script>

<template>
  <span v-if="state" class="vt-chip vt-chip--state" :data-event-state="state.key">{{
    state.label
  }}</span>
</template>
