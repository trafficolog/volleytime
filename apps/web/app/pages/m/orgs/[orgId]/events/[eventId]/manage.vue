<script setup lang="ts">
import type { EventBookingRow } from '@volley-time/core'
import type { Event } from '@volley-time/db'
import {
  formatDay,
  formatTime,
  type EventPricingView,
  type PricingFinancials,
  type PricingPermissions,
} from '@volley-time/shared'

import { displayName, formatPrice, formatMoneyRu } from '~/utils/labels'
import { pendingPaymentsForEvent } from '~/utils/organizer-miniapp'
import { pendingOf, pendingVerb, waitlistCaption } from '~/utils/status-model'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface PendingPayment {
  id: number
  amount: number
  currency: string
  method: 'cash' | 'transfer' | 'online'
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  event: { id: number; title: string; startsAt: string } | null
}

const route = useRoute()
const router = useRouter()
const mountedPath = route.fullPath
let pageActive = true
onUnmounted(() => {
  pageActive = false
})
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const { tz } = useOrgTimezone(orgId)
const { confirm, haptic } = useTelegram()
const routeKey = computed(() => `${orgId.value}:${eventId.value}`)
function routeStillCurrent(key: string): boolean {
  const params = router.currentRoute.value.params
  return (
    pageActive &&
    router.currentRoute.value.fullPath === mountedPath &&
    key === routeKey.value &&
    key === `${Number(params.orgId)}:${Number(params.eventId)}`
  )
}
const {
  data: orgData,
  error: orgError,
  status: orgStatus,
} = await useFetch<{
  organization: { id: number }
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `event-manage-org-${orgId.value}` })
const isManager = computed(() => {
  const member = orgData.value?.myMember
  return (
    !orgError.value &&
    orgData.value?.organization.id === orgId.value &&
    member?.status === 'active' &&
    ['owner', 'organizer'].includes(member.role)
  )
})

const {
  data: evData,
  error: eventError,
  status: eventStatus,
  refresh: refreshEvent,
} = await useFetch<{
  event: Event & {
    taken: number
    waitlist: number
    waitlistSeats?: number
    pricing: EventPricingView
    pricingPermissions?: PricingPermissions
    pricingFinancials?: PricingFinancials
  }
}>(() => `/api/organizations/${orgId.value}/events/${eventId.value}`, {
  key: () => `event-manage-${routeKey.value}`,
})
const ev = computed(() => {
  const event = evData.value?.event
  return event?.id === eventId.value && event.organizationId === orgId.value ? event : null
})
const rows = ref<EventBookingRow[]>([])
const payments = ref<PendingPayment[]>([])
const rosterLoading = ref(false)
const paymentsLoading = ref(false)
const rosterError = ref('')
const paymentsError = ref('')
const actionError = ref('')
const busy = ref(false)
let settlementOperation = 0
const paymentBusy = ref<number | null>(null)
const mutationBusy = computed(() => busy.value || paymentBusy.value !== null)
type Tab = 'roster' | 'payments' | 'share'
const TABS: { id: Tab; label: string }[] = [
  { id: 'roster', label: 'Состав' },
  { id: 'payments', label: 'Платежи' },
  { id: 'share', label: 'Шеринг' },
]
const activeTab = ref<Tab>('roster')
const tabEls: Partial<Record<Tab, HTMLButtonElement | null>> = {}
const tabPrefix = computed(() => `event-${orgId.value}-${eventId.value}`)
const eventPayments = computed(() => pendingPaymentsForEvent(payments.value, eventId.value))
let rosterRequest = 0
let paymentsRequest = 0

async function loadRoster() {
  const key = routeKey.value
  const request = ++rosterRequest
  rosterLoading.value = true
  rosterError.value = ''
  rows.value = []
  try {
    const result = (
      await $fetch<{ bookings: EventBookingRow[] }>(
        `/api/organizations/${orgId.value}/events/${eventId.value}/bookings`,
      )
    ).bookings
    if (key === routeKey.value && request === rosterRequest) rows.value = result
  } catch (e) {
    if (key === routeKey.value && request === rosterRequest)
      rosterError.value = apiErrorMessage(e, 'Не удалось загрузить состав')
  } finally {
    if (key === routeKey.value && request === rosterRequest) rosterLoading.value = false
  }
}

