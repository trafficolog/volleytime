<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { apiErrorStatus } from '~/utils/api-error'
import {
  acceptFailureState,
  clearTransferToken,
  formatDangerDate,
  TRANSFER_STATE_TEXT,
  type TransferPageState,
} from '~/utils/group-danger'

/**
 * Принятие передачи владения по личной ссылке (21.2.17, D-15) — общая часть страниц Mini App и
 * веба. Токен приходит из startapp или фрагмента адреса и уходит на сервер только в теле
 * запроса. Принять может только получатель; чужая ссылка выглядит как недействительная.
 */
const props = defineProps<{
  token: string | null
  /** Куда вести после принятия: `/app/orgs` (кабинет) или `/m/orgs` (Mini App). */
  orgBase: string
}>()

interface Preview {
  status: 'pending' | 'accepted' | 'cancelled' | 'expired' | 'invalid'
  organization: { id: number; name: string } | null
  fromName: string | null
  expiresAt: string | null
}

const state = ref<TransferPageState>('loading')
const preview = ref<Preview | null>(null)
const busy = ref(false)
const orgId = ref<number | null>(null)
const needsLogin = ref(false)
const text = computed(() =>
  state.value === 'loading' || state.value === 'pending' ? null : TRANSFER_STATE_TEXT[state.value],
)

async function load() {
  if (!props.token) {
    state.value = 'invalid'
    return
  }
  try {
    const data = await $fetch<Preview>('/api/ownership-transfers/preview', {
      method: 'POST',
      body: { token: props.token },
    })
    preview.value = data
    orgId.value = data.organization?.id ?? null
    state.value = data.status
    if (data.status !== 'pending') clearTransferToken()
  } catch (cause) {
    needsLogin.value = apiErrorStatus(cause) === 401
    state.value = 'error'
  }
}
onMounted(load)

async function accept() {
  if (busy.value || !props.token) return
  busy.value = true
  try {
    const result = await $fetch<{ organizationId: number }>('/api/ownership-transfers/accept', {
      method: 'POST',
      body: { token: props.token },
    })
    orgId.value = result.organizationId
    state.value = 'done'
    clearTransferToken()
  } catch (cause) {
    state.value = acceptFailureState(cause)
    if (state.value !== 'error') clearTransferToken()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-card p-6 space-y-4" data-transfer-accept>
    <p v-if="state === 'loading'" role="status">Проверяем ссылку…</p>
    <template v-else-if="state === 'pending' && preview?.organization">
      <p class="vt-cap">Передача владения</p>
      <h1 class="text-2xl">{{ preview.organization.name }}</h1>
      <p>
        {{ preview.fromName ?? 'Владелец группы' }} передаёт вам владение группой. Вы получите все
        права владельца, а прежний владелец станет организатором.
      </p>
      <p v-if="preview.expiresAt" class="text-vt-mute-2">
        Ссылка действует до {{ formatDangerDate(preview.expiresAt) }}.
      </p>
      <button
        type="button"
        class="vt-btn vt-btn--primary vt-btn--full"
        data-accept
        :disabled="busy"
        @click="accept"
      >
        {{ busy ? 'Принимаем…' : 'Принять владение' }}
      </button>
    </template>
    <template v-else-if="text">
      <h1 class="text-2xl">{{ text.title }}</h1>
      <p role="status">
        {{ needsLogin ? 'Войдите в Volley Time и откройте ссылку ещё раз.' : text.body }}
      </p>
      <NuxtLink
        v-if="state === 'done' && orgId"
        :to="`${orgBase}/${orgId}`"
        class="vt-btn vt-btn--primary vt-btn--full"
        >Открыть группу</NuxtLink
      >
      <button
        v-else-if="state === 'error' && !needsLogin"
        type="button"
        class="vt-btn vt-btn--ghost"
        @click="load"
      >
        Повторить
      </button>
    </template>
  </section>
</template>
