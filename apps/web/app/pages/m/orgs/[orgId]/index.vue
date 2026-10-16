<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { formatDay, formatShortDate, formatTime, type EventPricingView } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import GroupSwitcher from '~/components/GroupSwitcher.vue'
import PlayerHomeBento from '~/components/PlayerHomeBento.vue'
import PlayerHomeTiles from '~/components/PlayerHomeTiles.vue'
import { groupEntryState, visibleGroup } from '~/utils/group-entry-state'
import { groupMonogram } from '~/utils/group-monogram'
import { formatMoneyRu } from '~/utils/labels'
import {
  organizerHomeSubtitle,
  projectOrganizerHome,
  type OrganizerBalance,
} from '~/utils/organizer-miniapp'
import {
  playerGreeting,
  playerHomeAccess,
  projectPlayerHome,
  sessionsTile,
} from '~/utils/player-home'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface Dashboard {
  isManager: boolean
  /** Точные счётчики своих предстоящих записей (20.4.4). */
  hero: EventListItem | null
  bookingsCount: number
  bookingsAwaitingPayment: number
  myBookings: {
    id: number
    status: string
    pricing?: EventPricingView
    event: {
      id: number
      title: string
      startsAt: string
      currency?: string
      venue: { name: string } | null
    }
  }[]
  subscription: { id: number; left: number; total: number; expiresAt: string | null } | null
  upcoming: EventListItem[]
  manager: {
    pendingCount: number
    pendingAmount: number
    balance: OrganizerBalance
  } | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)

