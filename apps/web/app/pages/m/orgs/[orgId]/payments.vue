<script setup lang="ts">
import { formatDay } from '@volley-time/shared'

import { PAYMENT_METHOD_LABELS, displayName, formatPrice, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface PendingPayment {
  id: number
  amount: number
  currency: string
  method: 'cash' | 'transfer' | 'online'
  createdAt: string
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  event: { id: number; title: string; startsAt: string } | null
  plan: { name: string } | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { confirm: askConfirm, haptic } = useTelegram()

const items = ref<PendingPayment[]>([])
const loading = ref(false)
const loadError = ref('')
const actionError = ref('')
const busy = ref<number | null>(null)
const loadedOrgId = ref<number | null>(null)
const forbidden = ref(false)
let loadVersion = 0

async function load() {
  const requestedOrgId = orgId.value
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  forbidden.value = false
  loadedOrgId.value = null
  items.value = []
  try {
    const data = await $fetch<{ payments: PendingPayment[] }>(
      `/api/organizations/${requestedOrgId}/payments`,
    )
    if (version !== loadVersion || requestedOrgId !== orgId.value) return
    items.value = data.payments
    loadedOrgId.value = requestedOrgId
  } catch (e) {
    if (version !== loadVersion || requestedOrgId !== orgId.value) return
    forbidden.value = apiErrorStatus(e) === 403
    loadError.value = forbidden.value
      ? 'Подтверждать оплаты могут организаторы'
      : apiErrorMessage(e, 'Не удалось загрузить платежи')
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
await load()
watch(orgId, () => {
  actionError.value = ''
  void load()
})

const totals = computed(() => {
  const by: Record<string, number> = {}
  for (const p of items.value) by[p.currency] = (by[p.currency] ?? 0) + p.amount
  return Object.entries(by)
    .map(([c, a]) => formatPrice(a, c))
    .join(' + ')
})

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.round(h / 24)} дн назад`
}

async function act(p: PendingPayment, action: 'confirm' | 'reject') {
  if (busy.value !== null || loadedOrgId.value !== orgId.value || loading.value || forbidden.value)
    return
  const actionOrgId = orgId.value
  actionError.value = ''
  if (action === 'reject') {
    const ok = await askConfirm(
      `Отклонить оплату ${displayName(p.user)}? ${p.event ? 'Запись будет отменена, место перейдёт следующему в листе ожидания.' : 'Абонемент не будет активирован.'}`,
    )
    if (!ok || actionOrgId !== orgId.value || loadedOrgId.value !== actionOrgId) return
  }
  busy.value = p.id
  try {
    await $fetch(`/api/organizations/${actionOrgId}/payments/${p.id}/${action}`, { method: 'POST' })
    if (actionOrgId !== orgId.value) return
    haptic(action === 'confirm' ? 'success' : 'warning')
    items.value = items.value.filter((x) => x.id !== p.id)
  } catch (e) {
    if (actionOrgId !== orgId.value) return
    haptic('error')
    actionError.value =
      apiErrorCode(e) === 'payment.not_pending'
        ? 'Платёж уже обработан — список обновлён'
        : apiErrorMessage(e, 'Не удалось обработать платёж')
    await load()
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader
      title="Ожидают подтверждения"
      :sub="
        loadedOrgId === orgId && items.length ? `${items.length} · ожидается ${totals}` : undefined
      "
      :back="`/m/orgs/${orgId}`"
    />
    <main class="px-4 py-3 space-y-3">
      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <SkeletonList v-if="loading" :count="3" />
      <ErrorState
        v-else-if="loadError"
        :message="loadError"
        :retry="!loadError.includes('организатор')"
        @retry="load"
      />
      <EmptyState
        v-else-if="items.length === 0"
        icon="check"
        title="Всё подтверждено"
        description="Нет платежей, ожидающих подтверждения"
      />
      <template v-else>
        <section class="vt-card vt-card--warm p-4" aria-label="Сумма ожидающих оплат">
          <div class="vt-cap">Ждут подтверждения</div>
          <div class="vt-mono mt-2 text-xl font-bold break-words">{{ totals }}</div>
          <p class="mt-1 text-xs text-vt-mute-2">Платежей в очереди: {{ items.length }}</p>
        </section>
        <ul class="space-y-2.5" aria-label="Ожидающие платежи">
          <li v-for="p in items" :key="p.id" class="vt-card p-4">
            <div class="flex items-center gap-2.5">
              <VtAvatar :name="displayName(p.user)" :src="p.user.image" />
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-sm font-semibold truncate">{{ displayName(p.user) }}</span>
                  <span class="vt-mono font-bold">{{ formatPrice(p.amount, p.currency) }}</span>
                </div>
                <div class="text-xs text-vt-mute-2 truncate">
                  <template v-if="p.event"
                    >{{ p.event.title }} · {{ formatDay(p.event.startsAt, tz) }}</template
                  >
                  <template v-else-if="p.plan">Абонемент «{{ p.plan.name }}»</template>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-2.5">
              <VtChip>{{ label(PAYMENT_METHOD_LABELS, p.method) }}</VtChip>
              <VtChip v-if="p.plan" tone="flame">Абонемент</VtChip>
              <span class="ml-auto text-[11px] text-vt-mute-2">{{ ago(p.createdAt) }}</span>
            </div>
            <div class="payment-actions flex gap-1.5 mt-3">
              <button
                type="button"
                class="vt-btn vt-btn--ghost flex-1"
                :disabled="busy !== null || loadedOrgId !== orgId"
                @click="act(p, 'reject')"
              >
                Отклонить
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--primary flex-[1.6]"
                :disabled="busy !== null || loadedOrgId !== orgId"
                @click="act(p, 'confirm')"
              >
                <VtIcon name="check" :size="14" /> Подтвердить
              </button>
            </div>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>

<style scoped>
@media (max-width: 200px) {
  .payment-actions {
    flex-direction: column;
  }
}
</style>
