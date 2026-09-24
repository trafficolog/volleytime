<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { formatDay, formatShortDate, formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { formatMoneyRu } from '~/utils/labels'
import { canManageOrgSettingsUi, canViewOrgAuditUi } from '~/utils/organization-ui'
import { playerHomeAccess, projectPlayerHome } from '~/utils/player-home'
import { playerGroupOptions } from '~/utils/player-navigation'
import { createPlayerRequestGuard } from '~/utils/player-request-guard'
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
    balance: { currency: string; balance: number }
  } | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)

const {
  data: orgData,
  error: orgError,
  refresh: refreshOrg,
  pending: orgLoading,
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-home-${orgId.value}` })
const org = computed(() =>
  !orgError.value && orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
const me = computed(() => (org.value ? (orgData.value?.myMember ?? null) : null))
const access = computed(() =>
  playerHomeAccess(orgId.value, org.value, me.value, apiErrorCode(orgError.value)),
)
const isManager = computed(
  () => me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)
const canViewAudit = computed(() => canViewOrgAuditUi(me.value))
const canManageSettings = computed(() => canManageOrgSettingsUi(me.value))
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
const dash = computed(() => (dashboardOrgId.value === orgId.value ? dashboard.value : null))
const playerHome = computed(() => projectPlayerHome(dash.value?.upcoming ?? [], new Date()))

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
  orgId,
  (id) => {
    if (import.meta.client) window.localStorage.setItem('vt.lastOrgId', String(id))
  },
  { immediate: true },
)

const base = computed(() => `/m/orgs/${orgId.value}`)
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader
      v-if="isManager"
      :title="org?.name ?? 'Группа'"
      :sub="org?.city ?? undefined"
      back="/m/orgs"
    >
      <template #right>
        <NuxtLink
          v-if="dash?.isManager"
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
          <img src="/logo.png" alt="" class="!object-contain p-1" />
        </span>
        <span class="min-w-0">
          <span class="font-semibold text-[15px] truncate flex items-center gap-1">
            {{ org?.name ?? 'Группа' }} <VtIcon name="chevron-r" :size="14" class="rotate-90" />
          </span>
          <span v-if="org?.city" class="block text-xs text-vt-mute-2 truncate">{{ org.city }}</span>
        </span>
      </button>
      <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--sm" aria-label="Мои группы">
        <VtIcon name="users" :size="18" />
      </NuxtLink>
    </header>

    <main class="px-4 py-4 space-y-6">
      <ErrorState
        v-if="orgError && access !== 'suspended'"
        message="Не удалось открыть группу"
        @retry="refreshOrg()"
      />

      <SkeletonList v-else-if="orgLoading || access === 'loading'" :count="2" />

      <div v-else-if="access === 'suspended'" class="vt-card p-4" role="status">
        <VtChip tone="rose" dot>Группа приостановлена</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">Запись и покупки сейчас недоступны.</p>
      </div>

      <div v-else-if="access === 'pending'" class="vt-card p-4" role="status">
        <VtChip tone="amber" dot>Заявка на рассмотрении</VtChip>
        <p class="text-sm text-vt-mute-2 mt-2">
          Организатор получил вашу заявку. Когда её одобрят, откроются события и запись.
        </p>
      </div>

      <ErrorState
        v-else-if="access === 'denied'"
        message="Доступ в группу закрыт"
        @retry="refreshOrg()"
      />

      <template v-else>
        <ErrorState v-if="dashError" :message="dashError" @retry="refreshDash()" />
        <SkeletonList v-else-if="dashLoading || !dash" :count="3" />
        <template v-else-if="dash">
          <!-- организатору: деньги -->
          <section v-if="dash.manager" class="grid grid-cols-2 gap-2.5">
            <NuxtLink :to="`${base}/payments`" class="vt-card p-3.5">
              <div class="vt-cap">Ждут подтверждения</div>
              <div class="vt-mono text-2xl font-bold mt-1">{{ dash.manager.pendingCount }}</div>
              <div class="text-xs text-vt-mute-2">
                {{ formatMoneyRu(dash.manager.pendingAmount, dash.manager.balance.currency) }}
              </div>
            </NuxtLink>
            <NuxtLink :to="`${base}/cashbox`" class="vt-card p-3.5">
              <div class="vt-cap">Касса</div>
              <div
                class="vt-mono text-2xl font-bold mt-1"
                :class="dash.manager.balance.balance < 0 ? 'text-vt-rose-ink' : ''"
              >
                {{ formatMoneyRu(dash.manager.balance.balance, dash.manager.balance.currency) }}
              </div>
              <div class="text-xs text-vt-mute-2">баланс группы</div>
            </NuxtLink>
          </section>

          <section v-if="!dash.isManager" class="space-y-3">
            <h2 class="text-[30px] leading-none">Ближайшая игра</h2>
            <div v-if="playerHome.hero" class="grid grid-cols-2 gap-3">
              <NuxtLink
                :to="`${base}/events/${playerHome.hero.id}`"
                class="vt-card vt-card--hero col-span-2 p-5 min-h-52 flex flex-col"
              >
                <div class="vt-cap !text-white/75">
                  {{ formatDay(playerHome.hero.startsAt, tz) }}
                </div>
                <div class="vt-mono text-5xl leading-none mt-3">
                  {{ formatTime(playerHome.hero.startsAt, tz) }}
                </div>
                <div class="font-display font-bold text-xl uppercase mt-3">
                  {{ playerHome.hero.title }}
                </div>
                <div
                  v-if="playerHome.hero.venue || playerHome.hero.locationText"
                  class="text-sm text-white/75 mt-1"
                >
                  {{ playerHome.hero.venue?.name ?? playerHome.hero.locationText }}
                </div>
                <div class="mt-auto pt-5">
                  <div class="h-1.5 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
                    <span
                      class="block h-full rounded-full bg-vt-orange"
                      :style="{
                        width: `${Math.min(100, Math.max(0, (playerHome.hero.taken / Math.max(1, playerHome.hero.capacity)) * 100))}%`,
                      }"
                    />
                  </div>
                  <div class="flex justify-between items-center gap-2 mt-2 text-sm">
                    <span class="text-white/75">Занято мест</span>
                    <span class="vt-mono"
                      >{{ playerHome.hero.taken }}/{{ playerHome.hero.capacity }}</span
                    >
                  </div>
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="dash.subscription"
                :to="`${base}/subscriptions`"
                class="vt-card vt-card--warm p-4 min-h-28 flex flex-col justify-between"
              >
                <div class="vt-cap">Абонемент</div>
                <div class="vt-mono text-2xl">
                  {{ dash.subscription.left }}/{{ dash.subscription.total }}
                </div>
                <div class="text-xs text-vt-mute-2">занятий осталось</div>
              </NuxtLink>
              <NuxtLink
                :to="`${base}/bookings`"
                class="vt-card p-4 min-h-28 flex flex-col justify-between"
                :class="dash.subscription ? '' : 'col-span-2'"
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
          <section v-if="!dash.isManager || dash.myBookings.length">
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
            v-if="dash.isManager && dash.subscription"
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

          <section>
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-display font-bold text-xl uppercase">
                {{ dash.isManager ? 'Ближайшие события' : 'Расписание' }}
              </h2>
              <NuxtLink
                :to="`${base}/events`"
                class="text-sm font-semibold text-vt-link min-h-11 inline-flex items-center"
                >Все события</NuxtLink
              >
            </div>
            <EmptyState v-if="dash.upcoming.length === 0" icon="calendar" title="Событий пока нет">
              <template v-if="dash.isManager" #action>
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
            <ul v-else class="space-y-3">
              <li
                v-for="ev in dash.isManager ? dash.upcoming.slice(0, 3) : playerHome.schedule"
                :key="ev.id"
              >
                <EventCard :event="ev" :tz="tz" :to="`${base}/events/${ev.id}`" />
              </li>
            </ul>
          </section>

          <section v-if="dash.isManager">
            <h2 class="vt-cap mb-2">Управление</h2>
            <nav class="grid grid-cols-3 gap-2.5">
              <NuxtLink :to="`${base}/events/new`" class="vt-card p-3 text-center">
                <VtIcon name="plus" :size="18" />
                <div class="mt-1.5 text-xs font-semibold">Событие</div>
              </NuxtLink>
              <NuxtLink
                v-if="org?.subscriptionsEnabled === true"
                :to="`${base}/plans`"
                class="vt-card p-3 text-center"
              >
                <VtIcon name="ticket" :size="18" />
                <div class="mt-1.5 text-xs font-semibold">Планы</div>
              </NuxtLink>
              <NuxtLink :to="`${base}/members`" class="vt-card p-3 text-center">
                <VtIcon name="users" :size="18" />
                <div class="mt-1.5 text-xs font-semibold">Игроки</div>
              </NuxtLink>
              <NuxtLink v-if="canViewAudit" :to="`${base}/audit`" class="vt-card p-3 text-center">
                <VtIcon name="chart" :size="18" />
                <div class="mt-1.5 text-xs font-semibold">Журнал</div>
              </NuxtLink>
              <NuxtLink
                v-if="canManageSettings"
                :to="`${base}/settings`"
                class="vt-card p-3 text-center"
              >
                <VtIcon name="settings" :size="18" />
                <div class="mt-1.5 text-xs font-semibold">Настройки</div>
              </NuxtLink>
            </nav>
          </section>
        </template>
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
