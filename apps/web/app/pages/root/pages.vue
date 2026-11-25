<script setup lang="ts">
import type {
  PlatformGroupPageCities,
  PlatformGroupPageRow,
  PlatformGroupPagesList,
} from '@volley-time/shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { apiErrorStatus } from '~/utils/api-error'
import {
  ALL_COUNTRY,
  PAGES_FILTERS,
  MODERATION_STATE_CHIPS,
  citiesKpis,
  cityInScope,
  formatDay,
  formatWhen,
  pagesCountText,
  rowActions,
  searchKey,
  type CityScope,
  type PagesFilter,
} from '~/utils/root-group-pages'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Страницы групп — Root Admin' })

const API = '/api/platform/group-pages'
// кнопки изменений — по роли (29.3.1, R-15): Support видит страницы и историю, но не модерирует
const { can } = usePlatformCan()
const toast = useToast()

const catalog = ref<PlatformGroupPageCities | null>(null)
const catalogPending = ref(true)
const catalogFailed = ref(false)

/** Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход. */
async function reactToFailure(e: unknown): Promise<void> {
  const reaction = rootOverviewFailure(apiErrorStatus(e))
  if (reaction === 'forbidden') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Нет доступа к разделу',
      fatal: true,
    })
  }
  if (reaction === 'login') await navigateTo('/auth/login')
}

async function loadCatalog() {
  catalogFailed.value = false
  catalogPending.value = true
  try {
    catalog.value = await $fetch<PlatformGroupPageCities>(`${API}/cities`)
  } catch (e) {
    await reactToFailure(e)
    catalogFailed.value = true
  } finally {
    catalogPending.value = false
  }
}
await loadCatalog()

// навигатор городов ------------------------------------------------------------------------
const allCities = computed(() => [
  ...(catalog.value?.regions.flatMap((r) => r.cities.map((c) => ({ ...c, region: r.region }))) ??
    []),
  ...(catalog.value?.other.map((c) => ({ ...c, region: 'Другие города' })) ?? []),
])
const selected = ref<string>(
  allCities.value.find((c) => c.name === 'Минск' && c.pages > 0) ? 'Минск' : ALL_COUNTRY,
)
const scope = ref<CityScope>('pages')
const filter = ref<PagesFilter>('all')
const query = ref('')
const openRegions = ref<Record<string, boolean>>({ Минская: true })

const nq = computed(() => searchKey(query.value))
const issuesCount = computed(() => allCities.value.filter((c) => c.issues > 0).length)
const visibleRegions = computed(() => {
  const groups = [
    ...(catalog.value?.regions ?? []),
    ...(catalog.value?.other.length
      ? [{ region: 'Другие города', cities: catalog.value.other }]
      : []),
  ]
  return groups
    .map((r) => ({
      region: r.region,
      total: r.cities.length,
      withPages: r.cities.filter((c) => c.pages > 0).length,
      issues: r.cities.filter((c) => c.issues > 0).length,
      cities: r.cities.filter((c) =>
        nq.value ? searchKey(c.name).includes(nq.value) : cityInScope(c, scope.value),
      ),
    }))
    .filter((r) => r.cities.length > 0)
})
const isRegionOpen = (region: string) =>
  !!nq.value || region === 'Минск' || !!openRegions.value[region]
const current = computed(() => allCities.value.find((c) => c.name === selected.value) ?? null)
const heading = computed(() => (selected.value === ALL_COUNTRY ? 'Вся страна' : selected.value))
const regionText = computed(() => {
  const c = current.value
  if (!c) return ''
  return c.region === 'Минск'
    ? 'столица'
    : c.region === 'Другие города'
      ? c.region
      : `${c.region} обл.`
})
const kpis = computed(() => (catalog.value ? citiesKpis(catalog.value.totals) : []))

function pick(city: string) {
  selected.value = city
  filter.value = 'all'
}

