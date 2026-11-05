<script setup lang="ts">
import {
  collectionCtaLabel,
  collectionDeadlineLabel,
  collectionProgress,
  type CollectionContribution,
  type PlayerCollection,
} from '~/utils/collections'
import { formatMoneyRu } from '~/utils/labels'
import { isManagerMember } from '~/utils/organizer-collections'
import { playerAccessFromApiError } from '~/utils/player-home'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Сбор игрока (21.1.6, `ContribDetail`): цель, собрано, участники, мой взнос и переход к взносу.
 * Организатору и владельцу (21.1.5) тот же адрес показывает управление сбором: обещания и действия.
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const collectionId = computed(() => Number(route.params.collectionId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
const {
  data: orgData,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number }
  capabilities: { collections: boolean }
  myMember?: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, {
  key: () => `player-collection-org-${orgId.value}`,
})

const collection = ref<PlayerCollection | null>(null)
const contributions = ref<CollectionContribution[]>([])
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const loadAccessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const accessNotice = computed(
  () => playerAccessFromApiError(apiErrorCode(orgError.value)) ?? loadAccessNotice.value,
)
let loadSeq = 0

/** `silent` — перечитать после действия организатора, не прячет экран за скелетоном. */
async function load(silent = false) {
  const mine = ++loadSeq
  if (!silent) loading.value = true
  loadError.value = ''
  notFound.value = false
  loadAccessNotice.value = null
  try {
    const result = await $fetch<{
      collection: PlayerCollection
      contributions: CollectionContribution[]
    }>(`/api/organizations/${orgId.value}/collections/${collectionId.value}`)
    if (mine !== loadSeq) return
    collection.value = result.collection
    contributions.value = result.contributions
  } catch (e) {
    if (mine !== loadSeq) return
    collection.value = null
    contributions.value = []
    if (apiErrorCode(e) === 'collection.not_found') notFound.value = true
    else {
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить сбор')
      loadAccessNotice.value = playerAccessFromApiError(apiErrorCode(e))
    }
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
await load()
watch(
  () => [orgId.value, collectionId.value],
  () => {
    collection.value = null
    void refreshOrg()
    void load()
  },
  { flush: 'sync' },
)

async function retryPage() {
  await refreshOrg()
  await load()
}

const now = new Date()
const progress = computed(() =>
  collection.value
    ? collectionProgress(collection.value.collected, collection.value.targetAmount)
    : null,
)
const deadline = computed(() =>
  collection.value ? collectionDeadlineLabel(collection.value.deadlineAt, tz.value, now) : null,
)
const isActive = computed(() => collection.value?.status === 'active')
const isManager = computed(
  () => orgData.value?.organization?.id === orgId.value && isManagerMember(orgData.value.myMember),
)
const managerView = computed(
  () =>
    isManager.value &&
    !loading.value &&
    !accessNotice.value &&
    !!collection.value &&
    !loadError.value,
)
async function reloadAfterAction() {
  await Promise.all([refreshOrg(), load(true)])
}
const pledgesOpen = computed(() => orgData.value?.capabilities?.collections === true)
const statusLabel = computed(() =>
  collection.value?.status === 'cancelled' ? 'сбор отменён' : 'сбор завершён',
)
const backers = computed(() => contributions.value)
const money = (minor: number) => formatMoneyRu(minor, collection.value?.currency)
</script>

<template>
  <OrganizerCollectionManage
    v-if="managerView && collection"
    :org-id="orgId"
    :collection="collection"
    :contributions="contributions"
    :flag-on="pledgesOpen"
    :tz="tz"
    :back="`${base}/collections`"
    @changed="reloadAfterAction"
  />
  <div v-else class="min-h-screen pb-6">
    <VtMiniHeader
      :title="collection?.title ?? 'Сбор'"
      :sub="deadline?.date"
      :back="`${base}/collections`"
    />
    <main class="px-4 pb-4 pt-2">
      <SkeletonList v-if="loading" :count="3" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <EmptyState v-else-if="notFound" icon="gift" title="Сбор не найден">
        <template #action>
          <NuxtLink :to="`${base}/collections`" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
      <ErrorState v-else-if="loadError || !collection" :message="loadError" @retry="retryPage" />
      <template v-else>
        <section class="vt-card vt-card--hero relative overflow-hidden !p-[18px]">
          <span
            class="absolute -right-6 -top-6 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-vt-orange opacity-90"
            aria-hidden="true"
          >
            <span class="-ml-5 mt-5"
              ><VtCampaignIcon :name="collection.icon" :size="48" on-dark
            /></span>
          </span>
          <div class="relative">
            <div class="vt-cap !text-[var(--vt-on-hero-2)]">
              {{ isActive ? 'собрано' : statusLabel }}
            </div>
            <div class="mt-2 flex flex-wrap items-baseline gap-2">
              <span class="vt-mono font-display text-[32px] font-bold leading-none">{{
                money(collection.collected)
              }}</span>
              <span
                v-if="collection.targetAmount !== null"
                class="text-sm text-[var(--vt-on-hero-2)]"
                >из {{ money(collection.targetAmount) }}</span
              >
            </div>
            <div
              v-if="progress !== null"
              class="mt-3.5 h-2 overflow-hidden rounded-full bg-[var(--vt-on-hero-line)]"
              role="meter"
              aria-label="Собрано"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full"
                :class="isActive ? 'bg-vt-amber' : 'bg-vt-grass'"
                :style="{ width: `${progress}%` }"
              />
            </div>
            <div class="mt-3 flex justify-between gap-2 text-xs text-[var(--vt-on-hero-2)]">
              <span>{{ collection.contributors }} участников</span>
              <span v-if="isActive && deadline">{{ deadline.left }}</span>
            </div>
          </div>
        </section>

        <section class="px-1 pt-3.5">
          <p v-if="collection.description" class="text-base leading-normal text-vt-ink-3">
            {{ collection.description }}
          </p>
          <p v-if="collection.createdBy.name" class="mt-3 text-xs text-vt-mute-2">
            Сбор организует {{ collection.createdBy.name }}
          </p>
        </section>

        <section
          v-if="collection.my.pending || collection.my.paid > 0"
          class="mt-4 flex flex-col gap-2"
          aria-label="Мой взнос"
        >
          <div
            v-if="collection.my.pending"
            class="vt-card flex items-center gap-2.5 !border-vt-amber !px-3.5 !py-3"
          >
            <VtIcon name="clock" :size="18" />
            <div>
              <div class="text-sm font-semibold">
                Вы обещали {{ money(collection.my.pending.amount) }}
              </div>
              <div class="text-xs text-vt-mute-2">ждём подтверждения от организатора</div>
            </div>
          </div>
          <div
            v-if="collection.my.paid > 0"
            class="vt-card flex items-center gap-2.5 !border-vt-grass !px-3.5 !py-3"
          >
            <VtIcon name="check" :size="18" />
            <div>
              <div class="text-sm font-semibold">Вы внесли {{ money(collection.my.paid) }}</div>
              <div class="text-xs text-vt-mute-2">спасибо за вклад!</div>
            </div>
          </div>
        </section>

        <section v-if="backers.length" class="mt-5" aria-labelledby="collection-backers-title">
          <h2 id="collection-backers-title" class="vt-cap mb-2.5 px-1 text-vt-mute-2">
            Уже скинулись
          </h2>
          <ul class="vt-card divide-y divide-vt-stroke overflow-hidden !p-0">
            <li v-for="b in backers" :key="b.id" class="flex items-center gap-2.5 px-3.5 py-2.5">
              <VtAvatar :name="b.user.name ?? b.user.telegramUsername ?? 'Игрок'" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{
                b.user.name ?? b.user.telegramUsername ?? 'Игрок'
              }}</span>
              <VtChip v-if="b.status === 'pending'" tone="amber">обещал</VtChip>
              <span
                class="vt-mono text-sm font-semibold"
                :class="b.status === 'succeeded' ? 'text-vt-grass-ink' : 'text-vt-mute-2'"
                >{{ money(b.amount) }}</span
              >
            </li>
          </ul>
        </section>

        <template v-if="isActive">
          <p v-if="!pledgesOpen" class="vt-card mt-5 p-4 text-sm text-vt-mute-2" role="status">
            Приём взносов сейчас приостановлен. Сбор можно смотреть, внести взнос пока нельзя.
          </p>
          <div
            v-else
            class="sticky bottom-[calc(var(--player-dock-height,58px)+28px+var(--vt-safe-bottom))] mt-5 bg-vt-paper pb-1 pt-3"
          >
            <NuxtLink
              :to="`${base}/collections/${collection.id}/pledge`"
              class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
            >
              {{ collectionCtaLabel(collection.my) }}
            </NuxtLink>
          </div>
        </template>
      </template>
    </main>
  </div>
</template>