async function loadPayments() {
  const key = routeKey.value
  const request = ++paymentsRequest
  paymentsLoading.value = true
  paymentsError.value = ''
  payments.value = []
  try {
    const result = await $fetch<{ payments: PendingPayment[] }>(
      `/api/organizations/${orgId.value}/payments`,
    )
    if (key === routeKey.value && request === paymentsRequest) payments.value = result.payments
  } catch (e) {
    if (key === routeKey.value && request === paymentsRequest)
      paymentsError.value = apiErrorMessage(e, 'Не удалось загрузить оплаты')
  } finally {
    if (key === routeKey.value && request === paymentsRequest) paymentsLoading.value = false
  }
}

await Promise.all([loadRoster(), loadPayments()])
watch(routeKey, () => {
  activeTab.value = 'roster'
  actionError.value = ''
  paymentBusy.value = null
  void Promise.all([loadRoster(), loadPayments()])
})

async function switchTab(tab: Tab, focus = false) {
  activeTab.value = tab
  if (focus) {
    await nextTick()
    tabEls[tab]?.focus()
  }
}

function onTabKeydown(event: KeyboardEvent) {
  const index = TABS.findIndex((tab) => tab.id === activeTab.value)
  const last = TABS.length - 1
  const next =
    event.key === 'ArrowLeft'
      ? Math.max(0, index - 1)
      : event.key === 'ArrowRight'
        ? Math.min(last, index + 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (next === null) return
  event.preventDefault()
  void switchTab(TABS[next]!.id, true)
}

const inRoster = computed(() =>
  rows.value.filter((b) =>
    ['confirmed', 'pending_payment', 'attended', 'no_show'].includes(b.status),
  ),
)
const waitlist = computed(() => rows.value.filter((b) => b.status === 'waitlisted'))
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= new Date())
// «ждут оплаты» в составе считается по записям состава (`pendingOf`), как строка «ждёт оплаты» в нём
const rosterPending = computed(() => pendingOf(inRoster.value))

// Шеринг: публичная страница события `/e/<slug>` (20.6.1)
// origin берём из окна: Mini App открыт на том же хосте, что и публичная страница события
const shareUrl = computed(() =>
  ev.value?.publicSlug ? `${window.location.origin}/e/${ev.value.publicSlug}` : '',
)
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
async function copyShareLink() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copyState.value = 'copied'
    haptic('light')
  } catch {
    copyState.value = 'failed'
  }
}

async function settlePricing() {
  const target = ev.value
  const key = routeKey.value
  if (
    !isManager.value ||
    !target?.pricingPermissions?.canSettle ||
    mutationBusy.value ||
    !routeStillCurrent(key)
  )
    return
  const operation = ++settlementOperation
  busy.value = true
  actionError.value = ''
  try {
    const count = target.taken
    const ok = await confirm(
      `Закрыть запись и распределить ${formatMoneyRu(target.pricing.targetAmount ?? 0, target.currency)} между ${count} участниками? Доли будут зафиксированы; лист ожидания не участвует. Состав и суммы окончательно проверит сервер.`,
    )
    if (!ok || !routeStillCurrent(key) || !ev.value?.pricingPermissions?.canSettle) return
    await $fetch(`/api/organizations/${target.organizationId}/events/${target.id}/settle`, {
      method: 'POST',
    })
    if (routeStillCurrent(key)) await Promise.all([refreshEvent(), loadRoster(), loadPayments()])
  } catch (cause) {
    if (routeStillCurrent(key))
      actionError.value = apiErrorMessage(
        cause,
        'Не удалось распределить сумму. Обновите событие и попробуйте снова.',
      )
  } finally {
    if (pageActive && operation === settlementOperation) busy.value = false
  }
}

