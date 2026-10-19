<script setup lang="ts">
import type { Subscription } from '@volley-time/db'
import { formatDay } from '@volley-time/shared'

import { formatPrice } from '~/utils/labels'
import { playerAccessFromApiError } from '~/utils/player-home'
import {
  subscriptionHistoryLabel,
  subscriptionSections,
  subscriptionUiState,
} from '~/utils/subscription-availability'
import {
  recentSubscriptionUsage,
  subscriptionDaysLeft,
  subscriptionPeriodLabel,
} from '~/utils/subscription-view'
import { createSubscriptionViewLoader } from '~/utils/subscription-view-loader'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/** Абонементы игрока v3 (20.4.9, M-13): остаток, история, последние списания; покупка — `./buy`. */
type MySub = Subscription & {
  plan: { id: number; name: string }
  pendingPayment: { id: number; amount: number; currency: string; method: string } | null
  usage: { bookingId: number; status: string; eventTitle: string; startsAt: string }[]
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
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
const loading = ref(false)
const loadError = ref('')
const loadAccessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const accessNotice = computed(
  () => playerAccessFromApiError(apiErrorCode(orgError.value)) ?? loadAccessNotice.value,
)
const availability = computed(() =>
  subscriptionUiState(
    orgError.value || orgData.value?.organization.id !== orgId.value
      ? null
      : orgData.value.organization.subscriptionsEnabled,
    orgId.value,
    subs.value,
  ),
)

// Планы нужны только экрану покупки; загрузчик здесь отдаёт одни абонементы игрока.
const loadView = createSubscriptionViewLoader<MySub, never>(
  () => orgId.value,
  () => false,
  async (id) =>
    (await $fetch<{ subscriptions: MySub[] }>(`/api/organizations/${id}/subscriptions/my`))
      .subscriptions,
  async () => [],
)
let currentLoad: ReturnType<typeof loadView> | null = null

async function load() {
  loading.value = true
  loadError.value = ''
  loadAccessNotice.value = null
  const request = loadView()
  currentLoad = request
  try {
    const result = await request
    if (result.stale) return
    subs.value = result.subscriptions
  } catch (e) {
    if (currentLoad === request) {
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить абонементы')
      loadAccessNotice.value = playerAccessFromApiError(apiErrorCode(e))
    }
  } finally {
    if (currentLoad === request) loading.value = false
  }
}
await load()

const now = new Date()
const sections = computed(() => subscriptionSections(orgId.value, subs.value, now))
const active = computed(() => sections.value.active)
const pending = computed(() => sections.value.pending)
const history = computed(() => sections.value.history)
const debits = computed(() => recentSubscriptionUsage(subs.value, 3))

watch(
  orgId,
  () => {
    subs.value = []
    void refreshOrg()
    void load()
  },
  { flush: 'sync' },
)

async function retryPage() {
  await refreshOrg()
  await load()
}

const dayMonth = (iso: string | Date) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz.value, day: 'numeric', month: 'long' }).format(
    new Date(iso),
  )
