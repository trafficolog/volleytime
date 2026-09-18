<script setup lang="ts">
import type { Event, OrganizationMember, Subscription } from '@volley-time/db'
import { formatDay, formatTime } from '@volley-time/shared'
import { displayName, formatPrice } from '~/utils/labels'
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
  refresh,
} = await useFetch<{ event: EventDetails; roster: RosterItem[] }>(
  () => `/api/organizations/${orgId.value}/events/${eventId.value}`,
)
const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const ev = computed(() => data.value?.event ?? null)
const roster = computed(() => data.value?.roster ?? [])
const isManager = computed(() => {
  const m = orgData.value?.myMember
  return !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})

const my = computed(() => ev.value?.myBooking ?? null)
const full = computed(() => !!ev.value && ev.value.taken >= ev.value.capacity)
const started = computed(() => !!ev.value && new Date(ev.value.startsAt) <= new Date())
const bookable = computed(() => ev.value?.status === 'published' && !started.value && !my.value)
/** В Telegram действие живёт на MainButton — панель не показываем (5.14.1). */
const showActionBar = computed(() => bookable.value && !isTelegram.value)
const cancelDeadline = computed(() => {
  if (!ev.value || ev.value.cancellationDeadlineHours == null) return null
  return new Date(
    new Date(ev.value.startsAt).getTime() - ev.value.cancellationDeadlineHours * 3600_000,
  )
})
const canCancel = computed(
  () =>
    !!my.value &&
    ['confirmed', 'pending_payment', 'waitlisted'].includes(my.value.status) &&
    !started.value &&
    (!cancelDeadline.value ||
      cancelDeadline.value > new Date() ||
      my.value.status === 'waitlisted'),
)

const MY_STATE: Record<
  string,
  { tone: 'grass' | 'amber' | 'default'; title: string; text: string }
> = {
  confirmed: {
    tone: 'grass',
    title: 'Вы записаны',
    text: 'Место за вами. До встречи на площадке!',
  },
  attended: {
    tone: 'grass',
    title: 'Вы были на тренировке',
    text: 'Посещение отмечено организатором.',
  },
  no_show: {
    tone: 'default',
    title: 'Отмечено: не пришли',
    text: 'Если это ошибка — напишите организатору.',
  },
  pending_payment: {
    tone: 'amber',
    title: 'Место забронировано — ждёт оплаты',
    text: 'Оплатите организатору наличными или переводом, он подтвердит оплату.',
  },
  waitlisted: {
    tone: 'default',
    title: 'Вы в листе ожидания',
    text: 'Если кто-то отменит запись, место перейдёт к вам — пришлём уведомление.',
  },
}

// выбор способа
const subs = ref<Subscription[]>([])
const sheetOpen = ref(false)
const submitting = ref(false)
const actionError = ref('')

async function openBooking() {
  actionError.value = ''
  if (!ev.value) return
  if (ev.value.price === 0) return doBook('free')
  try {
    const res = await $fetch<{ subscriptions: Subscription[] }>(
      `/api/organizations/${orgId.value}/subscriptions/my`,
    )
    subs.value = res.subscriptions.filter(
      (s) =>
        s.status === 'active' &&
        s.usedSessions < s.totalSessions &&
        (!s.expiresAt || new Date(s.expiresAt) > new Date()),
    )
  } catch {
    subs.value = []
  }
  sheetOpen.value = true
}

async function doBook(method: string, subscriptionId?: number) {
  submitting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/events/${eventId.value}/bookings`, {
      method: 'POST',
      body: { method, subscriptionId },
    })
    haptic('success')
    sheetOpen.value = false
    await refresh()
  } catch (e) {
    haptic('error')
    actionError.value = apiErrorMessage(e, 'Не удалось записаться')
    if (apiErrorCode(e) === 'booking.already_booked') await refresh()
  } finally {
    submitting.value = false
  }
}

// MainButton Telegram для основного действия экрана (8.8.7)
let mainButtonCleanup: (() => void) | undefined
function syncMainButton() {
  mainButtonCleanup?.()
  mainButtonCleanup = undefined
  if (!isTelegram.value || !bookable.value) return
  mainButtonCleanup = useMainButton(full.value ? 'Встать в лист ожидания' : 'Записаться', () => {
    void openBooking()
  })
}
onMounted(syncMainButton)
watch([bookable, full], syncMainButton)
onUnmounted(() => mainButtonCleanup?.())

async function cancelMine() {
  if (!my.value) return
  if (!(await confirm('Отменить запись на тренировку?'))) return
  submitting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/bookings/${my.value.id}/cancel`, {
      method: 'POST',
    })
    haptic('success')
    await refresh()
  } catch (e) {
    haptic('error')
    actionError.value = apiErrorMessage(e, 'Не удалось отменить запись')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen" :class="showActionBar ? 'pb-44' : 'pb-24'">
    <VtMiniHeader :title="ev?.title ?? 'Событие'" :back="`/m/orgs/${orgId}/events`">
      <template v-if="isManager && ev" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/events/${ev.id}/manage`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          <VtIcon name="settings" :size="14" /> Управление
        </NuxtLink>
      </template>
    </VtMiniHeader>

    <ErrorState v-if="loadError" message="Не удалось открыть событие" @retry="refresh()" />
    <main v-else-if="ev" class="px-4 py-4 space-y-4">
      <section class="vt-card p-4">
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
            <VtChip v-if="ev.status === 'cancelled'" tone="rose">Отменено</VtChip>
            <VtChip v-else-if="ev.status === 'draft'" tone="amber">Черновик</VtChip>
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
        <p v-if="ev.description" class="mt-3 text-sm text-vt-ink-3 whitespace-pre-line">
          {{ ev.description }}
        </p>
      </section>

      <section>
        <div class="flex items-center justify-between mb-2">
          <h2 class="vt-cap">Состав</h2>
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

      <section v-if="my" class="vt-card p-4" role="status">
        <VtChip :tone="MY_STATE[my.status]?.tone ?? 'default'" dot>{{
          MY_STATE[my.status]?.title ?? 'Запись'
        }}</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">{{ MY_STATE[my.status]?.text }}</p>
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
          v-else-if="['confirmed', 'pending_payment'].includes(my.status) && !started"
          class="text-xs text-vt-mute-2 mt-3"
        >
          Дедлайн отмены прошёл — если не сможете прийти, напишите организатору.
        </p>
      </section>

      <p v-if="cancelDeadline && !my && bookable" class="text-xs text-vt-mute-2">
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
        <p v-if="full" class="text-xs text-vt-amber-ink mb-2 text-center">
          Мест нет — вы встанете в лист ожидания.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          :disabled="submitting"
          @click="openBooking"
        >
          {{ full ? 'Встать в лист ожидания' : 'Записаться' }}
        </button>
      </div>
      <p v-else-if="started && !my" class="text-sm text-vt-mute-2 text-center">
        Запись закрыта — событие уже началось.
      </p>
    </main>

    <VtSheet
      v-model="sheetOpen"
      :title="full ? 'Лист ожидания: способ оплаты' : 'Как оплатите участие?'"
    >
      <div class="space-y-2">
        <button
          v-for="s in subs"
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
