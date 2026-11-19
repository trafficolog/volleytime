<script setup lang="ts">
import type { PlatformAuditEntry, PlatformAuditPage } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import {
  AUDIT_CATEGORY_OPTIONS,
  AUDIT_PERIOD_OPTIONS,
  type AuditFilters,
  auditCounter,
  auditEntryView,
  auditQuery,
} from '~/utils/root-audit'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Аудит платформы — Root Admin' })

const SEARCH_DELAY_MS = 300

const filters = reactive<AuditFilters>({ period: '7d', organizationId: '', category: '', q: '' })
const entries = ref<PlatformAuditEntry[]>([])
const organizations = ref<PlatformAuditPage['organizations']>([])
const total = ref(0)
const nextCursor = ref<number | null>(null)
const pending = ref(true)
const loadingMore = ref(false)
const failed = ref(false)
let requestSeq = 0

async function load(more = false) {
  const seq = ++requestSeq
  failed.value = false
  if (more) loadingMore.value = true
  else pending.value = true
  try {
    const page = await $fetch<PlatformAuditPage>('/api/platform/audit', {
      query: auditQuery(filters, more ? (nextCursor.value ?? undefined) : undefined),
    })
    if (seq !== requestSeq) return
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
    organizations.value = page.organizations
    total.value = page.total
    nextCursor.value = page.nextCursor
  } catch (e) {
    if (seq !== requestSeq) return
    // Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход
    const reaction = rootOverviewFailure(apiErrorStatus(e))
    if (reaction === 'forbidden') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Раздел доступен только администратору платформы',
        fatal: true,
      })
    }
    if (reaction === 'login') await navigateTo('/auth/login')
    failed.value = true
  } finally {
    if (seq === requestSeq) {
      pending.value = false
      loadingMore.value = false
    }
  }
}

await load()

watch(
  () => [filters.period, filters.organizationId, filters.category],
  () => load(),
)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => load(), SEARCH_DELAY_MS)
  },
)
onBeforeUnmount(() => clearTimeout(searchTimer))

const rows = computed(() => entries.value.map((e) => auditEntryView(e)))
const counter = computed(() => auditCounter(entries.value.length, total.value))
</script>

<template>
  <div class="vt-root-audit">
    <header class="vt-root-overview__heading">
      <h1 tabindex="-1">
        Аудит платформы <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
      </h1>
      <p class="text-vt-mute-2">Append-only журнал · все root-действия и системные события</p>
    </header>

    <form class="vt-root-audit__filters" role="search" @submit.prevent="load()">
      <label>
        <span class="sr-only">Период</span>
        <select v-model="filters.period" class="vt-field" name="period">
          <option v-for="o in AUDIT_PERIOD_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </label>
      <label>
        <span class="sr-only">Организация</span>
        <select v-model="filters.organizationId" class="vt-field" name="organization">
          <option value="">Все организации</option>
          <option v-for="o in organizations" :key="o.id" :value="String(o.id)">
            {{ o.name }}
          </option>
        </select>
      </label>
      <label>
        <span class="sr-only">Категория</span>
        <select v-model="filters.category" class="vt-field" name="category">
          <option v-for="o in AUDIT_CATEGORY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </label>
      <label>
        <span class="sr-only">Поиск по действию, исполнителю или email</span>
        <input
          v-model="filters.q"
          class="vt-field"
          type="search"
          name="q"
          maxlength="100"
          placeholder="Поиск по действию или исполнителю"
        />
      </label>
    </form>

    <SkeletonList v-if="pending && !entries.length" :count="6" />
    <ErrorState
      v-else-if="failed && !entries.length"
      message="Не удалось загрузить журнал"
      @retry="load()"
    />
    <template v-else>
      <EmptyState
        v-if="!rows.length"
        icon="clock"
        title="Записей нет"
        description="Измените период или фильтры"
      />
      <div v-else class="vt-card vt-root-audit__table-wrap" :aria-busy="pending">
        <table class="vt-root-audit__table">
          <caption class="sr-only">
            Журнал действий платформы, новые записи сверху
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Время</th>
              <th scope="col" class="vt-cap">Событие</th>
              <th scope="col" class="vt-cap">Кто</th>
              <th scope="col" class="vt-cap">Организация</th>
              <th scope="col" class="vt-cap">Объект</th>
              <th scope="col" class="vt-cap">Детали</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" data-audit-row>
              <td class="vt-mono vt-root-audit__time">
                <time :datetime="row.title">{{ row.time }}</time>
              </td>
              <td class="vt-mono">{{ row.action }}</td>
              <td class="vt-mono">{{ row.actor }}</td>
              <td class="vt-mono vt-root-audit__target">{{ row.target }}</td>
              <td class="vt-mono">{{ row.object }}</td>
              <td class="vt-root-audit__details" :title="row.details">{{ row.details }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="vt-root-audit__foot">
        <span class="vt-mono" data-audit-counter>{{ counter }}</span>
        <p v-if="failed" role="alert" class="vt-root-audit__error">Не удалось обновить журнал</p>
        <button
          v-if="nextCursor !== null"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="loadingMore"
          @click="load(true)"
        >
          {{ loadingMore ? 'Загрузка…' : 'Загрузить ещё' }}
        </button>
      </footer>
    </template>
  </div>
</template>
