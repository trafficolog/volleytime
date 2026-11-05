<script setup lang="ts">
import type { Organization } from '@volley-time/db'
import { DEFAULT_TIMEZONE, formatShortDate } from '@volley-time/shared'

import {
  COLLECTION_CANCEL_LINES,
  COLLECTION_COMPLETE_LINES,
  COLLECTION_STATUS_LABELS,
  collectionProgress,
  collectionTotals,
  pendingPledges,
  type CollectionAction,
  type DesktopCollection,
  type DesktopContribution,
  type DesktopPledge,
} from '~/utils/desktop-collections'
import { formatMoneyRu } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

interface CollectionsPage {
  collections: DesktopCollection[]
  nextCursor: string | null
}
const PAGE_LIMIT = 100
/** Сколько сборов с обещаниями опрашиваем для панели. */
const MAX_PLEDGE_COLLECTIONS = 20
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

async function load(silent = false) {
  const token = ++generation
  const target = orgId.value
  if (!silent) {
    loading.value = true
    items.value = []
    pledges.value = []
  }
  loadError.value = ''
  truncated.value = false
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
    await loadPledges(collected, target, token)
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== target) return
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить сборы')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

/** Ожидающие обещания: сводка списка не содержит игроков, поэтому читаем сборы с `pledged > 0`. */
async function loadPledges(list: DesktopCollection[], target: number, token: number) {
  const withPledges = list.filter((c) => c.status !== 'cancelled' && c.pledged > 0)
  pledgesPartial.value = withPledges.length > MAX_PLEDGE_COLLECTIONS
  const results = await Promise.allSettled(
    withPledges
      .slice(0, MAX_PLEDGE_COLLECTIONS)
      .map((c) =>
        $fetch<{ contributions: DesktopContribution[] }>(
          `/api/organizations/${target}/collections/${c.id}`,
        ).then((detail) => pendingPledges(c, detail.contributions)),
      ),
  )
  if (!alive || token !== generation || orgId.value !== target) return
  pledgesError.value = results.some((r) => r.status === 'rejected')
    ? 'Не удалось загрузить часть обещаний'
    : ''
  pledges.value = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Решения по обещаниям и действия меню (21.2.23): один запрос на взнос/сбор, повтор клика игнорируется
const toast = useToast()
const pledges = ref<DesktopPledge[]>([])
const pledgesError = ref('')
const pledgesPartial = ref(false)
const busyPledges = ref<Set<number>>(new Set())
const busyCollection = ref<number | null>(null)
const editTarget = ref<DesktopCollection | null>(null)
const editOpen = ref(false)
const confirmAction = ref<{ kind: 'complete' | 'cancel'; collection: DesktopCollection } | null>(
  null,
)
const confirmOpen = ref(false)

/** Работа с чужим состоянием: после любого конфликта или успеха список перечитывается. */
async function guarded(work: () => Promise<string>, failure: string) {
  const target = orgId.value
  try {
    const message = await work()
    if (orgId.value === target) toast.show(message)
  } catch (cause) {
    if (orgId.value !== target) return
    toast.show(apiErrorMessage(cause, failure), 'danger')
    // состояние на сервере уже другое (взнос обработан или заменён, сбор закрыт или удалён)
    const stale = ['payment.not_pending', 'collection.not_active', 'collection.not_found']
    if (!stale.includes(apiErrorCode(cause) ?? '')) return
  }
  if (orgId.value === target && alive) await load(true)
}

async function decide(pledge: DesktopPledge, decision: 'confirm' | 'reject') {
  if (!canCreate.value || busyPledges.value.has(pledge.id)) return
  const target = orgId.value
  busyPledges.value = new Set(busyPledges.value).add(pledge.id)
  try {
    await guarded(
      async () => {
        await $fetch(
          `/api/organizations/${target}/collections/${pledge.collectionId}/contributions/${pledge.id}/${decision}`,
          { method: 'POST' },
        )
        return decision === 'confirm' ? 'Обещание подтверждено' : 'Обещание отклонено'
      },
      decision === 'confirm' ? 'Не удалось подтвердить обещание' : 'Не удалось отклонить обещание',
    )
  } finally {
    const next = new Set(busyPledges.value)
    next.delete(pledge.id)
    if (alive) busyPledges.value = next
  }
}

async function runCollectionAction(
  collection: DesktopCollection,
  work: (target: number) => Promise<string>,
  failure: string,
) {
  if (!canCreate.value || busyCollection.value !== null) return
  const target = orgId.value
  busyCollection.value = collection.id
  try {
    await guarded(() => work(target), failure)
  } finally {
    if (alive) busyCollection.value = null
  }
}

function onRowAction(action: CollectionAction, collection: DesktopCollection) {
  if (action === 'edit') {
    editTarget.value = collection
    editOpen.value = true
  } else if (action === 'publish') {
    void runCollectionAction(
      collection,
      async (target) => {
        await $fetch(`/api/organizations/${target}/collections/${collection.id}`, {
          method: 'PATCH',
          body: { status: 'active' },
        })
        return `Сбор «${collection.title}» опубликован`
      },
      'Не удалось опубликовать сбор',
    )
  } else {
    confirmAction.value = { kind: action, collection }
    confirmOpen.value = true
  }
}

function runConfirmed() {
  const pending = confirmAction.value
  if (!pending) return
  const { kind, collection } = pending
  void runCollectionAction(
    collection,
    async (target) => {
      await $fetch(`/api/organizations/${target}/collections/${collection.id}/${kind}`, {
        method: 'POST',
      })
      return kind === 'cancel'
        ? `Сбор «${collection.title}» отменён`
        : `Сбор «${collection.title}» завершён`
    },
    kind === 'cancel' ? 'Не удалось отменить сбор' : 'Не удалось завершить сбор',
  )
}

function onEdited() {
  toast.show('Сбор сохранён')
  void load(true)
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

    <ErrorState v-if="loadError" :message="loadError" @retry="load()" />
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
      <div v-else class="vt-desktop-collections__layout">
        <ul class="vt-desktop-collections__list">
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
                <div class="vt-desktop-collections__head-end">
                  <VtChip :tone="tone(c)" :dot="c.status === 'completed'">{{
                    COLLECTION_STATUS_LABELS[c.status]
                  }}</VtChip>
                  <DesktopCollectionRowMenu
                    v-if="canCreate"
                    :collection="c"
                    :busy="busyCollection !== null"
                    @action="(action) => onRowAction(action, c)"
                  />
                </div>
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
        <aside class="vt-desktop-collections__aside">
          <DesktopCollectionPledges
            :pledges="pledges"
            :busy-ids="busyPledges"
            :readonly="!canCreate"
            :partial="pledgesPartial"
            @confirm="(p) => decide(p, 'confirm')"
            @reject="(p) => decide(p, 'reject')"
          />
          <p v-if="pledgesError" class="text-vt-rose-ink text-sm" role="alert">
            {{ pledgesError }}
            <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load(true)">
              Повторить
            </button>
          </p>
        </aside>
      </div>
      <p v-if="truncated" class="text-vt-mute-2 text-sm" role="status">
        Показаны последние {{ items.length }} сборов; итоги посчитаны по ним.
      </p>
    </template>

    <DesktopCollectionEditSheet
      v-model="editOpen"
      :org-id="orgId"
      :collection="editTarget"
      :tz="tz"
      @saved="onEdited"
    />
    <VtAlert
      v-model="confirmOpen"
      wide
      :danger="confirmAction?.kind === 'cancel'"
      :title="`${confirmAction?.kind === 'cancel' ? 'Отменить' : 'Завершить'} сбор${confirmAction ? ` «${confirmAction.collection.title}»` : ''}?`"
      :confirm-label="confirmAction?.kind === 'cancel' ? 'Отменить сбор' : 'Завершить сбор'"
      :cancel-label="confirmAction?.kind === 'cancel' ? 'Не отменять' : 'Не завершать'"
      @confirm="runConfirmed"
    >
      <ul class="vt-desktop-event-detail__consequences">
        <li
          v-for="line in confirmAction?.kind === 'cancel'
            ? COLLECTION_CANCEL_LINES
            : COLLECTION_COMPLETE_LINES"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </VtAlert>
    <VtToast />
  </section>
</template>