async function mark(b: EventBookingRow, attended: boolean) {
  if (!isManager.value || !ev.value || rosterError.value || mutationBusy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}/attendance`, {
      method: 'POST',
      body: { marks: [{ bookingId: b.id, attended }] },
    })
    haptic('light')
    await loadRoster()
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось отметить')
  } finally {
    busy.value = false
  }
}

async function removeBooking(b: EventBookingRow) {
  if (!isManager.value || !ev.value || rosterError.value || mutationBusy.value) return
  const key = routeKey.value
  busy.value = true
  actionError.value = ''
  try {
    if (!(await confirm(`Снять ${displayName(b.user)} с события?`)) || !routeStillCurrent(key))
      return
    await $fetch(`/api/organizations/${orgId.value}/bookings/${b.id}/cancel`, { method: 'POST' })
    if (routeStillCurrent(key)) await Promise.all([loadRoster(), refreshEvent()])
  } catch (e) {
    if (routeStillCurrent(key)) actionError.value = apiErrorMessage(e, 'Не удалось снять запись')
  } finally {
    busy.value = false
  }
}

async function cancelEvent() {
  if (!isManager.value || !ev.value || mutationBusy.value) return
  const key = routeKey.value
  busy.value = true
  actionError.value = ''
  try {
    if (
      !(await confirm(
        'Отменить событие? Все записи будут отменены, абонементы и оплаты — возвращены.',
      )) ||
      !routeStillCurrent(key)
    )
      return
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}/cancel`, {
      method: 'POST',
    })
    haptic('success')
    if (routeStillCurrent(key)) await Promise.all([loadRoster(), loadPayments(), refreshEvent()])
  } catch (e) {
    if (routeStillCurrent(key))
      actionError.value = apiErrorMessage(e, 'Не удалось отменить событие')
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (!isManager.value || !ev.value || mutationBusy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}`, {
      method: 'PATCH',
      body: { status: 'published' },
    })
    await refreshEvent()
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось опубликовать')
  } finally {
    busy.value = false
  }
}

async function actPayment(payment: PendingPayment, action: 'confirm' | 'reject') {
  if (
    !isManager.value ||
    !ev.value ||
    ev.value.status === 'cancelled' ||
    paymentsError.value ||
    mutationBusy.value
  )
    return
  const key = routeKey.value
  actionError.value = ''
  paymentBusy.value = payment.id
  try {
    if (action === 'reject') {
      const ok = await confirm(
        `Отклонить оплату ${displayName(payment.user)}? ${
          ev.value.pricing?.mode === 'split' && ev.value.pricing.settledAt
            ? 'Запись будет отменена. Лист ожидания не продвигается. Доли остальных не изменятся.'
            : 'Запись будет отменена, место перейдёт следующему в листе ожидания.'
        }`,
      )
      if (!ok || !routeStillCurrent(key)) return
    }
    await $fetch(`/api/organizations/${orgId.value}/payments/${payment.id}/${action}`, {
      method: 'POST',
    })
    haptic(action === 'confirm' ? 'success' : 'warning')
    if (routeStillCurrent(key)) await Promise.all([loadPayments(), loadRoster(), refreshEvent()])
  } catch (e) {
    if (!routeStillCurrent(key)) return
    haptic('error')
    if (apiErrorCode(e) === 'payment.not_pending') {
      await Promise.all([loadPayments(), loadRoster(), refreshEvent()])
      actionError.value = 'Платёж уже обработан — список обновлён'
    } else {
      actionError.value = apiErrorMessage(e, 'Не удалось обработать платёж')
    }
  } finally {
    if (routeStillCurrent(key) && paymentBusy.value === payment.id) paymentBusy.value = null
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader
      :title="ev?.title ?? 'Событие'"
      :sub="ev ? `${formatDay(ev.startsAt, tz)}, ${formatTime(ev.startsAt, tz)}` : undefined"
      :back="`/m/orgs/${orgId}/events/${eventId}`"
    >
      <template v-if="isManager && ev && ev.status !== 'cancelled' && !started" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/events/${eventId}/edit`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          <VtIcon name="edit" :size="14" /> Изменить
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <main v-if="orgStatus === 'pending'" class="px-4 py-4">
      <SkeletonList :count="3" />
    </main>
    <main v-else-if="!isManager" class="px-4 py-4">
      <ErrorState :message="orgError ? apiErrorMessage(orgError) : 'Нужны права организатора'" />
    </main>
    <main v-else-if="eventError" class="px-4 py-4">
      <ErrorState
        :message="apiErrorMessage(eventError, 'Не удалось загрузить событие')"
        @retry="refreshEvent"
      />
    </main>
    <main v-else-if="eventStatus === 'pending' || !ev" class="px-4 py-4">
      <SkeletonList :count="3" />
    </main>
    <main v-else class="px-4 py-4 space-y-5">
      <div class="manage-stats grid grid-cols-3 gap-2 text-center">
        <div class="vt-card p-2.5">
          <div class="flex justify-center">
            <VtSeatsMini :taken="ev.taken" :capacity="ev.capacity" :event="ev" :width="48" />
          </div>
          <div class="vt-cap !text-[10px]">мест занято</div>
        </div>
        <div class="vt-card p-2.5">
          <div class="vt-mono font-bold text-lg">
            {{ ev.waitlist }}
          </div>
          <div class="vt-cap !text-[10px]">
            {{ waitlistCaption(ev.waitlist, ev.waitlistSeats) }}
          </div>
        </div>
        <button
          type="button"
          class="vt-card p-2.5 text-center"
          data-pending-tile
          @click="switchTab('payments')"
        >
          <div
            class="vt-mono font-bold text-lg"
            :class="rosterLoading || rosterError || rosterPending === 0 ? '' : 'text-vt-amber-ink'"
          >
            {{ rosterLoading || rosterError ? '—' : rosterPending }}
          </div>
          <div class="vt-cap !text-[10px]">
            {{ pendingVerb(rosterLoading || rosterError ? 0 : rosterPending) }} оплаты
          </div>
        </button>
      </div>

      <div v-if="ev.status === 'draft'" class="manage-draft vt-card p-3.5 flex items-center gap-3">
        <VtStateChip :event="ev" />
        <span class="text-sm text-vt-mute-2 flex-1">Игроки не видят событие</span>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--sm"
          :disabled="mutationBusy"
          @click="publish"
        >
          Опубликовать
        </button>
      </div>
      <VtStateChip v-if="ev.status === 'cancelled'" :event="ev" />

      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <button
        v-if="actionError && ev.pricing?.mode === 'split'"
        class="vt-btn vt-btn--ghost"
        type="button"
        :disabled="mutationBusy"
        @click="refreshEvent()"
      >
        Обновить событие
      </button>

      <div role="tablist" aria-label="Управление событием" class="manage-tabs flex gap-1">
        <button
          v-for="tab in TABS"
          :id="`${tabPrefix}-${tab.id}-tab`"
          :key="tab.id"
          :ref="(el) => (tabEls[tab.id] = el as HTMLButtonElement | null)"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`${tabPrefix}-${tab.id}-panel`"
          :tabindex="activeTab === tab.id ? 0 : -1"
          class="manage-tab min-h-[44px] flex-1 rounded-full px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          :class="
            activeTab === tab.id
              ? 'bg-vt-ink font-semibold text-vt-paper'
              : 'font-medium text-vt-mute-2'
          "
          @click="switchTab(tab.id)"
          @keydown="onTabKeydown"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-show="activeTab === 'roster'"
        :id="`${tabPrefix}-roster-panel`"
        role="tabpanel"
        :aria-labelledby="`${tabPrefix}-roster-tab`"
        tabindex="0"
        class="space-y-5"
      >
        <ErrorState v-if="rosterError" :message="rosterError" @retry="loadRoster" />
        <SkeletonList v-else-if="rosterLoading" :count="3" />
        <template v-else>
          <section>
            <h2 class="vt-cap mb-2">Состав{{ started ? ' · отметьте посещаемость' : '' }}</h2>
            <EmptyState v-if="inRoster.length === 0" icon="users" title="Никто не записан" />
            <ul v-else class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
              <li v-for="b in inRoster" :key="b.id" class="roster-row px-3.5 py-2.5">
                <OrganizerRosterRow
                  :booking="b"
                  :pricing="{
                    priceMode: ev.pricing?.mode === 'split' ? 'split' : 'fixed',
                    free: ev.pricing?.mode !== 'split' && ev.price === 0,
                    settled: !!ev.pricing?.settledAt,
                  }"
                  :currency="ev.currency"
                >
                  <template #actions>
                    <template
                      v-if="started && ev.status !== 'cancelled' && b.status !== 'pending_payment'"
                    >
                      <button
                        type="button"
                        class="vt-btn vt-btn--sm"
                        :class="b.status === 'attended' ? 'vt-btn--grass' : 'vt-btn--ghost'"
                        :disabled="mutationBusy"
                        aria-label="Был"
                        @click="mark(b, true)"
                      >
                        <VtIcon name="check" :size="14" />
                      </button>
                      <button
                        type="button"
                        class="vt-btn vt-btn--sm"
                        :class="b.status === 'no_show' ? 'vt-btn--danger' : 'vt-btn--ghost'"
                        :disabled="mutationBusy"
                        aria-label="Не пришёл"
                        @click="mark(b, false)"
                      >
                        <VtIcon name="close" :size="14" />
                      </button>
                    </template>
                    <button
                      v-else-if="!started && ev.status !== 'cancelled'"
                      type="button"
                      class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
                      :disabled="mutationBusy"
                      aria-label="Снять с события"
                      @click="removeBooking(b)"
                    >
                      <VtIcon name="trash" :size="14" />
                    </button>
                  </template>
                </OrganizerRosterRow>
              </li>
            </ul>
          </section>

          <section v-if="waitlist.length">
            <h2 class="vt-cap mb-2">Лист ожидания</h2>
            <ol class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
              <li
                v-for="(b, i) in waitlist"
                :key="b.id"
                class="flex items-center gap-3 px-3.5 py-2"
              >
                <span class="vt-mono text-[11px] text-vt-mute w-4">{{ i + 1 }}</span>
                <VtAvatar size="sm" :name="displayName(b.user)" :src="b.user.image" />
                <span class="text-[13px] flex-1 truncate">{{ displayName(b.user) }}</span>
              </li>
            </ol>
          </section>
        </template>
        <button
          v-if="ev.status !== 'cancelled' && !started"
          type="button"
          class="vt-btn vt-btn--danger vt-btn--full"
          :disabled="mutationBusy"
          @click="cancelEvent"
        >
          Отменить событие
        </button>
      </div>

      <section
        v-show="activeTab === 'payments'"
        :id="`${tabPrefix}-payments-panel`"
        role="tabpanel"
        :aria-labelledby="`${tabPrefix}-payments-tab`"
        tabindex="0"
        class="space-y-3"
      >
        <EventPricingPanel
          v-if="ev.pricing?.mode === 'split'"
          :pricing="ev.pricing"
          :financials="ev.pricingFinancials ?? null"
          :currency="ev.currency"
          :tz="tz"
          :can-settle="ev.pricingPermissions?.canSettle === true"
          :pending="mutationBusy"
          @settle="settlePricing"
        />
        <h2 class="vt-cap">Ожидают подтверждения</h2>
        <SkeletonList v-if="paymentsLoading" :count="2" />
        <ErrorState v-else-if="paymentsError" :message="paymentsError" @retry="loadPayments" />
        <EmptyState
          v-else-if="eventPayments.length === 0"
          icon="check"
          title="Нет ожидающих оплат"
          description="Для этого события сейчас нет платежей на подтверждение"
        />
        <ul v-else class="space-y-2.5">
          <li v-for="p in eventPayments" :key="p.id" class="vt-card p-3.5">
            <div class="flex items-center gap-2.5">
              <VtAvatar :name="displayName(p.user)" :src="p.user.image" />
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-sm font-semibold truncate">{{ displayName(p.user) }}</span>
                  <span class="vt-mono font-bold">{{ formatPrice(p.amount, p.currency) }}</span>
                </div>
                <div class="text-xs text-vt-mute-2">
                  {{
                    p.method === 'cash'
                      ? 'Наличные'
                      : p.method === 'transfer'
                        ? 'Перевод'
                        : 'Онлайн'
                  }}
                </div>
              </div>
            </div>
            <div v-if="ev.status !== 'cancelled'" class="event-payment-actions flex gap-1.5 mt-3">
              <button
                type="button"
                class="vt-btn vt-btn--ghost flex-1"
                :disabled="mutationBusy"
                @click="actPayment(p, 'reject')"
              >
                Отклонить
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--primary flex-[1.6]"
                :disabled="mutationBusy"
                @click="actPayment(p, 'confirm')"
              >
                Подтвердить
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-show="activeTab === 'share'"
        :id="`${tabPrefix}-share-panel`"
        role="tabpanel"
        :aria-labelledby="`${tabPrefix}-share-tab`"
        tabindex="0"
        class="space-y-3"
      >
        <div class="vt-card space-y-3 p-4">
          <h2 class="vt-cap">Публичная ссылка</h2>
          <label class="sr-only" for="event-share-link">Публичная ссылка на событие</label>
          <input
            id="event-share-link"
            class="vt-field vt-mono text-xs"
            readonly
            :value="shareUrl"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="vt-btn vt-btn--ink vt-btn--full"
            :disabled="!shareUrl"
            @click="copyShareLink"
          >
            <VtIcon name="link" :size="14" /> Скопировать
          </button>
          <p v-if="copyState === 'copied'" class="text-sm text-vt-grass-ink" role="status">
            Ссылка скопирована
          </p>
          <p v-else-if="copyState === 'failed'" class="text-sm text-vt-rose-ink" role="alert">
            Не удалось скопировать: выделите ссылку и скопируйте вручную
          </p>
          <p v-if="ev.status === 'draft'" class="text-sm text-vt-mute-2">
            Событие — черновик: игроки увидят его по ссылке после публикации.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
@media (max-width: 200px) {
  .manage-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .manage-tabs {
    gap: 0;
  }

  .manage-tabs .manage-tab {
    min-width: 0;
    flex: 1 1 0;
    padding-inline: 0.25rem;
  }

  .manage-draft,
  .event-payment-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
