<script setup lang="ts">
import type { Subscription, SubscriptionPlan } from '@volley-time/db'
import { formatDay, formatShortDate } from '@volley-time/shared'

import { formatPrice } from '~/utils/labels'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
import {
  subscriptionHistoryLabel,
  subscriptionSections,
  subscriptionUiState,
} from '~/utils/subscription-availability'
import { runSubscriptionPurchase } from '~/utils/subscription-purchase'
import { createSubscriptionViewLoader } from '~/utils/subscription-view-loader'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type MySub = Subscription & {
  plan: { id: number; name: string }
  pendingPayment: { id: number; amount: number; currency: string; method: string } | null
  usage: { bookingId: number; status: string; eventTitle: string; startsAt: string }[]
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { haptic } = useTelegram()
const {
  data: orgData,
  error: orgError,
  pending: orgLoading,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number; subscriptionsEnabled: boolean }
}>(() => `/api/organizations/${orgId.value}`, {
  key: () => `player-subscription-org-${orgId.value}`,
})

const subs = ref<MySub[]>([])
const plans = ref<SubscriptionPlan[]>([])
const loading = ref(false)
const loadError = ref('')
const availability = computed(() =>
  subscriptionUiState(
    orgError.value || orgData.value?.organization.id !== orgId.value
      ? null
      : orgData.value.organization.subscriptionsEnabled,
    orgId.value,
    subs.value,
  ),
)

const loadView = createSubscriptionViewLoader<MySub, SubscriptionPlan>(
  () => orgId.value,
  () => availability.value.allowPurchase,
  async (id) =>
    (await $fetch<{ subscriptions: MySub[] }>(`/api/organizations/${id}/subscriptions/my`))
      .subscriptions,
  async (id) =>
    (await $fetch<{ plans: SubscriptionPlan[] }>(`/api/organizations/${id}/plans`)).plans,
)
let currentLoad: ReturnType<typeof loadView> | null = null

async function load() {
  loading.value = true
  loadError.value = ''
  const request = loadView()
  currentLoad = request
  try {
    const result = await request
    if (result.stale) return
    subs.value = result.subscriptions
    plans.value = result.plans.filter(
      (plan) => plan.organizationId === orgId.value && plan.status === 'active',
    )
  } catch (e) {
    if (currentLoad === request)
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить абонементы')
  } finally {
    if (currentLoad === request) loading.value = false
  }
}
await load()

const sections = computed(() => subscriptionSections(orgId.value, subs.value, new Date()))
const active = computed(() => sections.value.active)
const pending = computed(() => sections.value.pending)
const history = computed(() => sections.value.history)
const openHistory = ref<number | null>(null)

// покупка
const buyPlan = ref<SubscriptionPlan | null>(null)
const buyOpen = computed({
  get: () => buyPlan.value !== null,
  set: (v) => {
    if (!v) buyPlan.value = null
  },
})
const buying = ref(false)
const buyError = ref('')
const purchaseGuard = createPlayerRequestGuard(
  () => `${orgId.value}:${availability.value.allowPurchase}`,
)
watch(
  orgId,
  () => {
    purchaseGuard.invalidate()
    subs.value = []
    plans.value = []
    openHistory.value = null
    buyPlan.value = null
    buyError.value = ''
    buying.value = false
    void refreshOrg()
    void load()
  },
  { flush: 'sync' },
)
watch(
  () => availability.value.allowPurchase,
  (allowed) => {
    if (!allowed) {
      purchaseGuard.invalidate()
      buyPlan.value = null
      buying.value = false
    }
    void load()
  },
  { flush: 'sync' },
)
async function buy(method: 'cash' | 'transfer') {
  const request = purchaseGuard.begin()
  const result = await runSubscriptionPurchase(
    {
      orgId: orgId.value,
      allowPurchase: availability.value.allowPurchase,
      buying: buying.value,
      plan: buyPlan.value,
    },
    method,
    (requestedOrgId, planId, paymentMethod) => {
      buying.value = true
      buyError.value = ''
      return $fetch<void>(`/api/organizations/${requestedOrgId}/subscriptions` as string, {
        method: 'POST',
        body: { planId, method: paymentMethod },
      })
    },
    request.isCurrent,
    () => {
      haptic('success')
      buyPlan.value = null
    },
  )
  if (result.kind === 'success') {
    await load()
  } else if (result.kind === 'error') {
    haptic('error')
    buyError.value = apiErrorMessage(result.error, 'Не удалось оформить абонемент')
  }
  if (request.isCurrent()) buying.value = false
}

