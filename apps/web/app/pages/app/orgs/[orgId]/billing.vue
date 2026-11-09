<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { DEFAULT_TIMEZONE } from '@volley-time/shared'

import { pluralEvents } from '~/utils/cabinet-shell'
import {
  balanceSubtitle,
  entryDate,
  entryView,
  lowBalanceWarning,
  packageViews,
  type BalanceEntry,
  type BalanceSummary,
} from '~/utils/event-balance-billing'
import { formatMoneyRu } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
// организация и роль уже загружены layout `desktop-org` под тем же ключом
const { data: orgData } = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-org-${orgId.value}` })
const tz = computed(() => orgData.value?.organization.defaultTimezone ?? DEFAULT_TIMEZONE)
// покупает только владелец группы (POST /purchase-requests — owner only)
const isOwner = computed(
  () => orgData.value?.myMember?.role === 'owner' && orgData.value.myMember.status === 'active',
)

const summary = ref<BalanceSummary | null>(null)
const entries = ref<BalanceEntry[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadError = ref('')
const moreLoading = ref(false)
const moreError = ref('')
const confirming = ref<string | null>(null)
const busy = ref(false)
const purchaseError = ref('')
const purchaseNotice = ref('')
let generation = 0
let alive = true

const views = computed(() => packageViews(summary.value?.packages ?? []))
const warning = computed(() => lowBalanceWarning(summary.value))
const rows = computed(() => entries.value.map(entryView))
const pending = computed(() => summary.value?.pendingRequests ?? [])
const confirmingView = computed(() => views.value.find((v) => v.code === confirming.value) ?? null)

async function load() {
  const token = ++generation
  const targetOrgId = orgId.value
  loading.value = true
  loadError.value = ''
  moreError.value = ''
  summary.value = null
  entries.value = []
  nextCursor.value = null
  confirming.value = null
  purchaseNotice.value = ''
  purchaseError.value = ''
  try {
    const [balance, history] = await Promise.all([
      $fetch<{ eventBalance: BalanceSummary }>(`/api/organizations/${targetOrgId}/event-balance`),
      $fetch<{ entries: BalanceEntry[]; nextCursor: string | null }>(
        `/api/organizations/${targetOrgId}/event-balance/entries`,
      ),
    ])
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    summary.value = balance.eventBalance
    entries.value = history.entries
    nextCursor.value = history.nextCursor
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить баланс событий')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

async function loadMore() {
  const cursor = nextCursor.value
  if (!cursor || moreLoading.value) return
  const token = generation
  const targetOrgId = orgId.value
  moreLoading.value = true
  moreError.value = ''
  try {
    const page = await $fetch<{ entries: BalanceEntry[]; nextCursor: string | null }>(
      `/api/organizations/${targetOrgId}/event-balance/entries`,
      { query: { cursor } },
    )
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    entries.value = [...entries.value, ...page.entries]
    nextCursor.value = page.nextCursor
  } catch (cause) {
    if (alive && token === generation) {
      moreError.value = apiErrorMessage(cause, 'Не удалось загрузить историю')
    }
  } finally {
    moreLoading.value = false
  }
}

async function refreshSummary(targetOrgId: number, token: number) {
  try {
    const balance = await $fetch<{ eventBalance: BalanceSummary }>(
      `/api/organizations/${targetOrgId}/event-balance`,
    )
    if (alive && token === generation && orgId.value === targetOrgId) {
      summary.value = balance.eventBalance
    }
  } catch {
    // заявка уже создана; список ожидающих обновится при следующей загрузке
  }
}

function askConfirm(code: string) {
  if (!isOwner.value || busy.value) return
  purchaseError.value = ''
  purchaseNotice.value = ''
  confirming.value = code
}

async function confirmPurchase() {
  const view = confirmingView.value
  if (!view || !isOwner.value || busy.value) return
  const token = generation
  const targetOrgId = orgId.value
  busy.value = true
  purchaseError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/event-balance/purchase-requests`, {
      method: 'POST',
      body: { packageCode: view.code },
    })
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    confirming.value = null
    purchaseNotice.value = `Заявка создана · +${view.units} ${view.unitsCaption} будут зачислены после подтверждения`
    await refreshSummary(targetOrgId, token)
  } catch (cause) {
    if (alive && token === generation) {
      purchaseError.value = apiErrorMessage(cause, 'Не удалось создать заявку')
    }
  } finally {
    busy.value = false
  }
}

watch(orgId, () => void load(), { immediate: true })
onBeforeUnmount(() => {
  alive = false
  generation++
})
</script>

