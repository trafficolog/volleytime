<script setup lang="ts">
import type { AuditLogEntry, OrganizationMember } from '@volley-time/db'
import {
  auditActionLabel,
  auditEntityLabel,
  canViewOrgAuditUi,
} from '~/utils/organization-ui'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type AuditEntry = Omit<AuditLogEntry, 'createdAt'> & { createdAt: string }

const PAGE_SIZE = 50
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))

const {
  data: orgData,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const me = computed(() => orgData.value?.myMember ?? null)
const canView = computed(() => canViewOrgAuditUi(me.value))

const entries = ref<AuditEntry[]>([])
const loading = ref(false)
const loadError = ref('')
const nextOffset = ref(0)
const hasMore = ref(false)

async function load(reset = false) {
  if (!canView.value || loading.value) return

  loading.value = true
  loadError.value = ''
  const offset = reset ? 0 : nextOffset.value

  try {
    const data = await $fetch<{ entries: AuditEntry[] }>(
      `/api/organizations/${orgId.value}/audit`,
      {
        query: { offset, limit: PAGE_SIZE + 1 },
      },
    )
    const page = data.entries.slice(0, PAGE_SIZE)
    entries.value = reset ? page : [...entries.value, ...page]
    nextOffset.value = offset + page.length
    hasMore.value = data.entries.length > PAGE_SIZE
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить журнал')
  } finally {
    loading.value = false
  }
}

if (canView.value) await load(true)

watch(canView, async (value) => {
  if (value && entries.value.length === 0) await load(true)
})

function formatTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function detailsValue(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Журнал действий" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4">
      <ErrorState v-if="orgError" message="Не удалось проверить доступ" @retry="refreshOrg()" />
      <EmptyState
        v-else-if="!canView"
        icon="alert"
        title="Журнал доступен организаторам"
        description="Для просмотра истории действий нужны права владельца или организатора."
      />
      <template v-else>
        <SkeletonList v-if="loading && entries.length === 0" :count="4" />
        <ErrorState v-else-if="loadError && entries.length === 0" :message="loadError" @retry="load(true)" />
        <EmptyState
          v-else-if="entries.length === 0"
          icon="chart"
          title="Журнал пока пуст"
          description="Изменения группы и действия организаторов появятся здесь."
        />

        <ul v-else class="space-y-2.5">
          <li v-for="entry in entries" :key="entry.id" class="vt-card p-3.5">
            <div class="flex items-start gap-3">
              <VtIcon name="chart" :size="18" class="mt-0.5 shrink-0 text-vt-mute-2" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold">{{ auditActionLabel(entry.action) }}</div>
                <div class="text-xs text-vt-mute-2 mt-0.5">
                  {{ auditEntityLabel(entry.entityType) }} #{{ entry.entityId }}
                </div>
                <details
                  v-if="entry.oldValue !== null || entry.newValue !== null"
                  class="mt-2 text-xs"
                >
                  <summary class="cursor-pointer font-semibold text-vt-flame">Подробнее</summary>
                  <pre
                    class="mt-2 p-2 rounded-lg bg-vt-bone-2 overflow-x-auto whitespace-pre-wrap break-words"
                  >{{ detailsValue({ old: entry.oldValue, new: entry.newValue }) }}</pre>
                </details>
              </div>
              <time class="text-[11px] text-vt-mute-2 shrink-0" :datetime="entry.createdAt">
                {{ formatTime(entry.createdAt) }}
              </time>
            </div>
          </li>
        </ul>

        <p v-if="loadError && entries.length > 0" class="mt-3 text-sm text-vt-rose-ink" role="alert">
          {{ loadError }}
        </p>
        <button
          v-if="hasMore"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full mt-4"
          :disabled="loading"
          @click="load()"
        >
          {{ loading ? 'Загружаем…' : 'Показать ещё' }}
        </button>
      </template>
    </main>
  </div>
</template>
