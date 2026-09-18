<script setup lang="ts">
import { formatDay } from '@volley-time/shared'
import { displayName, formatPrice } from '~/utils/labels'
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

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = (
      await $fetch<{ payments: PendingPayment[] }>(`/api/organizations/${orgId.value}/payments`)
    ).payments
  } catch (e) {
    loadError.value =
      apiErrorStatus(e) === 403
        ? 'Подтверждать оплаты могут организаторы'
        : apiErrorMessage(e, 'Не удалось загрузить платежи')
  } finally {
    loading.value = false
  }
}
await load()

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
  actionError.value = ''
  if (action === 'reject') {
    const ok = await askConfirm(
      `Отклонить оплату ${displayName(p.user)}? ${p.event ? 'Запись будет отменена, место перейдёт следующему в листе ожидания.' : 'Абонемент не будет активирован.'}`,
    )
    if (!ok) return
  }
  busy.value = p.id
  try {
    await $fetch(`/api/organizations/${orgId.value}/payments/${p.id}/${action}`, { method: 'POST' })
    haptic(action === 'confirm' ? 'success' : 'warning')
    items.value = items.value.filter((x) => x.id !== p.id)
  } catch (e) {
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
      :sub="items.length ? `${items.length} · ожидается ${totals}` : undefined"
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
      <ul v-else class="space-y-2.5">
        <li v-for="p in items" :key="p.id" class="vt-card p-3.5">
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
            <VtChip>{{ p.method === 'transfer' ? 'Перевод' : 'Наличные' }}</VtChip>
            <VtChip v-if="p.plan" tone="flame">Абонемент</VtChip>
            <span class="ml-auto text-[11px] text-vt-mute-2">{{ ago(p.createdAt) }}</span>
          </div>
          <div class="flex gap-1.5 mt-3">
            <button
              type="button"
              class="vt-btn vt-btn--ghost flex-1"
              :disabled="busy === p.id"
              @click="act(p, 'reject')"
            >
              Отклонить
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--primary flex-[1.6]"
              :disabled="busy === p.id"
              @click="act(p, 'confirm')"
            >
              <VtIcon name="check" :size="14" /> Подтвердить
            </button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>