// поиск группы по названию или адресу ---------------------------------------------------------
const SEARCH_DELAY_MS = 300
const hits = ref<PlatformGroupPageRow[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0
watch(query, (value) => {
  clearTimeout(searchTimer)
  const text = value.trim()
  const mine = ++searchSeq
  if (text.length < 2) {
    hits.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      const res = await $fetch<PlatformGroupPagesList>(API, { query: { q: text } })
      if (mine === searchSeq) hits.value = res.items.slice(0, 6)
    } catch {
      if (mine === searchSeq) hits.value = []
    }
  }, SEARCH_DELAY_MS)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function pickHit(row: PlatformGroupPageRow) {
  const region = allCities.value.find((c) => c.name === row.city)?.region
  if (region) openRegions.value[region] = true
  pick(row.city && allCities.value.some((c) => c.name === row.city) ? row.city : ALL_COUNTRY)
  query.value = ''
}

// страницы выбранного города ------------------------------------------------------------------
const rows = ref<PlatformGroupPageRow[]>([])
const rowsPending = ref(false)
const rowsFailed = ref(false)
let rowsSeq = 0

async function loadRows() {
  const mine = ++rowsSeq
  rowsFailed.value = false
  rowsPending.value = true
  try {
    const res = await $fetch<PlatformGroupPagesList>(API, {
      query: {
        ...(selected.value === ALL_COUNTRY ? {} : { city: selected.value }),
        filter: filter.value,
      },
    })
    if (mine === rowsSeq) rows.value = res.items
  } catch (e) {
    if (mine !== rowsSeq) return
    await reactToFailure(e)
    rowsFailed.value = true
  } finally {
    if (mine === rowsSeq) rowsPending.value = false
  }
}
watch([selected, filter], () => void loadRows())
await loadRows()

/** Решение принято или снято: обновляем строки и счётчики городов. */
async function refreshAll() {
  await Promise.all([loadRows(), loadCatalog()])
}

// действия ---------------------------------------------------------------------------------------
const moderation = ref<{ kind: 'hidden' | 'noindex'; page: PlatformGroupPageRow } | null>(null)
const restoring = ref<PlatformGroupPageRow | null>(null)
const history = ref<PlatformGroupPageRow | null>(null)

function onModerated(page: PlatformGroupPageRow) {
  toast.show(
    page.state === 'hidden'
      ? `«${page.name}» скрыта · причина ушла в кабинет и бот`
      : `«${page.name}» · noindex · причина ушла в кабинет и бот`,
  )
  void refreshAll()
}
function onRestored(page: PlatformGroupPageRow) {
  toast.show(`«${page.name}» возвращена · записано в журнал`)
  void refreshAll()
}

const emptyText = computed(() => {
  if (filter.value !== 'all') return 'Под фильтр ничего не подошло.'
  const c = current.value
  if (c && c.pages === 0)
    return `В городе ${c.name} пока нет страниц групп. Город есть в каталоге, его страница закрыта от индексации, пока в ней нет групп.`
  return 'Страниц групп пока нет.'
})
</script>

<template>
  <div class="vt-mod">
    <header class="vt-root-overview__heading">
      <h1 tabindex="-1">
        Страницы групп <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
      </h1>
      <p class="text-vt-mute-2">Каталог городов · районные центры и страницы групп в них</p>
    </header>

    <RootModerationTabs active="pages" />

    <SkeletonList v-if="catalogPending && !catalog" :count="4" />
    <ErrorState
      v-else-if="catalogFailed && !catalog"
      message="Не удалось загрузить каталог городов"
      @retry="loadCatalog()"
    />
    <template v-else-if="catalog">
      <RootModerationKpis :items="kpis" />

      <div class="vt-mod__layout">
        <aside class="vt-card vt-mod-nav" aria-label="Города каталога">
          <label class="sr-only" for="mod-city-q">Город или группа</label>
          <div class="vt-field vt-mod-search">
            <VtIcon name="search" :size="14" />
            <input
              id="mod-city-q"
              v-model="query"
              type="search"
              placeholder="Город или группа"
              autocomplete="off"
            />
          </div>
          <div class="vt-mod-seg" role="group" aria-label="Какие города показывать">
            <button
              type="button"
              :aria-pressed="scope === 'pages'"
              data-testid="scope-pages"
              @click="scope = 'pages'"
            >
              Со страницами
            </button>
            <button
              type="button"
              :aria-pressed="scope === 'issues'"
              data-testid="scope-issues"
              @click="scope = 'issues'"
            >
              Внимание · {{ issuesCount }}
            </button>
            <button
              type="button"
              :aria-pressed="scope === 'all'"
              data-testid="scope-all"
              @click="scope = 'all'"
            >
              Все · {{ allCities.length }}
            </button>
          </div>

          <div class="vt-mod-nav__list">
            <button
              type="button"
              class="vt-mod-city"
              :aria-pressed="selected === ALL_COUNTRY"
              data-testid="city-all"
              @click="pick(ALL_COUNTRY)"
            >
              <VtIcon name="globe" :size="14" />
              <span class="vt-mod-city__name">Вся страна</span>
              <span class="vt-mono vt-mod-muted">{{ catalog.totals.pages }}</span>
            </button>

            <div v-if="hits.length" class="vt-mod-hits" data-testid="group-hits">
              <p class="vt-cap">Группы</p>
              <button
                v-for="hit in hits"
                :key="hit.organizationId"
                type="button"
                class="vt-mod-city"
                @click="pickHit(hit)"
              >
                <span class="vt-mod-city__name">
                  {{ hit.name }}
                  <small class="vt-mod-muted">{{ hit.city ?? 'без города' }}</small>
                </span>
                <span class="vt-chip" :class="MODERATION_STATE_CHIPS[hit.state].chip">
                  {{ MODERATION_STATE_CHIPS[hit.state].label }}
                </span>
              </button>
            </div>

            <section v-for="r in visibleRegions" :key="r.region" class="vt-mod-region">
              <button
                v-if="r.region !== 'Минск'"
                type="button"
                class="vt-mod-region__head"
                :aria-expanded="isRegionOpen(r.region)"
                @click="openRegions[r.region] = !isRegionOpen(r.region)"
              >
                <VtIcon
                  name="chevron-r"
                  :size="12"
                  :class="{ 'vt-mod-region__open': isRegionOpen(r.region) }"
                />
                <span class="vt-cap vt-mod-region__name">
                  {{ r.region === 'Другие города' ? r.region : `${r.region} обл.` }}
                </span>
                <span v-if="r.issues" class="vt-chip vt-chip--amber">{{ r.issues }}</span>
                <span class="vt-mono vt-mod-muted">{{ r.withPages }}/{{ r.total }}</span>
              </button>
              <template v-if="isRegionOpen(r.region)">
                <button
                  v-for="c in r.cities"
                  :key="c.name"
                  type="button"
                  class="vt-mod-city vt-mod-city--nested"
                  :aria-pressed="selected === c.name"
                  :data-city="c.name"
                  :data-empty="c.pages === 0"
                  @click="pick(c.name)"
                >
                  <span class="vt-mod-city__name">{{ c.name }}</span>
                  <span v-if="c.issues" class="vt-chip vt-chip--amber">
                    {{ c.issues }}<span class="sr-only"> требуют внимания</span>
                  </span>
                  <span class="vt-mono vt-mod-muted">{{ c.pages || '—' }}</span>
                </button>
              </template>
            </section>
            <p
              v-if="nq && !visibleRegions.length && !hits.length"
              class="vt-mod-muted vt-mod-nav__none"
            >
              Ничего не нашли.
            </p>
          </div>
          <p class="vt-mod-muted vt-mod-nav__foot">Города из каталога · «—» — страниц пока нет</p>
        </aside>

        <section class="vt-mod-main" aria-labelledby="mod-heading" :aria-busy="rowsPending">
          <div class="vt-mod-main__head">
            <h2 id="mod-heading">{{ heading }}</h2>
            <span v-if="current" class="vt-mod-muted">{{ regionText }}</span>
            <span class="vt-mod-main__spacer" />
            <div class="vt-mod-filters" role="group" aria-label="Фильтр страниц">
              <button
                v-for="f in PAGES_FILTERS"
                :key="f.key"
                type="button"
                class="vt-btn vt-btn--sm"
                :aria-pressed="filter === f.key"
                :data-testid="`filter-${f.key}`"
                @click="filter = f.key"
              >
                {{ f.label }}
              </button>
            </div>
          </div>

          <SkeletonList v-if="rowsPending && !rows.length" :count="3" />
          <ErrorState
            v-else-if="rowsFailed"
            message="Не удалось загрузить страницы"
            @retry="loadRows()"
          />
          <div v-else class="vt-card vt-mod-table">
            <p v-if="!rows.length" class="vt-mod-empty" data-testid="rows-empty">{{ emptyText }}</p>
            <ul
              v-else
              class="vt-mod-rows"
              :aria-label="`Страницы групп · ${heading} · ${pagesCountText(rows.length)}`"
            >
              <li
                v-for="row in rows"
                :key="row.organizationId"
                class="vt-mod-row"
                :data-state="row.state"
                :data-org="row.organizationId"
              >
                <div class="vt-mod-row__group">
                  <strong>{{ row.name }}</strong>
                  <span class="vt-code vt-mod-muted">/g/{{ row.slug }}</span>
                  <span v-if="selected === ALL_COUNTRY" class="vt-mod-muted">{{
                    row.city ?? 'без города'
                  }}</span>
                </div>
                <div class="vt-mod-row__state">
                  <span class="vt-chip" :class="MODERATION_STATE_CHIPS[row.state].chip">
                    {{ MODERATION_STATE_CHIPS[row.state].label }}
                  </span>
                  <p v-if="row.moderation" class="vt-mod-row__reason">
                    {{ row.moderation.reasonTitle }}
                    <template v-if="row.moderation.decidedBy">
                      · <span class="vt-code">{{ row.moderation.decidedBy.name }}</span></template
                    >
                    · {{ formatWhen(row.moderation.decidedAt) }}
                  </p>
                </div>
                <span class="vt-mono vt-mod-row__complaints" :data-has="row.newComplaints > 0">
                  <span class="sr-only">Новых жалоб: </span>{{ row.newComplaints || '—' }}
                </span>
                <span class="vt-mono vt-mod-muted vt-mod-row__date">
                  <span class="sr-only">Обновлена: </span>{{ formatDay(row.updatedAt) }}
                </span>
                <div class="vt-mod-row__actions">
                  <button
                    type="button"
                    class="vt-btn vt-btn--ghost vt-btn--sm"
                    :aria-label="`История · ${row.name}`"
                    data-action="history"
                    @click="history = row"
                  >
                    <VtIcon name="clock" :size="14" />
                  </button>
                  <button
                    v-if="can('groupPagesModerate') && rowActions(row).restore"
                    type="button"
                    class="vt-btn vt-btn--ink vt-btn--sm"
                    data-action="restore"
                    @click="restoring = row"
                  >
                    {{ rowActions(row).restoreLabel }}
                  </button>
                  <button
                    v-if="can('groupPagesModerate') && rowActions(row).noindex"
                    type="button"
                    class="vt-btn vt-btn--ghost vt-btn--sm"
                    :aria-label="`Принудительный noindex · ${row.name}`"
                    :disabled="rowActions(row).noindexDisabled"
                    :title="
                      rowActions(row).noindexDisabled
                        ? 'Владелец уже закрыл страницу от поиска'
                        : undefined
                    "
                    data-action="noindex"
                    @click="moderation = { kind: 'noindex', page: row }"
                  >
                    Noindex
                  </button>
                  <button
                    v-if="can('groupPagesModerate') && rowActions(row).hide"
                    type="button"
                    class="vt-btn vt-btn--ghost vt-btn--sm vt-mod-danger"
                    :aria-label="`Скрыть · ${row.name}`"
                    data-action="hide"
                    @click="moderation = { kind: 'hidden', page: row }"
                  >
                    Скрыть
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <div class="vt-mod-legend">
            <p>
              <b>Noindex</b> — открыта по ссылке, но закрыта от поиска, sitemap и каталога города,
              даже если владелец включил индексацию.
            </p>
            <p>
              <b>Скрыть</b> — страница отдаёт 404, как неопубликованная. Запись в Telegram работает
              в обоих случаях.
            </p>
          </div>
        </section>
      </div>
    </template>

    <RootModerationDialog
      v-if="moderation"
      :model-value="true"
      :kind="moderation.kind"
      :organization-id="moderation.page.organizationId"
      :name="moderation.page.name"
      :city="moderation.page.city"
      :preset="moderation.page.moderation?.reasonCode ?? null"
      :preset-note="moderation.page.moderation?.note ?? null"
      @update:model-value="moderation = null"
      @done="onModerated"
      @stale="refreshAll()"
    />
    <RootRestoreDialog
      v-if="restoring"
      :model-value="true"
      :page="restoring"
      @update:model-value="restoring = null"
      @done="onRestored"
      @stale="refreshAll()"
    />
    <RootHistoryDialog
      v-if="history"
      :model-value="true"
      :page="history"
      @update:model-value="history = null"
    />
    <VtToast />
  </div>
</template>
