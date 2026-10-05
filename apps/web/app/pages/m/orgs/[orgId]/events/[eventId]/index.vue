<script setup lang="ts">
import type { Event, Organization, OrganizationMember, Subscription } from '@volley-time/db'
import { formatDay, formatTime, type EventPricingView } from '@volley-time/shared'

import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { displayName } from '~/utils/labels'
import {
  playerEventLoadErrorNotice,
  playerEventPageState,
  playerEventReady,
  projectPlayerEvent,
} from '~/utils/player-event'
import {
  bookingPayload,
  runPlayerEventAction,
  shouldRefreshPlayerEventAfterRejection,
} from '~/utils/player-event-action'
import { playerHomeAccess } from '~/utils/player-home'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type EventDetails = Event & {
  pricing: EventPricingView
  taken: number
  waitlist: number
  myBooking: { id: number; status: string; method: string; paymentId: number | null } | null
  venue: { name: string; address: string | null } | null
}
interface RosterItem {
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  paid: boolean
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const eventId = computed(() => Number(route.params.eventId))
const { tz } = useOrgTimezone(orgId)
const { haptic, confirm, isTelegram, useMainButton } = useTelegram()

const {
  data,
  error: loadError,
  pending: eventLoading,
  refresh,
} = await useFetch<{ event: EventDetails; roster: RosterItem[] }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
  { key: () => `player-event-${orgId.value}-${eventId.value}` },
)
const {
  data: orgData,
  error: orgError,
  pending: orgLoading,
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `player-event-org-${orgId.value}` })
const organization = computed(() =>
  orgData.value?.organization.id === orgId.value ? orgData.value.organization : null,
)
const access = computed(() =>
  playerHomeAccess(
    orgId.value,
    organization.value,
    orgData.value?.myMember ?? null,
    apiErrorCode(orgError.value),
  ),
)
const ev = computed(() =>
  data.value?.event.id === eventId.value && data.value.event.organizationId === orgId.value
    ? data.value.event
    : null,
)
const roster = computed(() => (ev.value ? (data.value?.roster ?? []) : []))
const sourceStatus = computed(() => ({
  eventMatches: !!ev.value,
  organizationMatches: !!organization.value,
  eventPending: eventLoading.value,
  organizationPending: orgLoading.value,
  eventError: !!loadError.value,
  organizationError: !!orgError.value,
}))
const sourcesReady = computed(() => playerEventReady(sourceStatus.value))
const pageState = computed(() =>
  playerEventPageState(access.value, sourceStatus.value, apiErrorCode(orgError.value)),
)
const isManager = computed(() => {
  const m = sourcesReady.value ? orgData.value?.myMember : null
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
const subscriptionsEnabled = computed(() => organization.value?.subscriptionsEnabled ?? null)

const my = computed(() => ev.value?.myBooking ?? null)
const priceLabel = computed(() =>
  ev.value ? eventPricingLabel(ev.value.pricing, ev.value.currency) : null,
)
const paymentLabel = computed(() =>
  ev.value && my.value ? splitBookingPaymentLabel(ev.value.pricing, my.value.status) : null,
)
const full = computed(() => !!ev.value && ev.value.taken >= ev.value.capacity)
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= new Date())
const subs = ref<Subscription[]>([])
const eventView = computed(() =>
  sourcesReady.value && ev.value
    ? projectPlayerEvent(
        ev.value,
        {
          memberActive: access.value === 'active',
          subscriptionsEnabled: subscriptionsEnabled.value,
          hasEligibleSubscription: subs.value.length > 0,
        },
        new Date(),
      )
    : null,
)
const bookable = computed(() => eventView.value?.action !== 'none' && !!eventView.value)
/** В Telegram действие живёт на MainButton — панель не показываем (5.14.1). */
const showActionBar = computed(() => bookable.value && !isTelegram.value)
const cancelDeadline = computed(() => {
  if (!ev.value || ev.value.cancellationDeadlineHours == null) return null
  return new Date(
    new Date(ev.value.startsAt).getTime() - ev.value.cancellationDeadlineHours * 3600_000,
  )
})
const canCancel = computed(() => eventView.value?.canCancel === true)
const noCancelExplanation = computed(() => {
  if (ev.value?.pricing.mode === 'split' && ev.value.pricing.myAllocatedAmount !== null)
    return 'Доля зафиксирована — для отмены напишите организатору.'
  if (cancelDeadline.value && new Date() > cancelDeadline.value)
    return 'Дедлайн отмены прошёл — если не сможете прийти, напишите организатору.'
  return 'Самостоятельная отмена недоступна — напишите организатору.'
})

// выбор способа
const sheetOpen = ref(false)
const submitting = ref(false)
const actionError = ref('')
const loadErrorNotice = computed(() =>
  playerEventLoadErrorNotice(apiErrorStatus(loadError.value), actionError.value),
)
const pathname = () => route.fullPath.split(/[?#]/, 1)[0]?.replace(/\/$/, '')
let currentViewKey: string | null = `${orgId.value}:${eventId.value}`
let alive = true
const confirmationGuard = createPlayerRequestGuard(() => route.fullPath)
const routeGuard = createPlayerRequestGuard(() => currentViewKey)
const optionsGuard = createPlayerRequestGuard(() => route.fullPath)

watch(sourcesReady, (ready) => {
  if (ready) return
  optionsGuard.invalidate()
  sheetOpen.value = false
})

async function retryPage() {
  await Promise.all([refresh(), refreshNuxtData(`player-event-org-${orgId.value}`)])
}

watch(
  [orgId, eventId, () => route.fullPath],
  () => {
    confirmationGuard.invalidate()
    optionsGuard.invalidate()
    sheetOpen.value = false
    subs.value = []
    const nextViewKey =
      pathname() === `/m/orgs/${orgId.value}/events/${eventId.value}`
        ? `${orgId.value}:${eventId.value}`
        : null
    if (nextViewKey === currentViewKey) return
    routeGuard.invalidate()
    currentViewKey = nextViewKey
    actionError.value = ''
    submitting.value = false
  },
  { flush: 'sync' },
)

async function openBooking() {
  if (!alive || currentViewKey === null || submitting.value || !bookable.value) return
  actionError.value = ''
  if (!ev.value) return
  if (ev.value.pricing.mode === 'fixed' && ev.value.price === 0) return doBook('free')
  if (ev.value.pricing.mode === 'split' || subscriptionsEnabled.value !== true) {
    subs.value = []
    sheetOpen.value = true
    return
  }
  const requestedOrgId = orgId.value
  const request = optionsGuard.begin()
  try {
    const res = await $fetch<{ subscriptions: Subscription[] }>(
      `/api/organizations/${requestedOrgId}/subscriptions/my`,
    )
    if (!request.isCurrent()) return
    subs.value = res.subscriptions.filter(
      (s) =>
        s.organizationId === requestedOrgId &&
        s.status === 'active' &&
        s.usedSessions < s.totalSessions &&
        (!s.expiresAt || new Date(s.expiresAt) > new Date()),
    )
  } catch {
    if (!request.isCurrent()) return
    subs.value = []
    actionError.value = 'Не удалось проверить абонементы. Можно выбрать оплату организатору.'
  }
  sheetOpen.value = true
}

async function doBook(
  method: 'free' | 'cash' | 'transfer' | 'subscription',
  subscriptionId?: number,
) {
  if (
    !alive ||
    currentViewKey === null ||
    submitting.value ||
    !eventView.value?.paymentMethods.includes(method)
  )
    return
  const requestedOrgId = orgId.value
  const requestedEventId = eventId.value
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(
        `/api/organizations/${requestedOrgId}/events/${requestedEventId}/bookings` as string,
        {
          method: 'POST',
          body: bookingPayload(method, subscriptionId),
        },
      ),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
    sheetOpen.value = false
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось записаться')
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}

// MainButton Telegram для основного действия экрана (8.8.7)
let mainButtonCleanup: (() => void) | undefined
function syncMainButton() {
  mainButtonCleanup?.()
  mainButtonCleanup = undefined
  if (!isTelegram.value || !bookable.value) return
  mainButtonCleanup = useMainButton(
    eventView.value?.action === 'waitlist' ? 'Встать в лист ожидания' : 'Записаться',
    () => {
      void openBooking()
    },
  )
}
onMounted(syncMainButton)
watch([bookable, () => eventView.value?.action], syncMainButton)
onUnmounted(() => {
  alive = false
  confirmationGuard.invalidate()
  routeGuard.invalidate()
  optionsGuard.invalidate()
  mainButtonCleanup?.()
})

async function cancelMine() {
  if (!alive || currentViewKey === null || submitting.value || !my.value || !canCancel.value) return
  const requestedOrgId = orgId.value
  const confirmation = confirmationGuard.begin()
  const bookingId = my.value.id
  if (!(await confirm('Отменить запись на тренировку?'))) return
  if (
    !alive ||
    !confirmation.isCurrent() ||
    submitting.value ||
    !canCancel.value ||
    requestedOrgId !== orgId.value ||
    bookingId !== my.value?.id
  )
    return
  const request = routeGuard.begin()
  submitting.value = true
  actionError.value = ''
  const outcome = await runPlayerEventAction(
    () =>
      $fetch<void>(`/api/organizations/${requestedOrgId}/bookings/${bookingId}/cancel` as string, {
        method: 'POST',
      }),
    request.isCurrent,
    async () => {
      await refresh()
      if (!request.isCurrent()) return
      await refreshNuxtData(`org-nav-balances-${requestedOrgId}`)
    },
  )
  if (outcome.kind === 'success') {
    haptic('success')
  } else if (outcome.kind === 'error') {
    haptic('error')
    actionError.value = apiErrorMessage(outcome.error, 'Не удалось отменить запись')
    if (
      request.isCurrent() &&
      shouldRefreshPlayerEventAfterRejection(apiErrorCode(outcome.error))
    ) {
      await retryPage()
    }
  }
  if (request.isCurrent()) submitting.value = false
}
</script>

<template>
  <div class="min-h-screen" :class="showActionBar ? 'pb-44' : 'pb-24'">
    <VtMiniHeader
      :title="ev?.title ?? 'Событие'"
      :sub="ev ? `${formatDay(ev.startsAt, tz)} · ${formatTime(ev.startsAt, tz)}` : undefined"
      :back="pageState === 'ready' ? `/m/orgs/${orgId}/events` : '/m/orgs'"
    >
      <template v-if="isManager && ev" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/events/${ev.id}/manage`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          <VtIcon name="settings" :size="14" /> Управление
        </NuxtLink>
      </template>
    </VtMiniHeader>

    <main
      v-if="pageState === 'pending' || pageState === 'suspended' || pageState === 'denied'"
      class="px-4 py-5"
    >
      <div class="vt-card p-4" role="status">
        <VtChip :tone="pageState === 'pending' ? 'amber' : 'rose'" dot>
          {{
            pageState === 'pending'
              ? 'Заявка на рассмотрении'
              : pageState === 'suspended'
                ? 'Группа приостановлена'
                : 'Доступ в группу закрыт'
          }}
        </VtChip>
        <p class="text-sm text-vt-mute-2 mt-3">
          {{
            pageState === 'pending'
              ? 'После одобрения заявки откроются события и запись.'
              : pageState === 'suspended'
                ? 'Запись и покупки сейчас недоступны.'
                : 'Для просмотра события нужен доступ к группе.'
          }}
        </p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>
    </main>
    <div v-else-if="pageState === 'error'">
      <ErrorState
        :message="loadErrorNotice.message"
        :retry="loadErrorNotice.retry"
        @retry="retryPage"
      />
      <div v-if="loadErrorNotice.eventsLink" class="text-center px-4">
        <NuxtLink :to="`/m/orgs/${orgId}/events`" class="vt-btn vt-btn--ghost">
          Все события
        </NuxtLink>
      </div>
    </div>
    <SkeletonList v-else-if="pageState === 'loading' || !ev" :count="3" class="px-4 py-5" />
    <main v-else class="px-4 py-5 space-y-6">
      <section class="vt-card p-4" aria-label="Дата, место и стоимость">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 text-xs text-vt-mute-2">
            <div v-if="ev.venue || ev.locationText" class="flex items-start gap-1.5">
              <VtIcon name="pin" :size="12" class="shrink-0 mt-0.5" />
              <span class="break-words min-w-0">{{ ev.venue?.name ?? ev.locationText }}</span>
            </div>
            <p v-if="ev.venue?.address" class="mt-1 break-words">{{ ev.venue.address }}</p>
            <div class="flex items-start gap-1.5 mt-1">
              <VtIcon name="clock" :size="12" class="shrink-0 mt-0.5" />
              <span>{{
                started || ev.status !== 'published'
                  ? 'Запись закрыта'
                  : `Начало в ${formatTime(ev.startsAt, tz)}`
              }}</span>
            </div>
          </div>
          <VtChip v-if="ev.status === 'cancelled'" tone="rose">Событие отменено</VtChip>
          <VtChip v-else-if="ev.status === 'draft'" tone="amber">Черновик события</VtChip>
          <VtChip
            v-else-if="eventView?.hasBooking && eventView.bookingCard"
            :tone="eventView.bookingCard.tone"
            dot
            >{{
              paymentLabel?.text ??
              (my?.status === 'pending_payment' ? 'Ждёт оплаты' : eventView.bookingCard.title)
            }}</VtChip
          >
          <VtChip v-else-if="started">Запись закрыта</VtChip>
          <VtChip v-else-if="full" tone="rose">Лист ожидания</VtChip>
          <VtChip v-else>Места есть</VtChip>
        </div>
        <div class="vt-divider my-3" />
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <div class="vt-cap text-vt-mute-2">Цена</div>
            <div class="vt-mono text-base mt-1 break-words">{{ priceLabel?.text }}</div>
            <p v-if="priceLabel?.description" class="text-xs text-vt-mute-2 mt-2">
              {{ priceLabel.description }}
            </p>
          </div>
          <div>
            <div class="vt-cap text-vt-mute-2">Длительность</div>
            <div class="font-semibold text-sm mt-1">
              {{
                Math.round(
                  (new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()) / 60000,
                )
              }}
              мин.
            </div>
          </div>
        </div>
      </section>

      <section v-if="ev.description" aria-labelledby="event-description-title">
        <h2 id="event-description-title" class="vt-cap mb-3">О тренировке</h2>
        <p class="vt-card p-4 text-sm text-vt-ink-3 whitespace-pre-line">{{ ev.description }}</p>
      </section>

      <section aria-labelledby="event-roster-title">
        <div class="flex items-center justify-between mb-2">
          <h2 id="event-roster-title" class="vt-cap">Состав</h2>
          <span class="vt-mono text-xs text-vt-mute-2"
            >{{ ev.taken }}/{{ ev.capacity
            }}<template v-if="ev.waitlist"> · ожидают {{ ev.waitlist }}</template></span
          >
        </div>
        <VtMeter
          :value="ev.taken"
          :max="ev.capacity"
          :tone="full ? 'amber' : 'flame'"
          label="Заполненность"
        />
        <ul v-if="roster.length" class="mt-3 grid grid-cols-2 gap-1.5">
          <li
            v-for="r in roster"
            :key="r.user.id"
            class="vt-card flex items-center gap-2 p-2 min-w-0"
          >
            <VtAvatar size="sm" :name="displayName(r.user)" :src="r.user.image" />
            <span class="text-[13px] flex-1 truncate">{{ displayName(r.user) }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-vt-mute-2 mt-3">
          {{
            ev.status === 'cancelled'
              ? 'Событие отменено — состав пуст.'
              : bookable
                ? 'Пока никто не записался — будьте первым.'
                : 'Состав пуст.'
          }}
        </p>
      </section>

      <section
        v-if="my && eventView?.bookingCard"
        class="vt-card p-4"
        role="status"
        aria-label="Ваша запись"
      >
        <VtChip :tone="eventView.bookingCard.tone" dot>{{ eventView.bookingCard.title }}</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">{{ eventView.bookingCard.text }}</p>
        <div v-if="paymentLabel" class="mt-2 space-y-1">
          <p v-if="my.status !== 'waitlisted'" class="vt-mono text-sm">{{ priceLabel?.text }}</p>
          <VtChip :tone="paymentLabel.tone">{{ paymentLabel.text }}</VtChip>
        </div>
        <button
          v-if="canCancel"
          type="button"
          class="vt-btn vt-btn--danger vt-btn--full mt-3"
          :disabled="submitting"
          @click="cancelMine"
        >
          Отменить запись
        </button>
        <p
          v-else-if="['confirmed', 'pending_payment', 'waitlisted'].includes(my.status) && !started"
          class="text-xs text-vt-mute-2 mt-3"
        >
          {{ noCancelExplanation }}
        </p>
      </section>

      <p v-if="cancelDeadline && !eventView?.hasBooking && bookable" class="text-xs text-vt-mute-2">
        Отменить запись можно до {{ formatDay(cancelDeadline, tz) }},
        {{ formatTime(cancelDeadline, tz) }}.
      </p>
      <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <!--
        Панель действия над таб-баром (z-30 > z-20) и с отступом на его высоту (Task 5.14.1).
        В Telegram не рендерится: то же действие уже на MainButton.
      -->
      <div
        v-if="showActionBar"
        class="player-event-action fixed inset-x-0 z-30 p-4 bg-vt-paper border-t border-vt-stroke"
      >
        <p
          v-if="eventView?.action === 'waitlist'"
          class="text-xs text-vt-amber-ink mb-2 text-center"
        >
          Мест нет — вы встанете в лист ожидания.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          :disabled="submitting"
          @click="openBooking"
        >
          {{ eventView?.action === 'waitlist' ? 'Встать в лист ожидания' : 'Записаться' }}
        </button>
      </div>
      <p v-else-if="started && !eventView?.hasBooking" class="text-sm text-vt-mute-2 text-center">
        Запись закрыта — событие уже началось.
      </p>
    </main>

    <VtSheet
      v-model="sheetOpen"
      :title="full ? 'Лист ожидания: способ оплаты' : 'Как оплатите участие?'"
    >
      <div class="space-y-2">
        <p v-if="ev?.pricing.mode === 'split'" class="text-sm text-vt-mute-2">
          {{ full ? 'В листе ожидания начисления нет.' : priceLabel?.text }}
          {{ priceLabel?.description }}
        </p>
        <button
          v-for="s in eventView?.paymentMethods.includes('subscription') ? subs : []"
          :key="s.id"
          type="button"
          class="vt-card w-full p-3.5 flex items-center gap-3"
          :disabled="submitting"
          @click="doBook('subscription', s.id)"
        >
          <VtIcon name="ticket" :size="18" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold">Абонемент</span>
            <span class="block text-xs text-vt-mute-2">
              осталось {{ s.totalSessions - s.usedSessions }} из {{ s.totalSessions }}
              <template v-if="full"> · спишется при переходе в состав</template>
            </span>
          </span>
        </button>
        <button
          v-if="eventView?.paymentMethods.includes('cash')"
          type="button"
          class="vt-card w-full p-3.5 flex items-center gap-3"
          :disabled="submitting"
          @click="doBook('cash')"
        >
          <VtIcon name="wallet" :size="18" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold">Наличными организатору</span>
            <span class="block text-xs text-vt-mute-2"
              >{{
                ev?.pricing.mode === 'split'
                  ? 'Точная сумма после закрытия записи'
                  : priceLabel?.text
              }}
              · подтвердит организатор</span
            >
          </span>
        </button>
        <button
          v-if="eventView?.paymentMethods.includes('transfer')"
          type="button"
          class="vt-card w-full p-3.5 flex items-center gap-3"
          :disabled="submitting"
          @click="doBook('transfer')"
        >
          <VtIcon name="card" :size="18" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold">Переводом</span>
            <span class="block text-xs text-vt-mute-2">реквизиты — у организатора</span>
          </span>
        </button>
        <p v-if="actionError" class="text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      </div>
    </VtSheet>
  </div>
</template>

<style scoped>
.event-hero {
  background: var(--vt-ink);
  color: var(--vt-paper);
}

.event-hero__eyebrow {
  color: var(--vt-paper);
  opacity: 0.72;
}
</style>
