<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import GroupLogo from '~/components/GroupLogo.vue'
import VtSegment from '~/components/vt/Segment.vue'
import {
  defaultNearbyLevel,
  nearbyGroupPath,
  nearbyLevelLabel,
  nearbyLevelOptions,
  nearbyPlace,
  nearbyPrice,
  nearbyQuery,
  nearbySeats,
  nearbyWhen,
  type NearbyGame,
} from '~/utils/nearby-games'
import { levelTitle, type PlayerLevelView } from '~/utils/player-level'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

// «Открытые игры рядом» (30.3.3, M-32): лента открытых игр других публичных групп города группы,
// в которой игрок сейчас. Фильтр «мой уровень» — по уровню игрока в этой группе; запись — на
// странице группы по её правилам, здесь ничего не бронируется.
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)

const { data: orgData } = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-profile-${orgId.value}` })
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const levels = computed(() => levelsData.value?.levels ?? [])
const city = computed(() => orgData.value?.organization?.city?.trim() ?? '')
const myLevel = computed(() => orgData.value?.myMember?.level ?? null)
const myLevelName = computed(() => levelTitle(myLevel.value, levels.value))
const options = computed(() => nearbyLevelOptions(levels.value))

const level = ref(defaultNearbyLevel(myLevel.value))
const games = ref<NearbyGame[]>([])
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
// ответы приходят не по порядку: учитывается только последний запрос
let requestId = 0

async function load(more = false) {
  if (!city.value) return
  const id = ++requestId
  error.value = ''
  if (more) loadingMore.value = true
  else loading.value = true
  try {
    const res = await $fetch<{ games: NearbyGame[]; hasMore: boolean }>('/api/me/nearby-games', {
      query: nearbyQuery(city.value, level.value, more ? games.value.length : 0),
    })
    if (id !== requestId) return
    games.value = more ? [...games.value, ...res.games] : res.games
    hasMore.value = res.hasMore
  } catch (cause) {
    if (id !== requestId) return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить игры')
  } finally {
    if (id === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

watch(level, () => load())
await load()
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader
      title="Открытые игры рядом"
      :sub="city ? `${city} · публичные события других групп` : undefined"
      :back="`${base}/profile`"
    />
    <main class="space-y-4 px-4 py-4">
      <EmptyState
        v-if="!city"
        icon="pin"
        title="У группы не указан город"
        description="Организатор может указать город в настройках группы: тогда здесь появятся игры рядом."
        data-testid="nearby-no-city"
      />
      <template v-else>
        <section aria-labelledby="nearby-level-title" class="space-y-2">
          <h2 id="nearby-level-title" class="vt-cap px-1 text-vt-mute-2">Мой уровень</h2>
          <VtSegment
            v-model="level"
            :options="options"
            variant="chips"
            label="Уровень игры"
            data-testid="nearby-levels"
          />
          <p class="px-1 text-xs text-vt-mute-2" data-testid="nearby-level-hint">
            <template v-if="myLevelName">Ваш уровень: {{ myLevelName }}. </template>
            С выбранным уровнем показаны и игры без ограничения по уровню.
          </p>
        </section>

        <SkeletonList v-if="loading && !games.length" :count="3" />
        <ErrorState v-else-if="error && !games.length" :message="error" @retry="load()" />
        <EmptyState
          v-else-if="!games.length"
          icon="calendar"
          title="Открытых игр рядом пока нет"
          description="Попробуйте другой уровень или загляните позже."
          data-testid="nearby-empty"
        />
        <ul v-else class="divide-y divide-vt-stroke" aria-label="Открытые игры">
          <li v-for="game in games" :key="game.id">
            <NuxtLink
              :to="nearbyGroupPath(game)"
              class="block min-h-11 py-3.5"
              data-testid="nearby-game"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span class="min-w-0 truncate text-[15px] font-bold">{{ game.title }}</span>
                <span
                  v-if="nearbyPrice(game)"
                  class="vt-mono shrink-0 text-sm font-semibold"
                  data-testid="nearby-price"
                  >{{ nearbyPrice(game) }}</span
                >
              </span>
              <span class="mt-0.5 block text-sm text-vt-mute-2">
                {{ nearbyWhen(game) }}{{ nearbyPlace(game) ? ` · ${nearbyPlace(game)}` : '' }}
              </span>
              <span class="mt-2 flex flex-wrap items-center gap-1.5">
                <GroupLogo
                  :org-id="game.group.id"
                  :name="game.group.name"
                  :logo-updated-at="game.group.logoUpdatedAt"
                  size-class="h-5 w-5 text-[10px]"
                />
                <VtChip
                  >{{ game.group.name
                  }}{{ game.group.district ? ` · ${game.group.district}` : '' }}</VtChip
                >
                <VtChip>{{ nearbyLevelLabel(game, levels) }}</VtChip>
                <VtChip :tone="game.full ? 'rose' : 'grass'">{{ nearbySeats(game) }}</VtChip>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <p v-if="error && games.length" class="px-1 text-sm text-vt-rose-ink" role="alert">
          {{ error }}
        </p>
        <button
          v-if="hasMore"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          data-testid="nearby-more"
          :disabled="loadingMore"
          @click="load(true)"
        >
          Показать ещё
        </button>
        <p
          class="flex gap-2 rounded-[var(--r-chip)] bg-vt-bone px-3 py-2.5 text-xs leading-snug text-vt-mute-2"
          data-testid="nearby-note"
        >
          <VtIcon name="globe" :size="13" class="mt-px shrink-0" aria-hidden="true" />
          <span
            >Здесь только события, которые группы сами сделали публичными. Запись идёт по правилам
            группы.</span
          >
        </p>
      </template>
    </main>
  </div>
</template>
