<script setup lang="ts">
import {
  collectionDeadlineLabel,
  collectionMyStatus,
  collectionProgress,
  collectionSections,
  type PlayerCollection,
} from '~/utils/collections'
import { formatMoneyRu } from '~/utils/labels'
import { isManagerMember } from '~/utils/organizer-collections'
import { playerAccessFromApiError } from '~/utils/player-home'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Сборы игрока (21.1.6, M-13/`ContribHub`): активные и завершённые сборы группы; сбор — `./[collectionId]`.
 * Организатор и владелец (21.1.5) видят тот же адрес как управление сборами: итоги, черновики, «Новый сбор».
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
// тот же запрос и ключ, что у layout: ответ группы с ролью и флагом `COLLECTIONS_ENABLED`
const { data: orgData } = await useFetch<{
  organization: { id: number }
  capabilities?: { collections?: boolean }
  myMember?: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-nav-${orgId.value}` })
const isManager = computed(
  () => orgData.value?.organization?.id === orgId.value && isManagerMember(orgData.value.myMember),
)
const canCreate = computed(() => orgData.value?.capabilities?.collections === true)

const collections = ref<PlayerCollection[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const accessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
let loadSeq = 0

async function fetchPage(cursor: string | null) {
  const query = cursor ? `?limit=50&cursor=${encodeURIComponent(cursor)}` : '?limit=50'
  return $fetch<{ collections: PlayerCollection[]; nextCursor: string | null }>(
    `/api/organizations/${orgId.value}/collections${query}`,
  )
}

async function load() {
  const mine = ++loadSeq
  loading.value = true
  loadError.value = ''
  accessNotice.value = null
  try {
    const page = await fetchPage(null)
    if (mine !== loadSeq) return
    collections.value = page.collections
    nextCursor.value = page.nextCursor
  } catch (e) {
    if (mine !== loadSeq) return
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить сборы')
    accessNotice.value = playerAccessFromApiError(apiErrorCode(e))
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  const mine = loadSeq
  loadingMore.value = true
  loadError.value = ''
  try {
    const page = await fetchPage(nextCursor.value)
    if (mine !== loadSeq) return
    collections.value = [...collections.value, ...page.collections]
    nextCursor.value = page.nextCursor
  } catch (e) {
    if (mine === loadSeq) loadError.value = apiErrorMessage(e, 'Не удалось загрузить сборы')
  } finally {
    loadingMore.value = false
  }
}

await load()
watch(
  orgId,
  () => {
    collections.value = []
    nextCursor.value = null
    void load()
  },
  { flush: 'sync' },
)

const sections = computed(() => collectionSections(collections.value))
const now = new Date()
const deadline = (c: PlayerCollection) =>
  c.status === 'active' ? collectionDeadlineLabel(c.deadlineAt, tz.value, now)?.date : undefined
const closedLabel = (c: PlayerCollection) =>
  c.status === 'cancelled' ? 'отменён' : c.closedAt ? 'завершён' : ''
// управление показываем, когда есть что показывать; загрузка, отказ в доступе и ошибка — общие
const managerView = computed(
  () =>
    isManager.value &&
    !loading.value &&
    !accessNotice.value &&
    !(loadError.value && !collections.value.length),
)
</script>

<template>
  <OrganizerCollectionsList
    v-if="managerView"
    :collections="collections"
    :base="base"
    :tz="tz"
    :can-create="canCreate"
    :has-more="nextCursor !== null"
    :loading-more="loadingMore"
    :load-error="loadError"
    @load-more="loadMore"
  />
  <div v-else class="min-h-screen pb-10">
    <VtMiniHeader title="Сборы" />
    <main class="px-4 pb-5 pt-2">
      <SkeletonList v-if="loading" :count="3" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <ErrorState v-else-if="loadError && !collections.length" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="!collections.length"
        icon="gift"
        title="Сборов нет"
        description="Когда организатор запустит сбор на мячи, форму или аренду зала, он появится здесь"
      />
      <template v-else>
        <p class="px-1 pb-2.5 text-sm leading-snug text-vt-mute-2">
          Скидываемся на инвентарь, залы и турниры. Можно обещать взнос — организатор подтвердит,
          когда получит деньги.
        </p>

        <section v-if="sections.active.length" aria-labelledby="collections-active-title">
          <h2 id="collections-active-title" class="vt-cap mx-1 mb-2.5 mt-2 text-vt-mute-2">
            Активные · {{ sections.active.length }}
          </h2>
          <ul class="flex flex-col gap-2.5">
            <li v-for="c in sections.active" :key="c.id">
              <NuxtLink
                :to="`${base}/collections/${c.id}`"
                class="vt-card vt-card--raised block !p-4"
              >
                <div class="flex items-start gap-3">
                  <VtCampaignIcon :name="c.icon" :size="44" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-display text-base font-semibold leading-tight">{{
                        c.title
                      }}</span>
                      <VtChip
                        v-if="collectionMyStatus(c.my, c.currency)"
                        :tone="collectionMyStatus(c.my, c.currency)!.tone"
                        :dot="collectionMyStatus(c.my, c.currency)!.tone === 'grass'"
                        class="shrink-0"
                        >{{ collectionMyStatus(c.my, c.currency)!.label }}</VtChip
                      >
                    </div>
                    <p v-if="c.description" class="mt-1.5 line-clamp-2 text-xs text-vt-mute-2">
                      {{ c.description }}
                    </p>
                    <div
                      v-if="collectionProgress(c.collected, c.targetAmount) !== null"
                      class="mt-3 flex items-center gap-2"
                    >
                      <div
                        class="vt-meter h-1.5 flex-1"
                        role="meter"
                        aria-label="Собрано"
                        :aria-valuenow="collectionProgress(c.collected, c.targetAmount)!"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <i
                          :style="{ width: `${collectionProgress(c.collected, c.targetAmount)}%` }"
                        />
                      </div>
                      <span class="vt-mono text-[11px] font-semibold"
                        >{{ collectionProgress(c.collected, c.targetAmount) }}%</span
                      >
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-2">
                      <span class="vt-mono text-xs font-semibold">
                        {{ formatMoneyRu(c.collected, c.currency)
                        }}<span v-if="c.targetAmount !== null" class="font-normal text-vt-mute-2">
                          / {{ formatMoneyRu(c.targetAmount, c.currency) }}</span
                        >
                      </span>
                      <span v-if="deadline(c)" class="text-[11px] text-vt-mute-2">{{
                        deadline(c)
                      }}</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section
          v-if="sections.finished.length"
          aria-labelledby="collections-finished-title"
          class="mt-5"
        >
          <h2 id="collections-finished-title" class="vt-cap mx-1 mb-2.5 text-vt-mute-2">
            Завершённые
          </h2>
          <ul class="flex flex-col gap-2.5">
            <li v-for="c in sections.finished" :key="c.id">
              <NuxtLink
                :to="`${base}/collections/${c.id}`"
                class="vt-card vt-card--raised block !p-4 grayscale"
              >
                <div class="flex items-start gap-3">
                  <VtCampaignIcon :name="c.icon" :size="44" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-display text-base font-semibold leading-tight">{{
                        c.title
                      }}</span>
                      <VtChip
                        v-if="collectionMyStatus(c.my, c.currency)"
                        :tone="collectionMyStatus(c.my, c.currency)!.tone"
                        :dot="collectionMyStatus(c.my, c.currency)!.tone === 'grass'"
                        class="shrink-0"
                        >{{ collectionMyStatus(c.my, c.currency)!.label }}</VtChip
                      >
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-2">
                      <span class="vt-mono text-xs font-semibold">
                        {{ formatMoneyRu(c.collected, c.currency)
                        }}<span v-if="c.targetAmount !== null" class="font-normal text-vt-mute-2">
                          / {{ formatMoneyRu(c.targetAmount, c.currency) }}</span
                        >
                      </span>
                      <span class="text-[11px] text-vt-mute-2">{{ closedLabel(c) }}</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <p v-if="loadError" class="mt-3 text-sm text-vt-rose-ink" role="alert">{{ loadError }}</p>
        <button
          v-if="nextCursor"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full mt-4"
          :disabled="loadingMore"
          @click="loadMore"
        >
          Показать ещё
        </button>
      </template>
    </main>
  </div>
</template>
