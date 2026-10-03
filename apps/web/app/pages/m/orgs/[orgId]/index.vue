<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { formatDay, formatShortDate, formatTime, type EventPricingView } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { eventPricingLabel, splitBookingPaymentLabel } from '~/utils/event-pricing-label'
import { groupEntryState, visibleGroup } from '~/utils/group-entry-state'
import { formatMoneyRu } from '~/utils/labels'
import {
  organizerHomeSubtitle,
  projectOrganizerHome,
  type OrganizerBalance,
} from '~/utils/organizer-miniapp'
import { playerHomeAccess, projectPlayerHome } from '~/utils/player-home'
import { playerGroupOptions } from '~/utils/player-navigation'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface Dashboard {
  isManager: boolean
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
const { orgs, loading: groupsLoading, fetchAll, selectOrg } = useOrganizations()
const groupsOpen = ref(false)
const groupsError = ref('')
const groupOptions = computed(() => playerGroupOptions(orgs.value, orgId.value))

async function openGroups() {
  groupsOpen.value = true
  groupsError.value = ''
  try {
    await fetchAll()
  } catch (error) {
    groupsError.value = apiErrorMessage(error, 'Не удалось загрузить группы')
  }
}

function chooseGroup(group: { id: number; selectable: boolean }) {
  if (group.selectable) selectOrg(group.id)
  groupsOpen.value = false
}

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
const playerHome = computed(() => projectPlayerHome(dash.value?.upcoming ?? [], new Date()))
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
        @click="openGroups"
      >
        <span class="vt-avi vt-avi--lg !rounded-xl bg-vt-bone" aria-hidden="true">
          <img :src="'/logo.png'" alt="" class="!object-contain p-1" />
        </span>
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
            <h2 class="text-[30px] leading-none">Ближайшая игра</h2>
            <div v-if="playerHome.hero" class="grid grid-cols-[1.3fr_1fr] grid-rows-2 gap-3">
              <NuxtLink
                :to="`${base}/events/${playerHome.hero.id}`"
                class="vt-card vt-card--hero row-span-2 p-[18px] min-h-48 flex flex-col"
              >
                <div class="vt-cap !text-white/75">
                  {{ formatDay(playerHome.hero.startsAt, tz) }}
                </div>
                <div class="vt-mono text-[52px] font-bold leading-[0.9] mt-3">
                  {{ formatTime(playerHome.hero.startsAt, tz) }}
                </div>
                <div class="font-semibold text-sm mt-2">
                  {{ playerHome.hero.title }}
                </div>
                <div v-if="playerHome.hero.pricing" class="text-xs text-white/90 mt-2">
                  {{ eventPricingLabel(playerHome.hero.pricing, playerHome.hero.currency).text }}
                </div>
                <p
                  v-if="
                    playerHome.hero.pricing?.mode === 'split' &&
                    playerHome.hero.pricing.basis !== 'settled'
                  "
                  class="text-[11px] text-white/75 mt-1"
                >
                  {{
                    eventPricingLabel(playerHome.hero.pricing, playerHome.hero.currency).description
                  }}
                </p>
                <div
                  v-if="playerHome.hero.venue || playerHome.hero.locationText"
                  class="text-xs text-white/75 mt-1"
                >
                  {{ playerHome.hero.venue?.name ?? playerHome.hero.locationText }}
                </div>
                <div class="mt-auto pt-4">
                  <div class="h-1.5 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
                    <span
                      class="block h-full rounded-full bg-vt-orange"
                      :style="{
                        width: `${Math.min(100, Math.max(0, (playerHome.hero.taken / Math.max(1, playerHome.hero.capacity)) * 100))}%`,
                      }"
                    />
                  </div>
                  <div class="flex justify-between items-center gap-2 mt-2 text-xs">
                    <span class="text-white/75">Занято мест</span>
                    <span class="vt-mono text-[15px] font-bold"
                      >{{ playerHome.hero.taken }}/{{ playerHome.hero.capacity }}</span
                    >
                  </div>
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="dash.subscription"
                :to="`${base}/subscriptions`"
                class="vt-card vt-card--warm p-4 flex flex-col justify-between"
              >
                <VtIcon name="ticket" :size="18" class="text-[#a33c08]" />
                <div class="vt-mono text-[32px] font-bold leading-none mt-1">
                  {{ dash.subscription.left }}/{{ dash.subscription.total }}
                </div>
                <div class="text-xs text-vt-mute-2">занятий осталось</div>
              </NuxtLink>
              <NuxtLink
                :to="`${base}/bookings`"
                class="vt-card p-4 flex flex-col justify-between"
                :class="dash.subscription ? '' : 'row-span-2'"
              >
                <VtIcon name="ticket" :size="20" />
                <div class="font-semibold">Мои записи</div>
                <div class="text-xs text-vt-mute-2">Предстоящие и прошедшие</div>
              </NuxtLink>
            </div>
            <EmptyState
              v-else
              icon="calendar"
              title="Тренировок пока нет"
              description="Организатор ещё не опубликовал расписание"
            />
          </section>

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
                    <div v-if="b.pricing && b.event.currency" class="vt-mono text-xs mt-1">
                      {{ eventPricingLabel(b.pricing, b.event.currency).text }}
                    </div>
                    <p
                      v-if="
                        b.pricing?.mode === 'split' &&
                        b.pricing.basis !== 'settled' &&
                        b.event.currency
                      "
                      class="text-xs text-vt-mute-2 mt-1"
                    >
                      {{ eventPricingLabel(b.pricing, b.event.currency).description }}
                    </p>
                    <p
                      v-if="b.status === 'waitlisted' && b.pricing?.mode === 'split'"
                      class="text-xs text-vt-mute-2 mt-1"
                    >
                      {{ splitBookingPaymentLabel(b.pricing, b.status)?.description }}
                    </p>
                  </div>
                  <VtChip
                    v-if="b.pricing && splitBookingPaymentLabel(b.pricing, b.status)"
                    :tone="splitBookingPaymentLabel(b.pricing, b.status)!.tone"
                    >{{ splitBookingPaymentLabel(b.pricing, b.status)!.text }}</VtChip
                  >
                  <VtChip v-else-if="b.status === 'pending_payment'" tone="amber"
                    >Ждёт оплаты</VtChip
                  >
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

          <section v-if="!roleMismatch && (!dash.isManager || home)">
            <div class="organizer-events-heading flex items-center justify-between mb-2">
              <h2 :class="home ? 'vt-cap' : 'font-display font-bold text-xl uppercase'">
                {{ home ? 'Ближайшие события' : 'Расписание' }}
              </h2>
              <NuxtLink
                :to="`${base}/events`"
                class="organizer-all-link vt-hit-44 inline-flex items-center text-sm font-semibold text-vt-link"
                >{{ home ? 'Все' : 'Все события' }}</NuxtLink
              >
            </div>
            <EmptyState v-if="dash.upcoming.length === 0" icon="calendar" title="Событий пока нет">
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

    <VtSheet v-model="groupsOpen" title="Мои группы">
      <SkeletonList v-if="groupsLoading" :count="2" />
      <ErrorState v-else-if="groupsError" :message="groupsError" @retry="openGroups" />
      <ul v-else class="space-y-3">
        <li v-for="group in groupOptions" :key="group.id">
          <NuxtLink
            :to="group.to"
            class="vt-card p-4 flex items-center gap-3 min-h-11"
            :aria-current="group.selected ? 'true' : undefined"
            @click="chooseGroup(group)"
          >
            <VtIcon :name="group.selected ? 'check' : 'users'" :size="18" />
            <span class="min-w-0 flex-1">
              <span class="block font-semibold truncate">{{ group.name }}</span>
              <span
                v-if="group.statusLabel || group.city"
                class="block text-xs text-vt-mute-2 mt-1"
              >
                {{ group.statusLabel ?? group.city }}
              </span>
            </span>
            <VtIcon name="chevron-r" :size="16" />
          </NuxtLink>
        </li>
      </ul>
      <NuxtLink
        to="/m/orgs"
        class="vt-btn vt-btn--ghost vt-btn--full mt-4"
        @click="groupsOpen = false"
      >
        Вступить по приглашению
      </NuxtLink>
    </VtSheet>
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
