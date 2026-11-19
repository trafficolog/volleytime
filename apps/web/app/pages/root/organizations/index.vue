<script setup lang="ts">
import type { PlatformOrganizationsPage, PlatformOrgSort } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import {
  DEFAULT_ORG_FILTERS,
  ORG_PAGE_SIZE,
  type OrgFilters,
  orgApiQuery,
  orgChips,
  orgCounter,
  orgFiltersFromQuery,
  orgFiltersToQuery,
  orgPanelFilterCount,
  orgRowView,
  orgSubtitle,
} from '~/utils/root-organizations'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Организации — Root Admin' })

const SEARCH_DELAY_MS = 300

const route = useRoute()
const router = useRouter()
// Фильтры живут в URL: обновление страницы и ссылка сохраняют выбор
const filters = computed(() => orgFiltersFromQuery(route.query))

const { data, pending, error, refresh } = await useFetch<PlatformOrganizationsPage>(
  '/api/platform/organizations',
  { key: 'root-organizations', query: computed(() => orgApiQuery(filters.value)) },
)
// Роль root решает API: вошедший не-root получает 403 (страница ошибки), истёкшая сессия — вход
const failure = computed(() => rootOverviewFailure(apiErrorStatus(error.value)))
if (error.value && failure.value === 'forbidden') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Раздел доступен только администратору платформы',
    fatal: true,
  })
}
if (error.value && failure.value === 'login') await navigateTo('/auth/login')

function apply(patch: Partial<OrgFilters>, replace = false) {
  const next = { ...filters.value, page: 1, ...patch }
  const query = orgFiltersToQuery(next)
  return replace ? router.replace({ query }) : router.push({ query })
}

const search = ref(filters.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== filters.value.q) apply({ q: value.trim() }, true)
  }, SEARCH_DELAY_MS)
})
// «назад» в браузере меняет URL: поле поиска следует за ним
watch(
  () => filters.value.q,
  (q) => {
    if (q !== search.value.trim()) search.value = q
  },
)
onBeforeUnmount(() => clearTimeout(searchTimer))

const panelOpen = ref(false)
const panelCount = computed(() => orgPanelFilterCount(filters.value))
const now = computed(() => new Date())
const chips = computed(() => (data.value ? orgChips(data.value.counts) : []))
const rows = computed(() => (data.value?.items ?? []).map((o) => orgRowView(o, now.value)))
const total = computed(() => data.value?.total ?? 0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / ORG_PAGE_SIZE)))
const anyFilter = computed(
  () => JSON.stringify(orgFiltersToQuery({ ...filters.value, page: 1 })) !== '{}',
)

function setSort(event: Event) {
  apply({ sort: (event.target as HTMLSelectElement).value as PlatformOrgSort })
}
function reset() {
  search.value = ''
  panelOpen.value = false
  return router.push({ query: orgFiltersToQuery(DEFAULT_ORG_FILTERS) })
}
</script>

