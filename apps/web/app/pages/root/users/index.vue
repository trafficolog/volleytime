<script setup lang="ts">
import type { PlatformUsersPage } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import { rootOverviewFailure } from '~/utils/root-overview'
import {
  DEFAULT_USER_FILTERS,
  USER_PAGE_SIZE,
  type UserFilters,
  userApiQuery,
  userChips,
  userCounter,
  userFiltersFromQuery,
  userFiltersToQuery,
  userKpis,
  userRowView,
  userSubtitle,
} from '~/utils/root-users'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Пользователи — Root Admin' })

const SEARCH_DELAY_MS = 300

const route = useRoute()
const router = useRouter()
// Фильтры живут в URL: обновление страницы и ссылка сохраняют выбор
const filters = computed(() => userFiltersFromQuery(route.query))

const { data, pending, error, refresh } = await useFetch<PlatformUsersPage>('/api/platform/users', {
  key: 'root-users',
  query: computed(() => userApiQuery(filters.value)),
})
// Роль root решает API: вошедший не-root получает 403 (страница ошибки), истёкшая сессия — вход
const failure = computed(() => rootOverviewFailure(apiErrorStatus(error.value)))
if (error.value && failure.value === 'forbidden') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Нет доступа к разделу',
    fatal: true,
  })
}
if (error.value && failure.value === 'login') await navigateTo('/auth/login')

function apply(patch: Partial<UserFilters>, replace = false) {
  const next = { ...filters.value, page: 1, ...patch }
  const query = userFiltersToQuery(next)
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

const now = computed(() => new Date())
const chips = computed(() => (data.value ? userChips(data.value.counts) : []))
const kpis = computed(() => (data.value ? userKpis(data.value.counts) : []))
const rows = computed(() => (data.value?.items ?? []).map((u) => userRowView(u, now.value)))
const total = computed(() => data.value?.total ?? 0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / USER_PAGE_SIZE)))
const anyFilter = computed(
  () => JSON.stringify(userFiltersToQuery({ ...filters.value, page: 1 })) !== '{}',
)

function reset() {
  search.value = ''
  return router.push({ query: userFiltersToQuery(DEFAULT_USER_FILTERS) })
}
</script>

<template>
  <div class="vt-root-orgs vt-root-users">
    <header class="vt-root-overview__heading vt-root-orgs__head">
      <div>
        <h1 tabindex="-1">
          Пользователи <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p v-if="data" class="text-vt-mute-2">{{ userSubtitle(data.counts) }}</p>
      </div>
    </header>

    <ul v-if="kpis.length" class="vt-root-org__kpis" aria-label="Показатели пользователей">
      <li v-for="k in kpis" :key="k.label" class="vt-card">
        <p class="vt-cap">{{ k.label }}</p>
        <p class="vt-root-org__kpi-value vt-mono">{{ k.value }}</p>
        <p class="vt-root-org__kpi-note">{{ k.note }}</p>
      </li>
    </ul>

    <div class="vt-root-orgs__toolbar">
      <div class="vt-root-orgs__chips" role="group" aria-label="Статус пользователей">
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
          <span class="vt-root-orgs__count">{{ chip.count }}</span>
        </button>
      </div>
      <label class="vt-root-orgs__search">
        <span class="sr-only">Поиск по имени, email, Telegram или номеру</span>
        <input
          v-model="search"
          class="vt-field"
          type="search"
          name="q"
          maxlength="100"
          placeholder="Имя, email, @telegram, usr_…"
        />
      </label>
    </div>

    <SkeletonList v-if="pending && !data" :count="5" />
    <ErrorState
      v-else-if="error || !data"
      message="Не удалось загрузить пользователей"
      @retry="refresh()"
    />
    <template v-else>
      <EmptyState
        v-if="!rows.length"
        icon="users"
        title="Пользователей нет"
        description="Измените фильтр или поиск"
      >
        <template v-if="anyFilter" #action>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="reset()">
            Сбросить фильтры
          </button>
        </template>
      </EmptyState>
      <div v-else class="vt-card vt-root-orgs__table-wrap" :aria-busy="pending">
        <table class="vt-root-orgs__table vt-root-users__table">
          <caption class="sr-only">
            Пользователи платформы
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Пользователь</th>
              <th scope="col" class="vt-cap">Telegram</th>
              <th scope="col" class="vt-cap">Email</th>
              <th scope="col" class="vt-cap">Групп</th>
              <th scope="col" class="vt-cap">Записей</th>
              <th scope="col" class="vt-cap">Активн.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" data-user-row>
              <td>
                <div class="vt-root-orgs__name">
                  <span class="vt-root-orgs__avatar" aria-hidden="true">{{ row.initials }}</span>
                  <div>
                    <NuxtLink :to="`/root/users/${row.id}`" class="vt-root-orgs__link">
                      {{ row.name }}
                    </NuxtLink>
                    <span v-if="row.blocked" class="vt-chip vt-chip--rose">заблокирован</span>
                    <span v-else-if="row.root" class="vt-chip vt-chip--solid">ROOT</span>
                    <div class="vt-mono vt-root-orgs__code">{{ row.code }}</div>
                  </div>
                </div>
              </td>
              <td class="vt-mono vt-root-users__contact" :data-empty="row.telegram === '—'">
                {{ row.telegram }}
              </td>
              <td class="vt-mono vt-root-users__contact" :data-empty="row.email === '—'">
                {{ row.email }}
              </td>
              <td>
                <span class="vt-mono vt-root-users__groups">{{ row.groups }}</span>
                <span v-if="row.role" class="vt-root-users__role">· {{ row.role }}</span>
              </td>
              <td class="vt-mono vt-root-users__groups">{{ row.bookings }}</td>
              <td>
                <span class="vt-root-orgs__tone" :data-tone="row.tone" aria-hidden="true" />
                {{ row.activity }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="vt-root-audit__foot">
        <span class="vt-mono" data-user-counter>{{ userCounter(rows.length, total) }}</span>
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