async function retryPage() {
  await refreshOrg()
  await load()
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Абонементы" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-5 space-y-6">
      <SkeletonList v-if="orgLoading || loading" :count="2" />
      <ErrorState
        v-else-if="orgError || loadError"
        :message="orgError ? 'Не удалось проверить настройки группы' : loadError"
        @retry="retryPage"
      />
      <template v-else>
        <section aria-labelledby="subscription-balance-title">
          <h2 id="subscription-balance-title" class="vt-cap mb-3">Мой остаток</h2>
          <EmptyState
            v-if="active.length === 0"
            icon="ticket"
            title="Активных абонементов нет"
            :description="
              availability.allowPurchase
                ? 'Выберите план ниже'
                : 'Ваши покупки и история сохраняются'
            "
          />
          <ul v-else class="space-y-3">
            <li v-for="s in active" :key="s.id" class="vt-card p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ s.plan.name }}</span>
                <VtChip tone="grass" dot>Активен</VtChip>
              </div>
              <div class="mt-3 flex items-baseline gap-1.5">
                <span class="vt-mono text-2xl font-bold">{{
                  s.totalSessions - s.usedSessions
                }}</span>
                <span class="text-sm text-vt-mute-2"
                  >из {{ s.totalSessions }} занятий осталось</span
                >
              </div>
              <VtMeter
                class="mt-2"
                :value="s.totalSessions - s.usedSessions"
                :max="s.totalSessions"
                tone="grass"
                label="Остаток"
              />
              <p class="text-xs text-vt-mute-2 mt-2">
                {{
                  s.expiresAt ? `Действует до ${formatShortDate(s.expiresAt, tz)}` : 'Бессрочный'
                }}
              </p>
              <button
                v-if="s.usage.length"
                type="button"
                class="inline-flex min-h-11 items-center text-xs font-semibold text-vt-link mt-2"
                :aria-expanded="openHistory === s.id"
                @click="openHistory = openHistory === s.id ? null : s.id"
              >
                {{
                  openHistory === s.id ? 'Скрыть историю' : `История списаний (${s.usage.length})`
                }}
              </button>
              <ul v-if="openHistory === s.id" class="mt-2 space-y-1 text-xs text-vt-mute-2">
                <li v-for="u in s.usage" :key="u.bookingId">
                  {{ formatDay(u.startsAt, tz) }} · {{ u.eventTitle }}
                  <template v-if="u.status === 'no_show'"> · не пришёл</template>
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section v-if="pending.length" aria-labelledby="subscription-pending-title">
          <h2 id="subscription-pending-title" class="vt-cap mb-3">Ожидают оплаты</h2>
          <ul class="space-y-3">
            <li v-for="s in pending" :key="s.id" class="vt-card p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ s.plan.name }}</span>
                <VtChip tone="amber" dot>Ожидает оплаты</VtChip>
              </div>
              <p v-if="s.pendingPayment" class="text-sm text-vt-mute-2 mt-3">
                Оплатите {{ formatPrice(s.pendingPayment.amount, s.pendingPayment.currency) }}
                {{ s.pendingPayment.method === 'transfer' ? 'переводом' : 'наличными' }}
                организатору — абонемент активируется после подтверждения.
              </p>
              <p v-else class="text-sm text-vt-mute-2 mt-3">
                Подтверждение оплаты ожидается у организатора.
              </p>
            </li>
          </ul>
        </section>

        <p v-if="!availability.allowPurchase" class="vt-card p-4 text-sm text-vt-mute-2">
          Абонементы в этой группе сейчас недоступны для покупки и новых записей. Ваш остаток и
          история сохраняются.
        </p>

        <section v-if="availability.allowPurchase" aria-labelledby="subscription-plans-title">
          <h2 id="subscription-plans-title" class="vt-cap mb-3">Купить абонемент</h2>
          <EmptyState
            v-if="plans.length === 0"
            icon="ticket"
            title="Организатор пока не добавил планы"
          />
          <ul v-else class="space-y-2.5">
            <li v-for="p in plans" :key="p.id" class="vt-card p-3.5 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">{{ p.name }}</div>
                <div class="text-xs text-vt-mute-2">
                  {{ p.totalSessions }} занятий ·
                  {{ p.validityDays ? `${p.validityDays} дн.` : 'бессрочно' }}
                </div>
              </div>
              <span class="font-semibold text-sm">{{ formatPrice(p.price, p.currency) }}</span>
              <button type="button" class="vt-btn vt-btn--primary vt-btn--sm" @click="buyPlan = p">
                Купить
              </button>
            </li>
          </ul>
        </section>

        <section v-if="history.length" aria-labelledby="subscription-history-title">
          <h2 id="subscription-history-title" class="vt-cap mb-3">История</h2>
          <ul class="space-y-2">
            <li
              v-for="s in history"
              :key="s.id"
              class="vt-card p-3 flex items-center gap-2 text-sm"
            >
              <span class="flex-1 truncate">{{ s.plan.name }}</span>
              <span class="text-xs text-vt-mute-2">{{ s.usedSessions }}/{{ s.totalSessions }}</span>
              <VtChip :tone="s.status === 'cancelled' ? 'rose' : 'default'">
                {{ subscriptionHistoryLabel(s) }}
              </VtChip>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <VtSheet
      v-if="availability.allowPurchase"
      v-model="buyOpen"
      :title="buyPlan ? `${buyPlan.name} · ${formatPrice(buyPlan.price, buyPlan.currency)}` : ''"
    >
      <p class="text-sm text-vt-mute-2 mb-3">
        {{
          buyPlan && buyPlan.price === 0
            ? 'Бесплатный абонемент активируется сразу.'
            : 'Как оплатите? Абонемент активируется, когда организатор подтвердит оплату.'
        }}
      </p>
      <div class="space-y-2">
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--full"
          :disabled="buying"
          @click="buy('cash')"
        >
          {{ buyPlan && buyPlan.price === 0 ? 'Получить' : 'Наличными организатору' }}
        </button>
        <button
          v-if="buyPlan && buyPlan.price > 0"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          :disabled="buying"
          @click="buy('transfer')"
        >
          Переводом
        </button>
        <p v-if="buyError" class="text-sm text-vt-rose-ink" role="alert">{{ buyError }}</p>
      </div>
    </VtSheet>
  </div>
</template>
