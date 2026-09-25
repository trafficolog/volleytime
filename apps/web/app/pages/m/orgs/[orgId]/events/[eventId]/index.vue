<script setup lang="ts">
import type { Event, Organization, OrganizationMember, Subscription } from '@volley-time/db'
import { formatDay, formatTime } from '@volley-time/shared'

import { displayName, formatPrice } from '~/utils/labels'
import { playerEventPageState, playerEventReady, projectPlayerEvent } from '~/utils/player-event'
import {
  bookingPayload,
  runPlayerEventAction,
  shouldRefreshPlayerEventAfterRejection,
} from '~/utils/player-event-action'
import { playerHomeAccess } from '~/utils/player-home'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type EventDetails = Event & {
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

// выбор способа
const sheetOpen = ref(false)
const submitting = ref(false)
const actionError = ref('')
const routeGuard = createPlayerRequestGuard(() => `${orgId.value}:${eventId.value}`)
const optionsGuard = createPlayerRequestGuard(() => `${orgId.value}:${eventId.value}`)

watch(sourcesReady, (ready) => {
  if (ready) return
  optionsGuard.invalidate()
  sheetOpen.value = false
})

async function retryPage() {
  await Promise.all([refresh(), refreshNuxtData(`player-event-org-${orgId.value}`)])
}

watch(
  [orgId, eventId],
  () => {
    routeGuard.invalidate()
    optionsGuard.invalidate()
    sheetOpen.value = false
    subs.value = []
    actionError.value = ''
    submitting.value = false
  },
  { flush: 'sync' },
)

async function openBooking() {
  if (submitting.value || !bookable.value) return
  actionError.value = ''
  if (!ev.value) return
  if (ev.value.price === 0) return doBook('free')
  if (subscriptionsEnabled.value !== true) {
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
  if (submitting.value || !eventView.value?.paymentMethods.includes(method)) return
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
onUnmounted(() => mainButtonCleanup?.())

async function cancelMine() {
  if (submitting.value || !my.value || !canCancel.value) return
  const requestedOrgId = orgId.value
  const bookingId = my.value.id
  if (!(await confirm('Отменить запись на тренировку?'))) return
  if (requestedOrgId !== orgId.value || bookingId !== my.value?.id) return
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
    <ErrorState
      v-else-if="pageState === 'error'"
      message="Не удалось открыть событие"
      @retry="retryPage"
    />
    <SkeletonList v-else-if="pageState === 'loading' || !ev" :count="3" class="px-4 py-5" />
    <main v-else class="px-4 py-5 space-y-6">
      <section class="vt-card event-hero p-5" aria-labelledby="event-title">
        <p class="vt-cap event-hero__eyebrow">{{ organization?.name }}</p>
        <h2 id="event-title" class="font-display text-[28px] leading-tight mt-3">{{ ev.title }}</h2>
        <p v-if="ev.status === 'cancelled'" class="mt-3 text-sm">Событие отменено</p>
        <p v-else-if="ev.status === 'draft'" class="mt-3 text-sm">Черновик события</p>
      </section>

      <section class="vt-card p-4" aria-label="Дата, место и стоимость">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="vt-cap">{{ formatDay(ev.startsAt, tz) }}</div>
            <div class="vt-mono text-2xl font-bold mt-0.5">
              {{ formatTime(ev.startsAt, tz) }}–{{ formatTime(ev.endsAt, tz) }}
            </div>
          </div>
          <div class="text-right">
            <div class="font-display font-semibold text-lg">
              {{ formatPrice(ev.price, ev.currency) }}
            </div>
          </div>
        </div>
        <div v-if="ev.venue || ev.locationText" class="mt-3 flex items-start gap-2 text-sm">
          <VtIcon name="pin" :size="16" class="mt-0.5 text-vt-mute" />
          <div>
            <div class="font-medium">{{ ev.venue?.name ?? ev.locationText }}</div>
            <div v-if="ev.venue?.address" class="text-vt-mute-2 text-xs">
              {{ ev.venue.address }}
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
        <ul
          v-if="roster.length"
          class="mt-3 vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden"
        >
          <li v-for="(r, i) in roster" :key="r.user.id" class="flex items-center gap-3 px-3.5 py-2">
            <span class="vt-mono text-[11px] text-vt-mute w-4">{{ i + 1 }}</span>
            <VtAvatar size="sm" :name="displayName(r.user)" :src="r.user.image" />
            <span class="text-[13px] flex-1 truncate">{{ displayName(r.user) }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-vt-mute-2 mt-3">Пока никто не записался — будьте первым.</p>
      </section>

      <section
        v-if="my && eventView?.bookingCard"
        class="vt-card p-4"
        role="status"
        aria-label="Ваша запись"
      >
        <VtChip :tone="eventView.bookingCard.tone" dot>{{ eventView.bookingCard.title }}</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">{{ eventView.bookingCard.text }}</p>
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
          Дедлайн отмены прошёл — если не сможете прийти, напишите организатору.
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
        class="fixed inset-x-0 z-30 p-4 bg-vt-paper border-t border-vt-stroke bottom-[calc(52px+env(safe-area-inset-bottom))]"
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
              >{{ formatPrice(ev?.price ?? 0, ev?.currency) }} · подтвердит организатор</span
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
