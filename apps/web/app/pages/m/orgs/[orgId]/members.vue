<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'

import type { MemberRow } from '~/composables/useOrganizations'
import { countPlayerTabs, filterPlayers } from '~/utils/desktop-players'
import {
  activityView,
  debtView,
  playerStatsPeriodLabel,
  subscriptionView,
} from '~/utils/desktop-players-stats'
import { ROLE_LABELS, displayName, label } from '~/utils/labels'
import {
  MINIAPP_FETCH_STATUSES,
  MINIAPP_PLAYER_TABS,
  playersSummary,
  type MiniappPlayersTab,
} from '~/utils/miniapp-players'
import {
  LEVEL_FILTER_ALL,
  levelFilterOptions,
  levelTitle,
  type PlayerLevelView,
} from '~/utils/player-level'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { members, statsPeriod, loading, error, fetch } = useMembers(orgId)
const { tz } = useOrgTimezone(orgId)
const { confirm } = useTelegram()

const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const levels = computed(() => levelsData.value?.levels ?? [])
const me = computed(() => orgData.value?.myMember ?? null)
const isManager = computed(
  () => me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)

const segment = ref<MiniappPlayersTab>('active')
const SEGMENTS = MINIAPP_PLAYER_TABS
const query = ref('')

const levelFilter = ref(LEVEL_FILTER_ALL)
const levelOptions = computed(() => levelFilterOptions(levels.value))
const counts = computed(() => countPlayerTabs(members.value))
const pendingCount = computed(() => counts.value.pending)
/** Агрегаты (21.2.20) есть только у управляющего; окно посещаемости — в подписи сводки. */
const showStats = computed(() => isManager.value && statsPeriod.value !== null)
const summary = computed(() => playersSummary(members.value))
/** Вкладка → поиск → уровень; заявки показываются без фильтра по уровню. */
const visibleMembers = computed(() =>
  filterPlayers(members.value, {
    tab: segment.value,
    query: query.value,
    level: segment.value === 'pending' ? LEVEL_FILTER_ALL : levelFilter.value,
  }),
)
const filtered = computed(
  () =>
    query.value.trim() !== '' ||
    (segment.value !== 'pending' && levelFilter.value !== LEVEL_FILTER_ALL),
)

/** Управляющий получает весь состав с агрегатами одним запросом; вкладки — на клиенте. */
async function load() {
  if (isManager.value) await fetch([...MINIAPP_FETCH_STATUSES], { stats: true })
  else await fetch(['active'])
}
await load()

const ROLE_TONE: Record<string, 'solid' | 'flame' | 'default'> = {
  owner: 'solid',
  organizer: 'flame',
}

/** Может ли текущий пользователь модерировать участника (зеркало политики canModerate). */
function canModerate(m: MemberRow): boolean {
  if (!isManager.value || !me.value || m.role === 'owner' || m.user.id === me.value.userId)
    return false
  return me.value.role === 'owner' || m.role === 'player' || m.role === 'assistant'
}

const busy = ref<number | null>(null)
const actionError = ref('')
const sheetFor = ref<MemberRow | null>(null)
const rowStats = (m: MemberRow) => (showStats.value && m.stats ? m.stats : null)

const sheetOpen = computed({
  get: () => sheetFor.value !== null,
  set: (v) => {
    if (!v) sheetFor.value = null
  },
})

