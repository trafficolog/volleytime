<script setup lang="ts">
import { computed, ref } from 'vue'

import { dangerErrorMessage, formatDangerDate } from '~/utils/group-danger'

/**
 * Удалённая группа в кабинете (21.2.17): «Группа удалена, восстановление до …». Владелец
 * восстанавливает её в окне; после окна и остальным участникам — только сообщение.
 */
const props = withDefaults(
  defineProps<{
    orgId: number
    orgName?: string
    restoreUntil?: string | Date | null
    canRestore: boolean
    timeZone?: string
  }>(),
  { orgName: '', restoreUntil: null, timeZone: 'Europe/Minsk' },
)
const emit = defineEmits<{ restored: [] }>()

const busy = ref(false)
const error = ref('')
const windowOpen = computed(
  () => props.restoreUntil !== null && new Date(props.restoreUntil).getTime() > Date.now(),
)

async function restore() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/organizations/${props.orgId}/restore`, { method: 'POST' })
    emit('restored')
  } catch (cause) {
    error.value = dangerErrorMessage(cause, 'Не удалось восстановить группу')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-card p-6 vt-group-deleted" role="alert" data-group-deleted>
    <h1>Группа удалена</h1>
    <template v-if="canRestore && restoreUntil">
      <p v-if="windowOpen">
        «{{ orgName }}» скрыта от участников, запись и оплата остановлены, деньги не менялись.
        Восстановить группу можно до {{ formatDangerDate(restoreUntil, timeZone) }}.
      </p>
      <p v-else>Срок восстановления истёк: группу уже не вернуть.</p>
      <div class="flex flex-wrap gap-3">
        <button
          v-if="windowOpen"
          type="button"
          class="vt-btn vt-btn--primary"
          data-restore
          :disabled="busy"
          @click="restore"
        >
          {{ busy ? 'Восстанавливаем…' : 'Восстановить группу' }}
        </button>
        <NuxtLink to="/app?choose=1" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
      </div>
    </template>
    <template v-else>
      <p>Владелец удалил эту группу. Кабинет и запись недоступны.</p>
      <NuxtLink to="/app?choose=1" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
    </template>
    <p v-if="error" class="vt-settings-error vt-settings-error--form">{{ error }}</p>
  </section>
</template>
