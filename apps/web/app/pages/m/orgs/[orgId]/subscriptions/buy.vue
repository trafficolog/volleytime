<script setup lang="ts">
import type { SubscriptionPlan } from '@volley-time/db'

import { formatPrice } from '~/utils/labels'
import { playerAccessFromApiError } from '~/utils/player-home'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
import { subscriptionUiState } from '~/utils/subscription-availability'
import { runSubscriptionPurchase } from '~/utils/subscription-purchase'
import { subscriptionPerSession } from '~/utils/subscription-view'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/** Покупка абонемента v3 (20.4.9, M-13): выбор плана и способа оплаты, оформление — как прежде. */
type Method = 'cash' | 'transfer'

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { haptic } = useTelegram()
const toast = useToast()
const {
  data: orgData,
  error: orgError,
  pending: orgLoading,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number; subscriptionsEnabled: boolean }
}>(() => `/api/organizations/${orgId.value}`, {
  key: () => `player-subscription-buy-org-${orgId.value}`,
})

const plans = ref<SubscriptionPlan[]>([])
const loading = ref(false)
const loadError = ref('')
const loadAccessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const accessNotice = computed(
  () => playerAccessFromApiError(apiErrorCode(orgError.value)) ?? loadAccessNotice.value,
)
const allowPurchase = computed(
  () =>
    subscriptionUiState(
      orgError.value || orgData.value?.organization.id !== orgId.value
        ? null
        : orgData.value.organization.subscriptionsEnabled,
      orgId.value,
      [],
    ).allowPurchase,
)

const selected = ref<SubscriptionPlan | null>(null)
const method = ref<Method>('cash')
const buying = ref(false)
const buyError = ref('')
const purchaseGuard = createPlayerRequestGuard(() => `${orgId.value}:${allowPurchase.value}`)
let loadSeq = 0

