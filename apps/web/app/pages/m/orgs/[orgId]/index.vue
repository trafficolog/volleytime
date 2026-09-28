<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { formatDay, formatShortDate, formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { groupEntryState, visibleGroup } from '~/utils/group-entry-state'
import { formatMoneyRu } from '~/utils/labels'
import {
  organizerHomeSubtitle,
  projectOrganizerHome,
  type OrganizerBalance,
} from '~/utils/organizer-miniapp'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface Dashboard {
  isManager: boolean
  myBookings: {
    id: number
    status: string
    event: { id: number; title: string; startsAt: string; venue: { name: string } | null }
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
const headerSubtitle = computed(() => organizerHomeSubtitle(orgId.value, org.value, me.value))
const isPending = computed(() => me.value?.status === 'pending')

const {
  data: dash,
  error: dashError,
  status: dashStatus,
  refresh: refreshDash,
} = await useFetch<Dashboard>(() => `/api/organizations/${orgId.value}/dashboard`, {
  key: () => `org-home-dashboard-${orgId.value}`,
})
const currentDash = computed(() =>
  org.value && dashStatus.value === 'success' && !dashError.value ? (dash.value ?? null) : null,
)
const home = computed(() =>
  projectOrganizerHome(orgId.value, org.value, me.value, currentDash.value),
)
const activeManager = computed(
  () =>
    !!org.value && me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)
const roleMismatch = computed(
  () => !!currentDash.value && currentDash.value.isManager !== activeManager.value,
)

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
    <VtMiniHeader :title="org?.name ?? 'Группа'" :sub="headerSubtitle" back="/m/orgs">
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

    <main class="px-4 py-4 space-y-5">
      <section v-if="accessState === 'denied'" class="vt-card p-5 space-y-3" role="alert">
        <h1 class="text-xl font-semibold">Доступ к группе закрыт</h1>
        <p class="text-sm text-vt-mute-2">Эта группа недоступна вашему аккаунту.</p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--primary">К доступным группам</NuxtLink>
      </section>

      <section v-else-if="accessState === 'suspended'" class="vt-card p-5 space-y-3" role="alert">
        <h1 class="text-xl font-semibold">Группа приостановлена</h1>
        <p class="text-sm text-vt-mute-2">Сейчас открыть эту группу нельзя.</p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--primary">К доступным группам</NuxtLink>
      </section>

      <section v-else-if="accessState === 'unauthorized'" class="vt-card p-5 space-y-3">
        <h1 class="text-xl font-semibold">Нужно войти</h1>
        <NuxtLink
          :to="`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`"
          class="vt-btn vt-btn--primary"
          >Войти по email</NuxtLink
        >
      </section>

      <ErrorState
        v-else-if="orgError || (orgStatus === 'success' && !org)"
        message="Не удалось открыть группу"
        @retry="refreshOrg()"
      />

      <SkeletonList v-else-if="!org" :count="3" />

      <div v-else-if="isPending" class="vt-card p-4" role="status">
        <VtChip tone="amber" dot>Заявка на рассмотрении</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">
          Организатор получил вашу заявку. Когда её одобрят, откроются события и запись.
        </p>
      </div>

      <template v-else-if="org">
        <ErrorState
          v-if="dashError"
          message="Не удалось загрузить данные группы"
          @retry="refreshDash()"
        />
        <SkeletonList v-else-if="dashStatus === 'pending'" :count="3" />
        <template v-else-if="dash && currentDash">
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

          <!-- игроку: мои ближайшие записи и абонемент -->
          <section v-if="!roleMismatch && !dash.isManager">
            <h2 class="vt-cap mb-2">Мои ближайшие записи</h2>
            <ul v-if="dash.myBookings.length" class="space-y-2">
              <li v-for="b in dash.myBookings" :key="b.id">
                <NuxtLink
                  :to="`${base}/events/${b.event.id}`"
                  class="vt-card p-3.5 flex items-center gap-3"
                >
                  <div class="w-14 text-center shrink-0">
                    <div class="vt-cap !text-[10px]">
                      {{ formatDay(b.event.startsAt, tz).split(',')[0] }}
                    </div>
                    <div class="vt-mono font-bold">{{ formatTime(b.event.startsAt, tz) }}</div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold truncate">{{ b.event.title }}</div>
                    <div class="text-xs text-vt-mute-2 truncate">
                      {{ formatDay(b.event.startsAt, tz) }}
                      <template v-if="b.event.venue"> · {{ b.event.venue.name }}</template>
                    </div>
                  </div>
                  <VtChip v-if="b.status === 'pending_payment'" tone="amber">Ждёт оплаты</VtChip>
                  <VtChip v-else-if="b.status === 'waitlisted'">В ожидании</VtChip>
                  <VtChip v-else tone="grass" dot>Записан</VtChip>
                </NuxtLink>
              </li>
            </ul>
            <EmptyState
              v-else
              icon="calendar"
              title="Вы ещё не записаны"
              description="Выберите ближайшую тренировку"
            >
              <template #action>
                <NuxtLink :to="`${base}/events`" class="vt-btn vt-btn--primary"
                  >К событиям</NuxtLink
                >
              </template>
            </EmptyState>
          </section>

          <NuxtLink
            v-if="!roleMismatch && !dash.isManager && org && dash.subscription"
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

          <section v-if="!roleMismatch && (!dash.isManager || home)">
            <div class="organizer-events-heading flex items-center justify-between mb-2">
              <h2 class="vt-cap">Ближайшие события</h2>
              <NuxtLink
                :to="`${base}/events`"
                class="organizer-all-link inline-flex items-center text-xs font-semibold text-vt-link"
                >Все</NuxtLink
              >
            </div>
            <EmptyState v-if="dash.upcoming.length === 0" icon="calendar" title="Событий пока нет">
              <template v-if="home" #action>
                <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
                  >Создать событие</NuxtLink
                >
              </template>
            </EmptyState>
            <ul v-else-if="home" class="divide-y divide-[var(--vt-stroke)]">
              <li v-for="ev in home.upcoming" :key="ev.id">
                <OrganizerEventRow :event="ev" :tz="tz" :to="`${base}/events/${ev.id}/manage`" />
              </li>
            </ul>
            <ul v-else class="space-y-2.5">
              <li v-for="ev in dash.upcoming.slice(0, 3)" :key="ev.id">
                <EventCard :event="ev" :tz="tz" :to="`${base}/events/${ev.id}`" />
              </li>
            </ul>
          </section>
        </template>
        <ErrorState v-else message="Не удалось загрузить данные группы" @retry="refreshDash()" />
      </template>
    </main>
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
