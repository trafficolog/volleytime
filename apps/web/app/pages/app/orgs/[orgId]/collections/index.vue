<script setup lang="ts">
import type { Organization } from '@volley-time/db'
import { DEFAULT_TIMEZONE, formatShortDate } from '@volley-time/shared'

import {
  COLLECTION_STATUS_LABELS,
  collectionProgress,
  collectionTotals,
  type DesktopCollection,
} from '~/utils/desktop-collections'
import { formatMoneyRu } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

interface CollectionsPage {
  collections: DesktopCollection[]
  nextCursor: string | null
}
const PAGE_LIMIT = 100
const MAX_PAGES = 10
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { data: orgData, error: orgError } = await useFetch<{
  organization: Organization
  capabilities?: { collections?: boolean }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-org-${orgId.value}` })
const org = computed(() =>
  !orgError.value && orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
/** Создание доступно только при явном `capabilities.collections === true`. */
const canCreate = computed(
  () => org.value !== null && orgData.value?.capabilities?.collections === true,
)
const tz = computed(() => org.value?.defaultTimezone ?? DEFAULT_TIMEZONE)
const items = ref<DesktopCollection[]>([])
const truncated = ref(false)
const loading = ref(false)
const loadError = ref('')
const totals = computed(() => collectionTotals(items.value))
const currency = computed(() => org.value?.defaultCurrency ?? items.value[0]?.currency ?? 'BYN')
let generation = 0
let alive = true

async function load() {
  const token = ++generation
  const target = orgId.value
  loading.value = true
  loadError.value = ''
  truncated.value = false
  items.value = []
  try {
    const collected: DesktopCollection[] = []
    let cursor: string | null = null
    for (let page = 0; page < MAX_PAGES; page++) {
      const query: Record<string, string | number> = { limit: PAGE_LIMIT }
      if (cursor) query.cursor = cursor
      const result = await $fetch<CollectionsPage>(`/api/organizations/${target}/collections`, {
        query,
      })
      if (!alive || token !== generation || orgId.value !== target) return
      collected.push(...result.collections)
      cursor = result.nextCursor
      if (!cursor) break
    }
    items.value = collected
    truncated.value = cursor !== null
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== target) return
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить сборы')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

watch(orgId, () => void load(), { immediate: true })
onBeforeUnmount(() => {
  alive = false
  generation++
})

function money(minor: number, code: string) {
  return formatMoneyRu(minor, code)
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника'
  return 'участников'
}

function meta(c: DesktopCollection): string {
  const parts = [`${c.contributors} ${plural(c.contributors)}`]
  if (c.deadlineAt) parts.push(`до ${formatShortDate(c.deadlineAt, tz.value)}`)
  return parts.join(' · ')
}

const tone = (c: DesktopCollection) =>
  c.status === 'active' ? 'flame' : c.status === 'completed' ? 'grass' : 'default'
</script>

<template>
  <section class="vt-desktop-collections space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Сборы</h1>
        <p class="text-vt-mute-2">Кампании по сбору на инвентарь, залы и турниры</p>
      </div>
      <NuxtLink
        v-if="canCreate"
        :to="`/app/orgs/${orgId}/collections/new`"
        class="vt-btn vt-btn--primary"
      >
        <VtIcon name="plus" :size="14" /> Новый сбор
      </NuxtLink>
    </header>

    <p v-if="org && !canCreate" class="vt-card p-4" role="status">
      Создание сборов пока недоступно. Существующие сборы показаны только для просмотра.
    </p>
    <p v-else-if="!org" class="vt-card p-4" role="status">
      Не удалось проверить настройки группы. Создание сборов недоступно.
    </p>

    <ErrorState v-if="loadError" :message="loadError" @retry="load" />
    <SkeletonList v-else-if="loading" :count="3" />
    <template v-else>
      <section class="vt-desktop-collections__stats" aria-label="Итоги по сборам">
        <div class="vt-card p-4">
          <p class="vt-cap">Активных сборов</p>
          <strong class="vt-mono" data-testid="collections-active">{{ totals.active }}</strong>
        </div>
        <div class="vt-card p-4">
          <p class="vt-cap">Собрано</p>
          <strong class="vt-mono text-vt-grass-ink" data-testid="collections-collected"
            >+{{ money(totals.collected, currency) }}</strong
          >
        </div>
        <div class="vt-card p-4">
          <p class="vt-cap">Обещано · ждёт</p>
          <strong class="vt-mono text-vt-amber-ink" data-testid="collections-pledged">{{
            money(totals.pledged, currency)
          }}</strong>
        </div>
      </section>

      <EmptyState
        v-if="items.length === 0"
        icon="gift"
        title="Сборов пока нет"
        :description="
          canCreate
            ? 'Создайте первый сбор на инвентарь, зал или турнир'
            : 'Сборы появятся здесь, когда создание станет доступно'
        "
      />
      <ul v-else class="vt-desktop-collections__list">
        <li
          v-for="c in items"
          :key="c.id"
          class="vt-card vt-desktop-collections__card"
          :class="{ 'vt-desktop-collections__card--closed': c.status === 'completed' }"
          data-testid="collection-card"
        >
          <DesktopCollectionIcon :name="c.icon" :size="48" />
          <div class="vt-desktop-collections__body">
            <div class="vt-desktop-collections__head">
              <h2>{{ c.title }}</h2>
              <VtChip :tone="tone(c)" :dot="c.status === 'completed'">{{
                COLLECTION_STATUS_LABELS[c.status]
              }}</VtChip>
            </div>
            <p v-if="c.description" class="text-vt-mute-2 text-sm">{{ c.description }}</p>
            <div v-if="collectionProgress(c) !== null" class="vt-desktop-collections__progress">
              <VtMeter
                :value="c.collected"
                :max="c.targetAmount ?? 0"
                :tone="c.status === 'completed' ? 'grass' : 'flame'"
                :label="`Собрано по сбору «${c.title}»`"
              />
              <span class="vt-mono font-bold text-sm">{{ collectionProgress(c) }}%</span>
            </div>
            <div class="vt-desktop-collections__foot">
              <span class="vt-mono text-sm font-semibold">
                {{ money(c.collected, c.currency) }}
                <span v-if="c.targetAmount !== null" class="text-vt-mute-2 font-normal"
                  >/ {{ money(c.targetAmount, c.currency) }}</span
                >
              </span>
              <span class="text-vt-mute-2 text-xs">{{ meta(c) }}</span>
            </div>
          </div>
        </li>
      </ul>
      <p v-if="truncated" class="text-vt-mute-2 text-sm" role="status">
        Показаны последние {{ items.length }} сборов; итоги посчитаны по ним.
      </p>
    </template>
  </section>
</template>