async function load() {
  const mine = ++loadSeq
  loadError.value = ''
  loadAccessNotice.value = null
  if (!allowPurchase.value) {
    plans.value = []
    selected.value = null
    return
  }
  const requestedOrg = orgId.value
  loading.value = true
  try {
    const result = (
      await $fetch<{ plans: SubscriptionPlan[] }>(`/api/organizations/${requestedOrg}/plans`)
    ).plans.filter((plan) => plan.organizationId === requestedOrg && plan.status === 'active')
    if (mine !== loadSeq) return
    plans.value = result
    if (!result.some((plan) => plan.id === selected.value?.id)) selected.value = result[0] ?? null
  } catch (e) {
    if (mine === loadSeq) {
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить планы')
      loadAccessNotice.value = playerAccessFromApiError(apiErrorCode(e))
    }
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
await load()

watch(
  orgId,
  () => {
    purchaseGuard.invalidate()
    plans.value = []
    selected.value = null
    buyError.value = ''
    buying.value = false
    void refreshOrg()
    void load()
  },
  { flush: 'sync' },
)
watch(
  allowPurchase,
  (allowed) => {
    if (!allowed) {
      purchaseGuard.invalidate()
      buying.value = false
    }
    void load()
  },
  { flush: 'sync' },
)

const isFree = computed(() => selected.value?.price === 0)

async function buy() {
  const request = purchaseGuard.begin()
  const result = await runSubscriptionPurchase(
    {
      orgId: orgId.value,
      allowPurchase: allowPurchase.value,
      buying: buying.value,
      plan: selected.value,
    },
    isFree.value ? 'cash' : method.value,
    (requestedOrgId, planId, paymentMethod) => {
      buying.value = true
      buyError.value = ''
      return $fetch<void>(`/api/organizations/${requestedOrgId}/subscriptions` as string, {
        method: 'POST',
        body: { planId, method: paymentMethod },
      })
    },
    request.isCurrent,
    () => haptic('success'),
  )
  if (result.kind === 'success') {
    toast.show(isFree.value ? 'Абонемент активирован' : 'Заявка отправлена организатору')
    await navigateTo(`${base.value}/subscriptions`)
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

const sessionsWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? 'сессия'
    : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
      ? 'сессии'
      : 'сессий'
const planMeta = (p: SubscriptionPlan) => {
  const per = subscriptionPerSession(p.price, p.totalSessions)
  return [
    p.validityDays ? `${p.validityDays} дн.` : 'бессрочно',
    per !== null ? `${formatPrice(per, p.currency)} за сессию` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div class="min-h-screen pb-6">
    <VtMiniHeader title="Купить абонемент" :back="`${base}/subscriptions`" />
    <main class="px-4 pb-4 pt-2">
      <SkeletonList v-if="orgLoading || loading" :count="3" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState
        v-else-if="orgError || loadError"
        :message="orgError ? 'Не удалось проверить настройки группы' : loadError"
        @retry="retryPage"
      />
      <p v-else-if="!allowPurchase" class="vt-card p-4 text-sm text-vt-mute-2">
        Абонементы в этой группе сейчас недоступны для покупки.
        <NuxtLink :to="`${base}/subscriptions`" class="font-semibold underline"
          >К моим абонементам</NuxtLink
        >
      </p>
      <EmptyState
        v-else-if="plans.length === 0"
        icon="ticket"
        title="Организатор пока не добавил планы"
      />
      <template v-else>
        <div class="px-1 pb-3.5">
          <h2 class="font-display text-xl font-bold">Выберите абонемент</h2>
          <p class="mt-1.5 text-sm text-vt-mute-2">
            Списывается автоматически при записи. Абонемент активируется, когда организатор
            подтвердит оплату.
          </p>
        </div>

        <div role="radiogroup" aria-label="План абонемента" class="flex flex-col gap-2.5">
          <button
            v-for="p in plans"
            :key="p.id"
            type="button"
            role="radio"
            :aria-checked="selected?.id === p.id"
            class="vt-card !flex items-center gap-3.5 !p-4 text-left"
            :class="selected?.id === p.id ? 'ring-2 ring-[var(--vt-ring)]' : ''"
            @click="selected = p"
          >
            <span
              class="h-[18px] w-[18px] shrink-0 rounded-full border-solid"
              :class="
                selected?.id === p.id ? 'border-[5px] border-vt-flame' : 'border-2 border-vt-stroke'
              "
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline gap-1.5">
                <span class="font-display text-xl font-bold">{{ p.totalSessions }}</span>
                <span class="text-sm text-vt-mute-2">{{ sessionsWord(p.totalSessions) }}</span>
              </span>
              <span class="mt-0.5 block truncate text-xs text-vt-mute-2"
                >{{ p.name }} · {{ planMeta(p) }}</span
              >
            </span>
            <span class="vt-mono text-lg font-bold">{{ formatPrice(p.price, p.currency) }}</span>
          </button>
        </div>

        <template v-if="selected && !isFree">
          <h2 class="vt-cap mb-2.5 mt-5 px-1 text-vt-mute-2">Способ оплаты</h2>
          <div
            role="radiogroup"
            aria-label="Способ оплаты"
            class="vt-card divide-y divide-vt-stroke overflow-hidden"
          >
            <button
              v-for="o in [
                {
                  id: 'cash',
                  t: 'Наличными организатору',
                  s: 'Касса обновится после подтверждения',
                },
                { id: 'transfer', t: 'Переводом', s: 'Реквизиты уточните у организатора' },
              ] as const"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="method === o.id"
              class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
              @click="method = o.id"
            >
              <span
                class="h-[18px] w-[18px] shrink-0 rounded-full border-solid"
                :class="
                  method === o.id ? 'border-[5px] border-vt-flame' : 'border-2 border-vt-stroke'
                "
                aria-hidden="true"
              />
              <span class="flex-1">
                <span class="block text-[15px] font-semibold">{{ o.t }}</span>
                <span class="mt-0.5 block text-xs text-vt-mute-2">{{ o.s }}</span>
              </span>
            </button>
            <div class="flex items-center gap-3 px-3.5 py-3.5 opacity-45" aria-disabled="true">
              <span
                class="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-solid border-vt-stroke"
                aria-hidden="true"
              />
              <span class="flex-1">
                <span class="block text-[15px] font-semibold">Картой онлайн</span>
                <span class="mt-0.5 block text-xs text-vt-mute-2">скоро</span>
              </span>
            </div>
          </div>
        </template>
        <p v-if="isFree" class="mt-4 px-1 text-sm text-vt-mute-2">
          Бесплатный абонемент активируется сразу.
        </p>

        <p v-if="buyError" class="mt-3 text-sm text-vt-rose-ink" role="alert">{{ buyError }}</p>
        <div
          class="sticky bottom-[calc(var(--player-dock-height,58px)+28px+var(--vt-safe-bottom))] mt-5 bg-vt-paper pb-1 pt-3"
        >
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full !justify-between"
            :disabled="buying || !selected"
            @click="buy"
          >
            <span>{{
              isFree
                ? 'Получить'
                : `Купить «${selected?.totalSessions} ${sessionsWord(selected?.totalSessions ?? 0)}»`
            }}</span>
            <span v-if="selected" class="vt-mono">{{
              formatPrice(selected.price, selected.currency)
            }}</span>
          </button>
        </div>
      </template>
    </main>
  </div>
</template>
