<script setup lang="ts">
import type { Subscription, SubscriptionPlan } from '@volley-time/db'
import { formatDay, formatShortDate } from '@volley-time/shared'
import { formatPrice } from '~/utils/labels'
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

const subs = ref<MySub[]>([])
const plans = ref<SubscriptionPlan[]>([])
const loading = ref(false)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [s, p] = await Promise.all([
      $fetch<{ subscriptions: MySub[] }>(`/api/organizations/${orgId.value}/subscriptions/my`),
      $fetch<{ plans: SubscriptionPlan[] }>(`/api/organizations/${orgId.value}/plans`),
    ])
    subs.value = s.subscriptions
    plans.value = p.plans
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить абонементы')
  } finally {
    loading.value = false
  }
}
await load()

const STATUS: Record<string, { tone: 'grass' | 'amber' | 'default' | 'rose'; text: string }> = {
  active: { tone: 'grass', text: 'Активен' },
  pending: { tone: 'amber', text: 'Ждёт подтверждения оплаты' },
  exhausted: { tone: 'default', text: 'Использован' },
  expired: { tone: 'default', text: 'Истёк' },
  cancelled: { tone: 'rose', text: 'Отменён' },
}
const isExpired = (s: MySub) =>
  s.status === 'active' && !!s.expiresAt && new Date(s.expiresAt) < new Date()
const current = computed(() =>
  subs.value.filter((s) => (s.status === 'active' && !isExpired(s)) || s.status === 'pending'),
)
const history = computed(() => subs.value.filter((s) => !current.value.includes(s)))
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
async function buy(method: 'cash' | 'transfer') {
  if (!buyPlan.value) return
  buying.value = true
  buyError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/subscriptions`, {
      method: 'POST',
      body: { planId: buyPlan.value.id, method },
    })
    haptic('success')
    buyPlan.value = null
    await load()
  } catch (e) {
    haptic('error')
    buyError.value = apiErrorMessage(e, 'Не удалось оформить абонемент')
  } finally {
    buying.value = false
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Абонементы" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4 space-y-5">
      <SkeletonList v-if="loading" :count="2" />
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <template v-else>
        <section>
          <h2 class="vt-cap mb-2">Мои абонементы</h2>
          <EmptyState
            v-if="current.length === 0"
            icon="ticket"
            title="Активных абонементов нет"
            description="Выберите план ниже"
          />
          <ul v-else class="space-y-2.5">
            <li v-for="s in current" :key="s.id" class="vt-card p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ s.plan.name }}</span>
                <VtChip :tone="STATUS[s.status]?.tone ?? 'default'" dot>{{
                  STATUS[s.status]?.text
                }}</VtChip>
              </div>
              <template v-if="s.status === 'active'">
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
              </template>
              <p v-else-if="s.pendingPayment" class="text-sm text-vt-mute-2 mt-2">
                Оплатите {{ formatPrice(s.pendingPayment.amount, s.pendingPayment.currency) }}
                {{ s.pendingPayment.method === 'transfer' ? 'переводом' : 'наличными' }}
                организатору — абонемент активируется после подтверждения.
              </p>
              <button
                v-if="s.usage.length"
                type="button"
                class="text-xs font-semibold text-vt-link mt-2"
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

        <section>
          <h2 class="vt-cap mb-2">Купить абонемент</h2>
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

        <section v-if="history.length">
          <h2 class="vt-cap mb-2">История</h2>
          <ul class="space-y-2">
            <li
              v-for="s in history"
              :key="s.id"
              class="vt-card p-3 flex items-center gap-2 text-sm"
            >
              <span class="flex-1 truncate">{{ s.plan.name }}</span>
              <span class="text-xs text-vt-mute-2">{{ s.usedSessions }}/{{ s.totalSessions }}</span>
              <VtChip :tone="isExpired(s) ? 'default' : (STATUS[s.status]?.tone ?? 'default')">
                {{ isExpired(s) ? 'Истёк' : STATUS[s.status]?.text }}
              </VtChip>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <VtSheet
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