<template>
  <div class="vt-root-orgs">
    <header class="vt-root-overview__heading vt-root-orgs__head">
      <div>
        <h1 tabindex="-1">
          Организации <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p v-if="data" class="text-vt-mute-2">{{ orgSubtitle(data.counts) }}</p>
      </div>
      <NuxtLink to="/root/organizations/new" class="vt-btn vt-btn--primary vt-btn--sm">
        <VtIcon name="plus" :size="14" /> Создать вручную
      </NuxtLink>
    </header>

    <div class="vt-root-orgs__toolbar">
      <div class="vt-root-orgs__chips" role="group" aria-label="Статус организаций">
        <button
          v-for="chip in chips"
          :key="chip.value"
          type="button"
          class="vt-btn vt-btn--sm vt-root-orgs__chip"
          :aria-pressed="filters.status === chip.value"
          :data-chip="chip.value"
          @click="apply({ status: chip.value })"
        >
          {{ chip.label }}
          <span class="vt-root-orgs__count" :data-tint="chip.tint">{{ chip.count }}</span>
        </button>
      </div>
      <label class="vt-root-orgs__search">
        <span class="sr-only">Поиск по названию, коду, владельцу или email</span>
        <input
          v-model="search"
          class="vt-field"
          type="search"
          name="q"
          maxlength="100"
          placeholder="Название, код, владелец"
        />
      </label>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        aria-controls="root-orgs-filters"
        :aria-expanded="panelOpen"
        @click="panelOpen = !panelOpen"
      >
        Фильтры<span v-if="panelCount" class="vt-root-orgs__count" data-tint="amber">{{
          panelCount
        }}</span>
      </button>
    </div>

    <fieldset v-show="panelOpen" id="root-orgs-filters" class="vt-card vt-root-orgs__panel">
      <legend class="vt-cap">Фильтры организаций</legend>
      <label class="vt-root-orgs__check">
        <input
          type="checkbox"
          :checked="filters.lowBalance"
          @change="apply({ lowBalance: ($event.target as HTMLInputElement).checked })"
        />
        Баланс заканчивается
      </label>
      <label class="vt-root-orgs__check">
        <input
          type="checkbox"
          :checked="filters.inactive"
          @change="apply({ inactive: ($event.target as HTMLInputElement).checked })"
        />
        Неактивны больше 7 дней
      </label>
      <label class="vt-root-orgs__sort">
        <span class="vt-label">Сортировка</span>
        <select class="vt-field" name="sort" :value="filters.sort" @change="setSort">
          <option value="activity">По последней активности</option>
          <option value="events">По убыванию событий за месяц</option>
        </select>
      </label>
      <button
        v-if="anyFilter"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        @click="reset()"
      >
        Сбросить всё
      </button>
    </fieldset>

    <SkeletonList v-if="pending && !data" :count="5" />
    <ErrorState
      v-else-if="error || !data"
      message="Не удалось загрузить организации"
      @retry="refresh()"
    />
    <template v-else>
      <EmptyState
        v-if="!rows.length"
        icon="home"
        title="Организаций нет"
        description="Измените фильтры или поиск"
      >
        <template v-if="anyFilter" #action>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="reset()">
            Сбросить фильтры
          </button>
        </template>
      </EmptyState>
      <div v-else class="vt-card vt-root-orgs__table-wrap" :aria-busy="pending">
        <table class="vt-root-orgs__table">
          <caption class="sr-only">
            Организации платформы
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Организация</th>
              <th scope="col" class="vt-cap">Владелец</th>
              <th scope="col" class="vt-cap">Баланс</th>
              <th scope="col" class="vt-cap">Игроки</th>
              <th scope="col" class="vt-cap">Событий / мес</th>
              <th scope="col" class="vt-cap">Активн.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" data-org-row>
              <td>
                <div class="vt-root-orgs__name">
                  <span class="vt-root-orgs__avatar" aria-hidden="true">{{ row.initials }}</span>
                  <div>
                    <NuxtLink :to="`/root/organizations/${row.id}`" class="vt-root-orgs__link">
                      {{ row.name }}
                    </NuxtLink>
                    <span v-if="row.blocked" class="vt-chip vt-chip--rose">заблокирована</span>
                    <span v-else-if="row.lowBalance" class="vt-chip vt-chip--amber"
                      >низкий баланс</span
                    >
                    <div class="vt-mono vt-root-orgs__code">{{ row.code }}</div>
                  </div>
                </div>
              </td>
              <td>{{ row.owner }}</td>
              <td class="vt-mono vt-root-orgs__balance" :data-low="row.lowBalance">
                {{ row.balance }}
              </td>
              <td class="vt-mono">{{ row.members }}</td>
              <td>
                <span class="vt-mono vt-root-orgs__events">{{ row.eventsMonth }}</span>
                <VtMeter :value="row.eventsPercent" :max="100" label="Событий за 30 дней" />
              </td>
              <td>
                <span class="vt-root-orgs__tone" :data-tone="row.tone" aria-hidden="true" />
                {{ row.activity }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="vt-root-audit__foot">
        <span class="vt-mono" data-org-counter>{{ orgCounter(rows.length, total) }}</span>
        <nav v-if="lastPage > 1" class="vt-root-orgs__pager" aria-label="Страницы">
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="filters.page <= 1"
            @click="apply({ page: filters.page - 1 })"
          >
            Назад
          </button>
          <span class="vt-mono">{{ filters.page }} / {{ lastPage }}</span>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="filters.page >= lastPage"
            @click="apply({ page: filters.page + 1 })"
          >
            Далее
          </button>
        </nav>
      </footer>
    </template>
  </div>
</template>
