<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { playerPaymentView, type PaymentMethodView } from '~/utils/payment-methods'

/**
 * Экран «ждёт оплаты» у игрока (21.2.11): включённые способы группы и реквизиты перевода
 * (банк, последние 4 цифры, получатель). Выключенный способ не показывается; если выключены
 * все — объясняем, как оплатить. Только показ: запись и подтверждение платежа не затрагиваются.
 */
const props = defineProps<{ orgId: number }>()

const methods = ref<PaymentMethodView[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
let seq = 0

async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const data = await $fetch<{ methods: PaymentMethodView[] }>(
      `/api/organizations/${props.orgId}/payment-methods`,
    )
    if (mine !== seq) return
    methods.value = data.methods
    state.value = 'ready'
  } catch {
    if (mine === seq) state.value = 'error'
  }
}
onMounted(load)
watch(() => props.orgId, load)

const view = computed(() => playerPaymentView(methods.value))
</script>

<template>
  <div class="mt-3 border-t border-vt-stroke pt-3" aria-label="Как оплатить">
    <p class="vt-cap text-vt-mute-2 mb-2">{{ view.title }}</p>
    <p v-if="state === 'loading'" class="text-sm text-vt-mute-2" role="status">
      Загружаем способы оплаты…
    </p>
    <p v-else-if="state === 'error'" class="text-sm text-vt-mute-2">
      Не удалось загрузить способы оплаты. Уточните у организатора, как оплатить.
    </p>
    <p v-else-if="view.fallback" class="text-sm text-vt-mute-2">{{ view.fallback }}</p>
    <ul v-else class="space-y-2">
      <li v-for="line in view.lines" :key="line.method" :data-method="line.method">
        <span class="text-sm font-semibold">{{ line.title }}</span>
        <span class="block text-sm text-vt-mute-2">{{ line.text }}</span>
      </li>
    </ul>
  </div>
</template>