async function act(m: MemberRow, action: 'approve' | 'reject' | 'block' | 'unblock') {
  if (action === 'block' && !(await confirm(`Заблокировать ${displayName(m.user)}?`))) return
  busy.value = m.id
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/members/${m.id}/${action}`, { method: 'POST' })
    sheetFor.value = null
    await load()
  } catch (e) {
    actionError.value = apiErrorMessage(e)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="Игроки" :back="`/m/orgs/${orgId}`">
      <template v-if="isManager" #right>
        <div class="flex items-center gap-1">
          <NuxtLink
            :to="`/m/orgs/${orgId}/reports`"
            class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44 !px-2"
            aria-label="Отчёт за месяц"
          >
            <VtIcon name="chart" :size="16" />
          </NuxtLink>
          <NuxtLink
            :to="`/m/orgs/${orgId}/invite`"
            class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
            aria-label="Пригласить"
          >
            <VtIcon name="plus" :size="16" />
          </NuxtLink>
        </div>
      </template>
    </VtMiniHeader>

    <div v-if="isManager" class="px-4 pt-2 flex gap-1" role="tablist">
      <button
        v-for="s in SEGMENTS"
        :key="s.id"
        type="button"
        role="tab"
        :aria-selected="segment === s.id"
        class="vt-btn vt-btn--sm flex-1 !rounded-full"
        :class="segment === s.id ? 'vt-btn--ink' : 'text-vt-mute-2'"
        @click="segment = s.id"
      >
        {{ s.label }}
        <span
          v-if="s.id === 'pending' && pendingCount > 0"
          class="text-[10px] px-1.5 rounded-full"
          :class="segment === s.id ? 'bg-white/20' : 'bg-vt-amber text-[#0e0e10]'"
          >{{ pendingCount }}</span
        >
        <span
          v-else-if="s.id !== 'pending'"
          class="text-[10px] px-1.5 rounded-full"
          :class="segment === s.id ? 'bg-white/20' : 'bg-vt-bone-2'"
          >{{ counts[s.id] }}</span
        >
      </button>
    </div>

    <main class="px-4 py-3">
      <p v-if="actionError" class="mb-3 text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <p v-if="segment === 'pending'" class="text-[12.5px] text-vt-mute-2 px-1 pb-3">
        Заявки на вступление по приглашению. Примите, чтобы открыть доступ к событиям.
      </p>
      <ul
        v-if="showStats && segment !== 'pending' && !loading && !error"
        class="grid grid-cols-3 gap-1.5 pb-3.5"
        aria-label="Сводка по игрокам"
        :title="statsPeriod ? playerStatsPeriodLabel(statsPeriod) : undefined"
      >
        <li class="vt-card px-2 py-2.5 text-center">
          <strong class="vt-mono block text-lg" data-summary="active">{{ summary.active }}</strong>
          <span class="vt-cap text-[10px] text-vt-mute-2">активных</span>
        </li>
        <li class="vt-card px-2 py-2.5 text-center">
          <strong class="vt-mono block text-lg" data-summary="subscription">{{
            summary.withSubscription
          }}</strong>
          <span class="vt-cap text-[10px] text-vt-mute-2">с абон.</span>
        </li>
        <li class="vt-card px-2 py-2.5 text-center">
          <strong
            class="vt-mono block text-lg"
            :class="{ 'text-vt-rose-ink': (summary.withDebt ?? 0) > 0 }"
            data-summary="debt"
            >{{ summary.withDebt }}</strong
          >
          <span class="vt-cap text-[10px] text-vt-mute-2">с долгом</span>
        </li>
      </ul>
      <div v-if="members.length > 0 && !loading && !error" class="pb-3">
        <label class="sr-only" for="m-players-search">Поиск по имени</label>
        <input
          id="m-players-search"
          v-model="query"
          class="vt-field w-full"
          type="search"
          placeholder="Поиск по имени"
          autocomplete="off"
        />
      </div>
      <div v-if="segment !== 'pending' && members.length > 0" class="pb-3 -mx-1 overflow-x-auto">
        <VtSegment
          v-model="levelFilter"
          :options="levelOptions"
          label="Фильтр по уровню"
          variant="chips"
        />
      </div>

      <SkeletonList v-if="loading" :count="4" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState
        v-else-if="visibleMembers.length === 0"
        icon="users"
        :title="
          query.trim() !== ''
            ? 'Никого не нашли'
            : filtered
              ? 'Нет игроков с этим уровнем'
              : segment === 'pending'
                ? 'Новых заявок нет'
                : segment === 'all'
                  ? 'Игроков пока нет'
                  : 'В составе пока никого'
        "
      />

      <ul v-else-if="segment === 'pending'" class="space-y-2.5">
        <li v-for="m in visibleMembers" :key="m.id" class="vt-card p-3.5 flex items-center gap-3">
          <VtAvatar :name="displayName(m.user)" :src="m.user.image" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold truncate">{{ displayName(m.user) }}</div>
            <div class="text-[11.5px] text-vt-mute-2">заявка по приглашению</div>
          </div>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="busy === m.id"
            @click="act(m, 'reject')"
          >
            Отклонить
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--sm"
            :disabled="busy === m.id"
            @click="act(m, 'approve')"
          >
            Принять
          </button>
        </li>
      </ul>

      <ul v-else class="vt-card overflow-hidden divide-y divide-[var(--vt-stroke)]">
        <li v-for="m in visibleMembers" :key="m.id">
          <component
            :is="canModerate(m) ? 'button' : 'div'"
            :type="canModerate(m) ? 'button' : undefined"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
            :aria-label="canModerate(m) ? `Действия: ${displayName(m.user)}` : undefined"
            @click="canModerate(m) && (sheetFor = m)"
          >
            <VtAvatar :name="displayName(m.user)" :src="m.user.image" />
            <div class="flex-1 min-w-0">
              <div class="text-[13.5px] font-semibold truncate">{{ displayName(m.user) }}</div>
              <div class="text-[11px] text-vt-mute-2 truncate">
                {{
                  levelTitle(m.level, levels)
                    ? `уровень ${levelTitle(m.level, levels)}`
                    : 'уровень не назначен'
                }}<template v-if="rowStats(m)">
                  · {{ activityView(rowStats(m)!, tz).last }}</template
                ><template v-if="m.user.telegramUsername && m.user.name">
                  · @{{ m.user.telegramUsername }}</template
                >
              </div>
            </div>
            <div v-if="rowStats(m)" class="text-right" data-col="visits">
              <div class="vt-mono text-sm font-semibold">
                {{ rowStats(m)!.attendance.visits }}
              </div>
              <div class="vt-cap text-[10px] text-vt-mute-2">трен.</div>
            </div>
            <VtChip v-if="rowStats(m) && debtView(rowStats(m)!)" tone="rose" data-col="debt"
              >−{{ debtView(rowStats(m)!)!.label }}</VtChip
            >
            <VtChip v-else-if="rowStats(m) && subscriptionView(rowStats(m)!, tz)" data-col="sub">{{
              subscriptionView(rowStats(m)!, tz)!.label
            }}</VtChip>
            <VtChip
              v-if="m.status !== 'active'"
              :tone="m.status === 'pending' ? 'amber' : 'default'"
              >{{
                m.status === 'pending' ? 'Заявка' : m.status === 'guest' ? 'Гость' : 'Заблокирован'
              }}</VtChip
            >
            <VtChip v-if="m.role !== 'player'" :tone="ROLE_TONE[m.role] ?? 'default'">{{
              label(ROLE_LABELS, m.role)
            }}</VtChip>
            <VtIcon v-if="canModerate(m)" name="more" :size="14" class="text-vt-mute" />
          </component>
        </li>
      </ul>
    </main>

    <VtSheet v-model="sheetOpen" :title="sheetFor ? displayName(sheetFor.user) : ''">
      <div v-if="sheetFor" class="flex flex-col gap-2">
        <template v-if="sheetFor.status === 'pending'">
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--full"
            :disabled="busy === sheetFor.id"
            @click="act(sheetFor, 'approve')"
          >
            Принять
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--full"
            :disabled="busy === sheetFor.id"
            @click="act(sheetFor, 'reject')"
          >
            Отклонить
          </button>
        </template>
        <button
          v-if="sheetFor.status === 'blocked'"
          type="button"
          class="vt-btn vt-btn--primary vt-btn--full"
          :disabled="busy === sheetFor.id"
          @click="act(sheetFor, 'unblock')"
        >
          Разблокировать
        </button>
        <button
          v-else
          type="button"
          class="vt-btn vt-btn--danger vt-btn--full"
          :disabled="busy === sheetFor.id"
          @click="act(sheetFor, 'block')"
        >
          Заблокировать
        </button>
      </div>
    </VtSheet>
  </div>
</template>
