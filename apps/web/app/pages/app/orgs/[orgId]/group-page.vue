<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import type { GroupPageView } from '@volley-time/shared'

import GroupPageBuilder from '~/components/desktop/group-page/GroupPageBuilder.vue'
import type { PlayerLevelCode } from '~/utils/group-settings'

/** Конструктор страницы группы (24.1.1, W-13, D-24): владелец правит, организатор смотрит. */
definePageMeta({
  layout: 'desktop-org',
  middleware: ['auth'],
  key: (route) => `group-page-${route.params.orgId}`,
})

const route = useRoute()
const orgId = Number(route.params.orgId)
const base = `/app/orgs/${orgId}`
const toast = useToast()

const { data: orgData, error: orgError } = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(`/api/organizations/${orgId}`, { key: `desktop-org-${orgId}` })
const {
  data: pageData,
  error: pageError,
  refresh,
} = await useFetch<{ page: GroupPageView }>(`/api/organizations/${orgId}/group-page`, {
  key: `desktop-group-page-${orgId}`,
})
const { data: levelsData } = useFetch<{
  levels: { code: PlayerLevelCode; title: string; description: string }[]
}>('/api/levels', { key: 'levels', lazy: true })

const actor = computed(() => orgData.value?.myMember ?? null)
const isOwner = computed(() => actor.value?.role === 'owner' && actor.value.status === 'active')
const levelTitles = computed(() =>
  Object.fromEntries((levelsData.value?.levels ?? []).map((l) => [l.code, l.title])),
)

const request = <T,>(url: string, init: { method: 'PUT' | 'PATCH'; body: unknown }) =>
  (globalThis.$fetch as unknown as (u: string, i: unknown) => Promise<unknown>)(
    url,
    init,
  ) as Promise<T>

const dirty = ref(false)
onBeforeRouteLeave(
  () => !dirty.value || window.confirm('Есть несохранённые изменения. Уйти без сохранения?'),
)
</script>

<template>
  <section class="vt-settings">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Страница группы</h1>
        <p class="text-vt-mute-2">
          Публичная страница для поиска: секции, порядок, заголовок и предпросмотр.
        </p>
      </div>
    </header>

    <ErrorState
      v-if="orgError || pageError"
      message="Не удалось открыть страницу группы"
      @retry="refresh"
    />
    <SkeletonList v-else-if="!pageData || !orgData" :count="3" />
    <GroupPageBuilder
      v-else
      :view="pageData.page"
      :can-edit="isOwner"
      :level-titles="levelTitles"
      :base="base"
      :request="request"
      :toast="toast.show"
      @dirty="dirty = $event"
      @saved="pageData = { page: $event }"
    />
    <VtToast />
  </section>
</template>
