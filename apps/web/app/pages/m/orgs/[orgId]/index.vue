<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { formatDay, formatShortDate, formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { groupEntryState, visibleGroup } from '~/utils/group-entry-state'
import { formatMoneyRu } from '~/utils/labels'
import { canManageOrgSettingsUi, canViewOrgAuditUi } from '~/utils/organization-ui'
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
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`)
const org = computed(() => visibleGroup(orgData.value?.organization, orgError.value, orgId.value))
const accessState = computed(() =>
  orgError.value
    ? groupEntryState(apiErrorStatus(orgError.value), apiErrorCode(orgError.value))
    : null,
)
const me = computed(() => (org.value ? (orgData.value?.myMember ?? null) : null))
const isPending = computed(() => me.value?.status === 'pending')
const canViewAudit = computed(() => canViewOrgAuditUi(me.value))
const canManageSettings = computed(() => canManageOrgSettingsUi(me.value))

const {
  data: dash,
  error: dashError,
  refresh: refreshDash,
} = await useFetch<Dashboard>(() => `/api/organizations/${orgId.value}/dashboard`, {
  immediate: true,
})

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
      :title="!orgError && org ? org.name : 'Группа'"
      :sub="!orgError && org ? (org.city ?? undefined) : undefined"
      back="/m/orgs"
    >
      <template #right>
        <NuxtLink
          v-if="!orgError && org && dash?.isManager"
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

      <ErrorState v-else-if="orgError" message="Не удалось открыть группу" @retry="refreshOrg()" />

      <div v-else-if="!org" role="status" class="text-vt-mute-2">Открываем группу…</div>

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
            v-if="org && dash.subscription"
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
              <h2 class="vt-cap">Ближайшие события</h2>
              <NuxtLink :to="`${base}/events`" class="text-xs font-semibold text-vt-link"
                >Все</NuxtLink
              >
            </div>
            <EmptyState v-if="dash.upcoming.length === 0" icon="calendar" title="Событий пока нет">
              <template v-if="dash.isManager" #action>
                <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
                  >Создать событие</NuxtLink
                >
              </template>
            </EmptyState>
            <ul v-else class="space-y-2.5">
              <li v-for="ev in dash.upcoming.slice(0, 3)" :key="ev.id">
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
  </div>
</template>