function expiryLabel(expiresAt: Subscription['expiresAt']) {
  if (!expiresAt) return 'Бессрочный'
  const days = subscriptionDaysLeft(expiresAt, now)
  return `До ${dayMonth(expiresAt)}${days === null ? '' : ` · ${days} дн.`}`
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Мои абонементы" />
    <main class="px-4 pb-5 pt-2">
      <SkeletonList v-if="orgLoading || loading" :count="2" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState
        v-else-if="orgError || loadError"
        :message="orgError ? 'Не удалось проверить настройки группы' : loadError"
        @retry="retryPage"
      />
      <template v-else>
        <section aria-labelledby="subscription-balance-title">
          <h2 id="subscription-balance-title" class="sr-only">Мой остаток</h2>
          <EmptyState
            v-if="active.length === 0"
            icon="ticket"
            title="Активных абонементов нет"
            :description="
              availability.allowPurchase
                ? 'Купите абонемент, чтобы записываться на игры по остатку'
                : 'Ваши покупки и история сохраняются'
            "
          />
          <ul v-else class="space-y-3">
            <li
              v-for="s in active"
              :key="s.id"
              class="vt-card vt-card--hero player-subscription-hero p-[18px]"
            >
              <span class="player-subscription-hero__decor" aria-hidden="true" />
              <div class="relative">
                <div class="vt-cap !text-[var(--vt-on-hero-2)]">Активный</div>
                <div class="font-display mt-1.5 text-2xl font-bold">{{ s.plan.name }}</div>
                <div class="mt-3.5 flex items-baseline gap-2">
                  <span class="vt-mono text-[36px] font-semibold leading-none">{{
                    s.totalSessions - s.usedSessions
                  }}</span>
                  <span class="text-sm text-[var(--vt-on-hero-2)]"
                    >осталось из {{ s.totalSessions }}</span
                  >
                </div>
                <div
                  class="mt-3.5 flex items-center gap-1.5"
                  role="meter"
                  aria-label="Остаток занятий"
                  :aria-valuenow="s.totalSessions - s.usedSessions"
                  aria-valuemin="0"
                  :aria-valuemax="s.totalSessions"
                >
                  <span
                    v-for="session in s.totalSessions"
                    :key="session"
                    class="h-1.5 flex-1 rounded-full"
                    :class="
                      session <= s.usedSessions ? 'bg-[var(--vt-on-hero-line)]' : 'bg-vt-amber'
                    "
                  />
                </div>
                <p class="mt-4 text-xs text-[var(--vt-on-hero-2)]">
                  {{ expiryLabel(s.expiresAt) }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="pending.length" aria-labelledby="subscription-pending-title" class="mt-5">
          <h2 id="subscription-pending-title" class="vt-cap mb-2 px-1 text-vt-mute-2">
            Ожидают оплаты
          </h2>
          <ul class="space-y-3">
            <li v-for="s in pending" :key="s.id" class="vt-card p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ s.plan.name }}</span>
                <VtChip tone="amber" dot>Ожидает оплаты</VtChip>
              </div>
              <p v-if="s.pendingPayment" class="mt-3 text-sm text-vt-mute-2">
                Оплатите {{ formatPrice(s.pendingPayment.amount, s.pendingPayment.currency) }}
                {{ s.pendingPayment.method === 'transfer' ? 'переводом' : 'наличными' }}
                организатору — абонемент активируется после подтверждения.
              </p>
              <p v-else class="mt-3 text-sm text-vt-mute-2">
                Подтверждение оплаты ожидается у организатора.
              </p>
            </li>
          </ul>
        </section>

        <section v-if="history.length" aria-labelledby="subscription-history-title" class="mt-5">
          <h2 id="subscription-history-title" class="vt-cap mb-2 px-1 text-vt-mute-2">История</h2>
          <ul class="space-y-2">
            <li v-for="s in history" :key="s.id" class="vt-card p-3.5 grayscale">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-display truncate text-base font-semibold">{{ s.plan.name }}</div>
                  <div class="mt-0.5 text-xs text-vt-mute-2">
                    {{ subscriptionPeriodLabel(s, tz) }}
                  </div>
                </div>
                <VtChip :tone="s.status === 'cancelled' ? 'rose' : 'default'" dot>
                  {{ subscriptionHistoryLabel(s) }}
                </VtChip>
              </div>
              <div class="mt-2.5 flex items-center gap-1.5" aria-hidden="true">
                <span
                  v-for="session in s.totalSessions"
                  :key="session"
                  class="h-1.5 flex-1 rounded-full bg-vt-stroke-2"
                />
              </div>
            </li>
          </ul>
        </section>

        <p v-if="!availability.allowPurchase" class="vt-card mt-5 p-4 text-sm text-vt-mute-2">
          Абонементы в этой группе сейчас недоступны для покупки и новых записей. Ваш остаток и
          история сохраняются.
        </p>
        <NuxtLink
          v-else
          :to="`${base}/subscriptions/buy`"
          class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full mt-4 !justify-between"
        >
          <span>Купить новый абонемент</span>
          <VtIcon name="arrow-r" :size="16" />
        </NuxtLink>

        <section v-if="debits.length" aria-labelledby="subscription-usage-title" class="mt-5">
          <h2 id="subscription-usage-title" class="vt-cap mb-2 px-1 text-vt-mute-2">
            Последние списания
          </h2>
          <ul class="vt-card divide-y divide-vt-stroke overflow-hidden">
            <li
              v-for="u in debits"
              :key="u.bookingId"
              class="flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div class="min-w-0">
                <div class="truncate text-[15px] font-medium">{{ u.eventTitle }}</div>
                <div class="mt-0.5 text-xs text-vt-mute-2">
                  {{ formatDay(u.startsAt, tz)
                  }}<template v-if="u.status === 'no_show'"> · не пришёл</template>
                </div>
              </div>
              <span class="vt-mono text-sm font-semibold">−1</span>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