<template>
  <section class="vt-desktop-billing space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Платформа</p>
        <h1 tabindex="-1">Баланс и оплата</h1>
        <p class="text-vt-mute-2">{{ balanceSubtitle(summary?.balance ?? null) }}</p>
      </div>
    </header>

    <ErrorState v-if="loadError" :message="loadError" @retry="load" />
    <SkeletonList v-else-if="loading || !summary" :count="3" />
    <div v-else class="vt-desktop-billing__grid">
      <div class="vt-desktop-billing__side">
        <section
          class="vt-card vt-card--hero vt-desktop-billing__hero"
          aria-labelledby="billing-balance"
        >
          <p id="billing-balance" class="vt-cap">Баланс событий</p>
          <p class="vt-mono vt-desktop-billing__value" data-testid="billing-balance">
            {{ summary.balance }}
          </p>
          <p class="vt-desktop-billing__hint">
            1 событие = 1 опубликованное событие. Возврат при отмене до открытия записи.
          </p>
        </section>

        <p v-if="warning" class="vt-card vt-desktop-billing__warning" role="status">
          {{ warning }}
        </p>

        <section v-if="pending.length" class="vt-card vt-desktop-billing__pending">
          <h2>Заявки в ожидании</h2>
          <ul>
            <li v-for="request in pending" :key="request.id">
              <span class="vt-mono">+{{ request.units }} {{ pluralEvents(request.units) }}</span>
              <span class="text-vt-mute-2">{{
                formatMoneyRu(request.amount, request.currency)
              }}</span>
              <span class="text-vt-mute-2">{{ entryDate(request.createdAt, tz) }}</span>
            </li>
          </ul>
          <p class="text-vt-mute-2 text-xs">
            Баланс пополнится после подтверждения заявки платформой.
          </p>
        </section>
      </div>

      <section class="vt-card vt-desktop-billing__packages" aria-labelledby="billing-packages">
        <h2 id="billing-packages">Пакеты событий</h2>
        <p class="text-vt-mute-2 text-sm">
          Чем больше пакет, тем дешевле каждое событие. Без подписки, без обязательств.
        </p>

        <p v-if="purchaseNotice" class="vt-desktop-billing__notice" role="status">
          {{ purchaseNotice }}
        </p>
        <p v-if="purchaseError" class="text-vt-rose-ink" role="alert">{{ purchaseError }}</p>

        <ul class="vt-desktop-billing__cards">
          <li
            v-for="pkg in views"
            :key="pkg.code"
            class="vt-card vt-desktop-billing__package"
            :class="{ 'vt-desktop-billing__package--popular': pkg.popular }"
            :data-testid="`package-${pkg.code}`"
          >
            <span v-if="pkg.badge" class="vt-chip vt-chip--solid vt-desktop-billing__badge">{{
              pkg.badge
            }}</span>
            <strong class="vt-desktop-billing__units">{{ pkg.units }}</strong>
            <p class="text-vt-mute-2 text-xs">{{ pkg.unitsCaption }}</p>
            <hr class="vt-divider" />
            <strong class="vt-mono vt-desktop-billing__price">{{ pkg.price }}</strong>
            <p class="text-vt-mute-2 text-xs">{{ pkg.perUnit }} / событие</p>
            <button
              v-if="isOwner"
              type="button"
              class="vt-btn vt-btn--ink vt-btn--sm vt-desktop-billing__buy"
              :disabled="busy"
              @click="askConfirm(pkg.code)"
            >
              Купить
            </button>
          </li>
        </ul>

        <div
          v-if="isOwner && confirmingView"
          class="vt-card vt-desktop-billing__confirm"
          role="group"
          aria-labelledby="billing-confirm-title"
        >
          <h3 id="billing-confirm-title">
            Купить «{{ confirmingView.units }} {{ confirmingView.unitsCaption }}»?
          </h3>
          <p class="text-vt-mute-2 text-sm">
            К оплате {{ confirmingView.price }}. Онлайн-оплаты пока нет: оплата наличными или
            переводом, события зачислятся после подтверждения заявки.
          </p>
          <div class="vt-desktop-billing__actions">
            <button
              type="button"
              class="vt-btn vt-btn--ghost"
              :disabled="busy"
              @click="confirming = null"
            >
              Отмена
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--primary"
              :disabled="busy"
              @click="confirmPurchase"
            >
              {{ busy ? 'Отправляем…' : 'Подтвердить покупку' }}
            </button>
          </div>
        </div>
        <p v-else-if="!isOwner" class="vt-card p-3 text-sm text-vt-mute-2" role="note">
          Покупать пакеты может владелец группы.
        </p>

        <h2 class="vt-desktop-billing__history-title">История</h2>
        <p v-if="rows.length === 0" class="vt-card p-4 text-vt-mute-2" role="status">
          Операций пока нет.
        </p>
        <ul v-else class="vt-card vt-desktop-billing__history">
          <li v-for="row in rows" :key="row.id" data-testid="balance-entry">
            <span class="vt-mono vt-desktop-billing__date">{{ entryDate(row.createdAt, tz) }}</span>
            <span class="vt-desktop-billing__what">
              {{ row.title }}
              <small v-if="row.note" class="text-vt-mute-2">{{ row.note }}</small>
            </span>
            <span class="vt-chip">{{ row.chip }}</span>
            <span
              class="vt-mono vt-desktop-billing__delta"
              :class="{ 'vt-desktop-billing__delta--plus': row.positive }"
              >{{ row.delta }}</span
            >
          </li>
        </ul>
        <p v-if="moreError" class="text-vt-rose-ink" role="alert">{{ moreError }}</p>
        <button
          v-if="nextCursor"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="moreLoading"
          @click="loadMore"
        >
          {{ moreLoading ? 'Загружаем…' : 'Показать ещё' }}
        </button>
      </section>
    </div>
  </section>
</template>