const {
  data: orgData,
  error: orgError,
  status: orgStatus,
  refresh: refreshOrg,
  pending: orgLoading,
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-home-${orgId.value}` })
const org = computed(() =>
  orgStatus.value === 'success'
    ? visibleGroup(orgData.value?.organization, orgError.value, orgId.value)
    : null,
)
const accessState = computed(() =>
  orgError.value
    ? groupEntryState(apiErrorStatus(orgError.value), apiErrorCode(orgError.value))
    : null,
)
const me = computed(() => (org.value ? (orgData.value?.myMember ?? null) : null))
const access = computed(() =>
  playerHomeAccess(orgId.value, org.value, me.value, apiErrorCode(orgError.value)),
)
const headerSubtitle = computed(() => organizerHomeSubtitle(orgId.value, org.value, me.value))
const activeManager = computed(
  () =>
    !!org.value && me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)
const groupsOpen = ref(false)

const dashboard = shallowRef<Dashboard | null>(null)
const dashboardOrgId = ref<number | null>(null)
const dashLoading = ref(false)
const dashError = ref('')
const dashboardGuard = createPlayerRequestGuard(() => orgId.value)
const dash = computed(() =>
  org.value && !dashLoading.value && !dashError.value && dashboardOrgId.value === orgId.value
    ? dashboard.value
    : null,
)
const playerHome = computed(() =>
  projectPlayerHome(dash.value?.upcoming ?? [], new Date(), dash.value?.hero ?? null),
)
const { user } = useAuth()
const greeting = computed(() => playerGreeting(user.value?.name))
const sessions = computed(() =>
  sessionsTile(org.value?.subscriptionsEnabled === true, dash.value?.subscription ?? null),
)
const home = computed(() => projectOrganizerHome(orgId.value, org.value, me.value, dash.value))
const roleMismatch = computed(() => !!dash.value && dash.value.isManager !== activeManager.value)

async function refreshDash() {
  const requestedOrgId = orgId.value
  const request = dashboardGuard.begin()
  dashboard.value = null
  dashboardOrgId.value = null
  dashError.value = ''
  dashLoading.value = true
  try {
    const response = await $fetch<Dashboard>(`/api/organizations/${requestedOrgId}/dashboard`)
    if (!request.isCurrent()) return
    dashboard.value = response
    dashboardOrgId.value = requestedOrgId
  } catch (error) {
    if (request.isCurrent())
      dashError.value = apiErrorMessage(error, 'Не удалось загрузить данные группы')
  } finally {
    if (request.isCurrent()) dashLoading.value = false
  }
}
await refreshDash()
watch(orgId, () => void refreshDash())

watch(
  org,
  (value) => {
    if (import.meta.client && value && !orgError.value)
      window.localStorage.setItem('vt.lastOrgId', String(value.id))
  },
  { immediate: true },
)

const base = computed(() => `/m/orgs/${orgId.value}`)
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader
      v-if="activeManager"
      :title="org?.name ?? 'Группа'"
      :sub="headerSubtitle"
      back="/m/orgs"
    >
      <template #title>
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            data-monogram
            aria-hidden="true"
            class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
            :class="org ? groupMonogram(org.name).className : 'bg-vt-bone'"
            >{{ org ? groupMonogram(org.name).initials : '' }}</span
          >
          <h1 class="min-w-0 text-base font-semibold">
            <button
              type="button"
              class="flex min-h-11 max-w-full items-center gap-1 text-left font-semibold"
              aria-haspopup="dialog"
              aria-controls="group-switcher"
              :aria-expanded="groupsOpen"
              @click="groupsOpen = true"
            >
              <span class="truncate">{{ org?.name ?? 'Группа' }}</span>
              <VtIcon name="chevron-r" :size="14" class="shrink-0 rotate-90" aria-hidden="true" />
            </button>
          </h1>
        </div>
      </template>
      <template #right>
        <NuxtLink
          v-if="home"
          :to="`${base}/invite`"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          aria-label="Пригласить"
        >
          <VtIcon name="send" :size="14" /> Пригласить
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <header v-else class="vt-miniheader">
      <button
        type="button"
        class="flex items-center gap-3 min-w-0 min-h-11 text-left"
        :disabled="!org"
        :aria-label="org ? `Выбрать группу. Сейчас ${org.name}` : 'Загрузка группы'"
        aria-haspopup="dialog"
        aria-controls="group-switcher"
        :aria-expanded="groupsOpen"
        @click="groupsOpen = true"
      >
        <span
          data-monogram
          aria-hidden="true"
          class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
          :class="org ? groupMonogram(org.name).className : 'bg-vt-bone'"
          >{{ org ? groupMonogram(org.name).initials : '' }}</span
        >
        <span class="min-w-0">
          <span class="font-semibold text-[15px] truncate flex items-center gap-1">
            {{ org?.name ?? 'Группа' }} <VtIcon name="chevron-r" :size="14" class="rotate-90" />
          </span>
          <span v-if="org?.city" class="block text-xs text-vt-mute-2 truncate">{{ org.city }}</span>
        </span>
      </button>
      <NuxtLink
        to="/m/orgs"
        class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44"
        aria-label="Мои группы"
      >
        <VtIcon name="users" :size="18" />
      </NuxtLink>
    </header>

    <main class="px-4 py-4 space-y-6">
      <section v-if="accessState === 'unauthorized'" class="vt-card p-5 space-y-3">
        <h1 class="text-xl font-semibold">Нужно войти</h1>
        <NuxtLink
          :to="`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`"
          class="vt-btn vt-btn--primary"
          >Войти по email</NuxtLink
        >
      </section>
      <div
        v-else-if="access === 'suspended' || accessState === 'suspended'"
        class="vt-card p-4"
        role="status"
      >
        <VtChip tone="rose" dot>Группа приостановлена</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">Запись и покупки сейчас недоступны.</p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>

      <div v-else-if="access === 'pending'" class="vt-card p-4" role="status">
        <VtChip tone="amber" dot>Заявка на рассмотрении</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">
          Организатор получил вашу заявку. Когда её одобрят, откроются события и запись.
        </p>
      </div>

      <div
        v-else-if="access === 'denied' || accessState === 'denied'"
        class="vt-card p-4"
        role="status"
      >
        <VtChip tone="rose" dot>Доступ в группу закрыт</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">Запись и покупки в этой группе недоступны.</p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>

      <ErrorState
        v-else-if="orgError || (orgStatus === 'success' && !org)"
        message="Не удалось открыть группу"
        @retry="refreshOrg()"
      />

      <SkeletonList v-else-if="orgLoading || access === 'loading'" :count="2" />

      <template v-else-if="org">
        <ErrorState v-if="dashError" :message="dashError" @retry="refreshDash()" />
        <SkeletonList v-else-if="dashLoading" :count="3" />
        <template v-else-if="dash">
          <ErrorState
            v-if="roleMismatch || (activeManager && !home)"
            message="Не удалось загрузить обзор группы"
            @retry="refreshDash()"
          />
          <template v-else-if="home">
            <section aria-label="Обзор организатора">
              <h2 class="mb-3 text-2xl font-bold">Обзор группы</h2>
              <div class="organizer-overview-grid grid gap-3">
                <NuxtLink
                  :to="`${base}/cashbox`"
                  class="vt-card vt-card--hero organizer-cash-hero flex min-w-0 flex-col p-4 text-white"
                >
                  <span class="vt-cap opacity-75">Касса</span>
                  <span
                    class="vt-mono mt-3 text-2xl font-bold break-words"
                    :class="home.balance.balance < 0 ? 'text-[var(--vt-amber)]' : ''"
                  >
                    {{ formatMoneyRu(home.balance.balance, home.balance.currency) }}
                  </span>
                  <span class="mt-auto grid grid-cols-2 gap-2 pt-4 text-xs">
                    <span>
                      <span class="block opacity-75">Доходы</span>
                      <span class="vt-mono mt-1 block font-semibold break-words"
                        >+{{ formatMoneyRu(home.balance.income, home.balance.currency) }}</span
                      >
                    </span>
                    <span>
                      <span class="block opacity-75">Расходы</span>
                      <span class="vt-mono mt-1 block font-semibold break-words"
                        >−{{ formatMoneyRu(home.balance.expense, home.balance.currency) }}</span
                      >
                    </span>
                  </span>
                </NuxtLink>
                <NuxtLink
                  :to="`${base}/payments`"
                  class="vt-card vt-card--warm flex min-w-0 flex-col justify-between p-4"
                >
                  <VtIcon name="wallet" :size="20" />
                  <span class="mt-3">
                    <span class="vt-mono block text-3xl font-bold leading-none">{{
                      home.pendingCount
                    }}</span>
                    <span class="mt-1 block text-xs">Ждут подтверждения</span>
                  </span>
                </NuxtLink>
                <NuxtLink
                  :to="
                    home.nextEvent
                      ? `${base}/events/${home.nextEvent.id}/manage`
                      : `${base}/events/new`
                  "
                  class="vt-card flex min-w-0 flex-col justify-between p-4"
                >
                  <VtIcon name="calendar" :size="20" />
                  <span class="mt-3 min-w-0">
                    <span class="vt-cap block">Ближайшее событие</span>
                    <span v-if="home.nextEvent" class="mt-1 block text-sm font-bold break-words">{{
                      home.nextEvent.title
                    }}</span>
                    <span v-else class="mt-1 block text-xs text-vt-mute-2">Создать тренировку</span>
                    <span v-if="home.nextEvent" class="mt-1 block text-xs text-vt-mute-2">
                      {{ formatDay(home.nextEvent.startsAt, tz) }} ·
                      {{ formatTime(home.nextEvent.startsAt, tz) }}
                    </span>
                  </span>
                </NuxtLink>
              </div>
            </section>
            <nav
              aria-label="Быстрые действия"
              class="organizer-quick-actions grid grid-cols-4 gap-2"
            >
              <NuxtLink
                v-for="action in [
                  { to: `${base}/events/new`, icon: 'plus', label: 'Тренировка' },
                  { to: `${base}/invite`, icon: 'users', label: 'Пригласить' },
                  { to: `${base}/cashbox`, icon: 'wallet', label: 'Расход' },
                  { to: `${base}/members`, icon: 'user', label: 'Игроки' },
                ]"
                :key="action.label"
                :to="action.to"
                class="flex min-h-18 min-w-0 flex-col items-center gap-1 text-center text-xs font-semibold"
              >
                <span
                  class="vt-card flex h-12 w-full max-w-16 items-center justify-center rounded-xl"
                  ><VtIcon :name="action.icon" :size="20"
                /></span>
                <span class="break-words">{{ action.label }}</span>
              </NuxtLink>
            </nav>
          </template>

          <section v-if="!roleMismatch && !dash.isManager" class="space-y-3">
            <div>
              <p v-if="greeting" class="text-sm text-vt-mute-2">{{ greeting }}</p>
              <h2 class="mt-1 text-[30px] leading-none">Ближайшая игра</h2>
            </div>
            <PlayerHomeBento
              v-if="playerHome.hero"
              :base="base"
              :tz="tz"
              :hero="playerHome.hero"
              :sessions="sessions"
              :bookings-count="dash.bookingsCount"
              :awaiting-payment="dash.bookingsAwaitingPayment"
            />
            <template v-else>
              <EmptyState
                icon="calendar"
                :title="
                  dash.bookingsCount > 0 ? 'Нет игры, на которую вы идёте' : 'Тренировок пока нет'
                "
                :description="
                  dash.bookingsCount > 0
                    ? 'Ваши записи — в плитке ниже.'
                    : 'Организатор ещё не опубликовал расписание. Как только появится событие, пришлём уведомление в бот.'
                "
              />
              <div class="grid grid-cols-2 gap-3">
                <PlayerHomeTiles
                  :base="base"
                  :sessions="sessions"
                  :bookings-count="dash.bookingsCount"
                  :awaiting-payment="dash.bookingsAwaitingPayment"
                  variant="row"
                />
              </div>
            </template>
          </section>

          <NuxtLink
            v-if="!roleMismatch && activeManager && dash.subscription"
            :to="`${base}/subscriptions`"
            class="vt-card p-4 block"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="vt-cap">Абонемент</div>
                <div class="mt-1">
                  <span class="vt-mono text-2xl font-bold">{{ dash.subscription.left }}</span>
                  <span class="text-sm text-vt-mute-2">
                    из {{ dash.subscription.total }} занятий</span
                  >
                </div>
              </div>
              <div v-if="dash.subscription.expiresAt" class="text-xs text-vt-mute-2">
                до {{ formatShortDate(dash.subscription.expiresAt, tz) }}
              </div>
            </div>
            <VtMeter
              class="mt-3"
              :value="dash.subscription.left"
              :max="dash.subscription.total"
              tone="grass"
              label="Остаток абонемента"
            />
          </NuxtLink>

          <section
            v-if="
              !roleMismatch &&
              (home || (!dash.isManager && (playerHome.hero || dash.upcoming.length > 0)))
            "
          >
            <div class="organizer-events-heading flex items-center justify-between mb-2">
              <h2 :class="home ? 'vt-cap' : 'font-display font-bold text-xl uppercase'">
                {{ home ? 'Ближайшие события' : 'Расписание' }}
              </h2>
              <NuxtLink
                :to="`${base}/events`"
                class="organizer-all-link vt-hit-44 inline-flex items-center gap-1 text-sm font-semibold text-vt-link"
                >{{ home ? 'Все' : 'Смотреть все' }}
                <VtIcon v-if="!home" name="chevron-r" :size="14" aria-hidden="true"
              /></NuxtLink>
            </div>
            <EmptyState
              v-if="dash.upcoming.length === 0 && (dash.isManager || !playerHome.hero)"
              icon="calendar"
              title="Событий пока нет"
            >
              <template v-if="home" #action>
                <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
                  >Создать событие</NuxtLink
                >
              </template>
            </EmptyState>
            <p
              v-else-if="!dash.isManager && playerHome.schedule.length === 0"
              class="text-sm text-vt-mute-2"
            >
              Других событий пока нет.
            </p>
            <ul v-else-if="home" class="divide-y divide-[var(--vt-stroke)]">
              <li v-for="ev in home.upcoming" :key="ev.id">
                <OrganizerEventRow :event="ev" :tz="tz" :to="`${base}/events/${ev.id}/manage`" />
              </li>
            </ul>
            <ul v-else class="player-schedule">
              <li v-for="ev in playerHome.schedule" :key="ev.id">
                <EventCard
                  :event="ev"
                  :tz="tz"
                  :to="`${base}/events/${ev.id}`"
                  presentation="schedule"
                />
              </li>
            </ul>
          </section>
        </template>
        <ErrorState v-else message="Не удалось загрузить данные группы" @retry="refreshDash()" />
      </template>
    </main>

    <GroupSwitcher id="group-switcher" v-model="groupsOpen" :current-org-id="orgId" />
  </div>
</template>

<style scoped>
.organizer-overview-grid {
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
}

.organizer-cash-hero {
  display: flex;
  flex-direction: column;
  grid-row: span 2;
}

.organizer-cash-hero .vt-cap {
  color: rgb(255 255 255 / 78%);
}

.organizer-all-link {
  min-height: 44px;
}

@media (max-width: 23rem) {
  .organizer-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .organizer-cash-hero {
    grid-column: 1 / -1;
    grid-row: auto;
  }
}

@media (max-width: 200px) {
  .organizer-overview-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .organizer-quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .organizer-events-heading {
    flex-wrap: wrap;
  }

  .organizer-events-heading h2 {
    width: 100%;
  }
}
</style>
