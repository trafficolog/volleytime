<script setup lang="ts">
import type { Payment } from '@volley-time/db'
import { formatDay } from '@volley-time/shared'

import { desktopSignInPath } from '~/utils/desktop-org-ui'
import {
  canSubmitDesktopPaymentAction,
  historyCursorForStatusChange,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentTargetLabel,
  shouldReloadPaymentsAfterError,
} from '~/utils/desktop-payments'
import { displayName, formatPrice } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

interface PaymentRow {
  id: number
  status: Payment['status']
  amount: number
  currency: string
  method: Payment['method']
  createdAt: string
  confirmedAt?: string | null
  refundedAt?: string | null
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  event: { id: number; title: string; startsAt: string } | null
  plan: { name: string } | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const request = useRequestFetch()
const pendingItems = ref<PaymentRow[]>([])
const historyItems = ref<PaymentRow[]>([])
const status = ref<Payment['status'] | 'all'>('all')
const nextCursor = ref<string | null>(null)
const pendingLoading = ref(false)
const historyLoading = ref(false)
const pendingError = ref('')
const historyError = ref('')
const accessStatus = ref<number | undefined>()
const actionError = ref('')
const announcement = ref('')
const busy = ref<number | null>(null)
let active = true
let generation = 0
let pendingRequest = 0
let historyRequest = 0

function live(org: number, path: string, epoch: number) {
  return active && generation === epoch && orgId.value === org && route.path === path
}

function errorMessage(error: unknown, fallback: string) {
  const code = apiErrorStatus(error)
  if (code === 401 || code === 403 || code === 404) accessStatus.value = code
  return code === 401
    ? 'Нужно войти, чтобы открыть оплаты.'
    : code === 403 || code === 404
      ? 'Нет доступа к оплатам этой группы.'
      : apiErrorMessage(error, fallback)
}

async function loadPending() {
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    token = ++pendingRequest
  pendingLoading.value = true
  pendingError.value = ''
  try {
    const result = await request<{ payments: PaymentRow[] }>(`/api/organizations/${org}/payments`)
    if (live(org, path, epoch) && token === pendingRequest) pendingItems.value = result.payments
  } catch (error) {
    if (live(org, path, epoch) && token === pendingRequest)
      pendingError.value = errorMessage(
        error,
        'Не удалось загрузить ожидающие оплаты. Повторите попытку.',
      )
  } finally {
    if (live(org, path, epoch) && token === pendingRequest) pendingLoading.value = false
  }
}

async function loadHistory(more = false) {
  if (more && (historyLoading.value || !nextCursor.value)) return
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    token = ++historyRequest
  const cursor = more ? nextCursor.value : null
  if (!more) {
    nextCursor.value = null
    historyItems.value = []
  }
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await request<{ payments: PaymentRow[]; nextCursor: string | null }>(
      `/api/organizations/${org}/payments/history`,
      {
        query: {
          limit: 50,
          ...(status.value !== 'all' ? { status: status.value } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    )
    if (live(org, path, epoch) && token === historyRequest) {
      historyItems.value = more ? [...historyItems.value, ...result.payments] : result.payments
      nextCursor.value = result.nextCursor
    }
  } catch (error) {
    if (live(org, path, epoch) && token === historyRequest)
      historyError.value = errorMessage(
        error,
        'Не удалось загрузить историю оплат. Повторите попытку.',
      )
  } finally {
    if (live(org, path, epoch) && token === historyRequest) historyLoading.value = false
  }
}

async function reload() {
  await Promise.all([loadPending(), loadHistory()])
}

async function act(payment: PaymentRow, action: 'confirm' | 'reject') {
  const org = orgId.value,
    path = route.path,
    epoch = generation
  if (
    !active ||
    !canSubmitDesktopPaymentAction(
      route.path,
      `/app/orgs/${org}/payments`,
      org,
      orgId.value,
      busy.value !== null,
    ) ||
    pendingLoading.value
  )
    return
  busy.value = payment.id
  actionError.value = ''
  announcement.value = ''
  try {
    if (action === 'reject') {
      const consequence = payment.event
        ? 'Запись будет отменена, место может перейти следующему в листе ожидания.'
        : payment.plan
          ? 'Абонемент не будет активирован.'
          : 'Платёж будет отменён.'
      if (!window.confirm(`Отклонить оплату ${displayName(payment.user)}? ${consequence}`)) return
    }
    if (!live(org, path, epoch)) return
    await request(`/api/organizations/${org}/payments/${payment.id}/${action}`, { method: 'POST' })
    if (!live(org, path, epoch)) return
    announcement.value = action === 'confirm' ? 'Оплата подтверждена.' : 'Оплата отклонена.'
    await reload()
  } catch (error) {
    if (!live(org, path, epoch)) return
    const conflict = shouldReloadPaymentsAfterError(apiErrorCode(error) ?? null)
    actionError.value = conflict
      ? 'Платёж уже обработан. Списки обновлены.'
      : errorMessage(error, 'Не удалось обработать оплату. Повторите попытку.')
    if (conflict) await reload()
  } finally {
    if (live(org, path, epoch)) busy.value = null
  }
}

watch(status, (next, previous) => {
  nextCursor.value = historyCursorForStatusChange(previous, next, nextCursor.value)
  void loadHistory()
})
watch(
  () => route.path,
  () => {
    generation++
    pendingItems.value = []
    historyItems.value = []
    nextCursor.value = null
    pendingError.value = ''
    historyError.value = ''
    actionError.value = ''
    announcement.value = ''
    accessStatus.value = undefined
    busy.value = null
    if (status.value !== 'all') status.value = 'all'
    if (route.path === `/app/orgs/${orgId.value}/payments`) void reload()
  },
)
onBeforeUnmount(() => {
  active = false
  generation++
})
await reload()
</script>

<template>
  <div class="vt-desktop-payments space-y-6">
    <header class="vt-desktop-page-heading">
      <div>
        <p class="vt-desktop-eyebrow">Финансы группы</p>
        <h1 tabindex="-1">Оплаты</h1>
        <p class="text-sm text-vt-mute">Подтверждение оплат и история платежей</p>
      </div>
      <NuxtLink :to="`/app/orgs/${orgId}/cashbox`" class="vt-btn vt-btn--ghost"
        ><VtIcon name="wallet" :size="16" /> Открыть кассу</NuxtLink
      >
    </header>
    <p role="status" class="text-sm">{{ announcement }}</p>
    <p v-if="actionError" role="alert" class="text-sm text-vt-rose-ink">{{ actionError }}</p>
    <section v-if="accessStatus" class="vt-card p-6 space-y-3" role="alert">
      <h2>{{ accessStatus === 401 ? 'Нужно войти' : 'Нет доступа к оплатам' }}</h2>
      <NuxtLink
        v-if="accessStatus === 401"
        :to="desktopSignInPath(route.fullPath)"
        class="vt-btn vt-btn--primary"
        >Войти по email</NuxtLink
      >
      <NuxtLink v-else to="/app?choose=1" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
    </section>
    <template v-else>
      <section
        class="space-y-4"
        aria-labelledby="pending-payments-heading"
        :aria-busy="pendingLoading"
      >
        <div class="vt-desktop-section-heading">
          <h2 id="pending-payments-heading">Ожидают подтверждения</h2>
          <VtChip tone="amber">{{ pendingItems.length }}</VtChip>
        </div>
        <p v-if="pendingLoading" role="status">Загружаем ожидающие оплаты…</p>
        <ErrorState v-else-if="pendingError" :message="pendingError" @retry="loadPending" />
        <EmptyState
          v-else-if="!pendingItems.length"
          icon="check"
          title="Нет ожидающих оплат"
          description="Новые заявки на оплату появятся здесь. История доступна ниже."
        />
        <ul v-else class="vt-desktop-payment-list">
          <li
            v-for="payment in pendingItems"
            :key="payment.id"
            class="vt-card vt-desktop-payment-row"
          >
            <VtAvatar :name="displayName(payment.user)" :src="payment.user.image" />
            <div class="vt-desktop-payment-context">
              <h3>{{ displayName(payment.user) }}</h3>
              <p>{{ paymentTargetLabel(payment) }}</p>
              <p v-if="payment.event" class="text-xs text-vt-mute">
                {{ formatDay(payment.event.startsAt, tz) }}
              </p>
            </div>
            <div class="vt-desktop-payment-amount">
              <strong class="vt-mono">{{ formatPrice(payment.amount, payment.currency) }}</strong>
              <p class="text-xs text-vt-mute">
                {{ paymentMethodLabel(payment.method) }} · {{ formatDay(payment.createdAt, tz) }}
              </p>
            </div>
            <div class="vt-desktop-payment-actions">
              <button
                type="button"
                class="vt-btn vt-btn--ghost"
                :disabled="busy !== null"
                :aria-label="`Отклонить оплату ${displayName(payment.user)}`"
                @click="act(payment, 'reject')"
              >
                Отклонить</button
              ><button
                type="button"
                class="vt-btn vt-btn--primary"
                :disabled="busy !== null"
                :aria-label="`Подтвердить оплату ${displayName(payment.user)}`"
                @click="act(payment, 'confirm')"
              >
                <VtIcon name="check" :size="14" /> Подтвердить
              </button>
            </div>
          </li>
        </ul>
      </section>
      <section
        class="space-y-4"
        aria-labelledby="payment-history-heading"
        :aria-busy="historyLoading"
      >
        <div class="vt-desktop-section-heading">
          <h2 id="payment-history-heading">История оплат</h2>
          <label class="vt-desktop-payment-filter"
            >Статус<select v-model="status" class="vt-input">
              <option value="all">Все статусы</option>
              <option
                v-for="value in ['pending', 'succeeded', 'cancelled', 'refunded'] as const"
                :key="value"
                :value="value"
              >
                {{ paymentStatusLabel(value) }}
              </option>
            </select></label
          >
        </div>
        <p v-if="historyLoading && !historyItems.length" role="status">Загружаем историю оплат…</p>
        <ErrorState
          v-if="historyError"
          :message="historyError"
          @retry="loadHistory(historyItems.length > 0)"
        />
        <EmptyState
          v-else-if="!historyLoading && !historyItems.length"
          icon="card"
          title="Платежей пока нет"
          :description="
            status === 'all'
              ? 'История появится после первой заявки на оплату.'
              : 'Платежей с этим статусом нет. Выберите другой статус.'
          "
        />
        <ul v-if="historyItems.length" class="vt-desktop-payment-list">
          <li
            v-for="payment in historyItems"
            :key="payment.id"
            class="vt-card vt-desktop-payment-row"
          >
            <VtAvatar :name="displayName(payment.user)" :src="payment.user.image" />
            <div class="vt-desktop-payment-context">
              <h3>{{ displayName(payment.user) }}</h3>
              <p>{{ paymentTargetLabel(payment) }}</p>
              <p class="text-xs text-vt-mute">
                Создан {{ formatDay(payment.createdAt, tz)
                }}<template v-if="payment.confirmedAt">
                  · Подтверждён {{ formatDay(payment.confirmedAt, tz) }}</template
                ><template v-if="payment.refundedAt">
                  · Возвращён {{ formatDay(payment.refundedAt, tz) }}</template
                >
              </p>
            </div>
            <div class="vt-desktop-payment-amount">
              <strong class="vt-mono">{{ formatPrice(payment.amount, payment.currency) }}</strong>
              <p class="text-xs text-vt-mute">{{ paymentMethodLabel(payment.method) }}</p>
            </div>
            <VtChip
              :tone="
                payment.status === 'pending'
                  ? 'amber'
                  : payment.status === 'succeeded'
                    ? 'grass'
                    : 'default'
              "
              >{{ paymentStatusLabel(payment.status) }}</VtChip
            >
          </li>
        </ul>
        <button
          v-if="nextCursor"
          type="button"
          class="vt-btn vt-btn--ghost"
          :disabled="historyLoading"
          @click="loadHistory(true)"
        >
          {{ historyLoading ? 'Загружаем…' : 'Показать ещё' }}
        </button>
      </section>
    </template>
  </div>
</template>
