<script setup lang="ts">
import type { Organization } from '@volley-time/db'

import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'
import { seriesResultLines, type SeriesCreatedView } from '~/utils/event-series'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}/events`)
const expectedPath = route.path
const { tz, load } = useOrgTimezone(orgId)
await load()
const {
  data: orgData,
  pending: orgPending,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: Organization
  myMember: { role: string; status: string }
  capabilities: { eventSplitPricing: boolean; eventInviteMode?: boolean }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-event-new-org-${orgId.value}` })
let alive = true
onBeforeUnmount(() => (alive = false))

function canSubmit() {
  const member = orgData.value?.myMember
  return (
    alive &&
    !orgError.value &&
    orgData.value?.organization.id === orgId.value &&
    member?.status === 'active' &&
    ['owner', 'organizer'].includes(member.role) &&
    canSubmitDesktopEventAction(route.path, expectedPath, false)
  )
}

function saved(event: { id: number }) {
  if (canSubmit()) void navigateTo(`${base.value}/${event.id}`)
}

// Серия создаётся целиком (D-04): вместо перехода показываем итог — сколько опубликовано, сколько
// черновиков и сколько баланса осталось.
const seriesResult = ref<SeriesCreatedView | null>(null)
const resultHeading = ref<HTMLElement | null>(null)
const formKey = ref(0)
async function seriesCreated(result: SeriesCreatedView) {
  if (!canSubmit()) return
  seriesResult.value = result
  await nextTick()
  resultHeading.value?.focus()
}
function createAnother() {
  seriesResult.value = null
  formKey.value++
}
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <NuxtLink :to="base" class="vt-btn vt-btn--ghost">К событиям</NuxtLink>
    <header>
      <h1 tabindex="-1">Новое событие</h1>
      <p class="text-vt-mute-2">
        Одно событие или серия: выберите повтор, и мы покажем даты и списание баланса событий.
      </p>
    </header>
    <SkeletonList v-if="orgPending" :count="2" />
    <ErrorState
      v-else-if="orgError || !canSubmit()"
      message="Не удалось открыть форму события"
      @retry="refreshOrg()"
    />
    <section
      v-else-if="seriesResult"
      class="vt-card space-y-3 p-5"
      aria-labelledby="series-result-title"
      role="status"
    >
      <h2 id="series-result-title" ref="resultHeading" class="text-lg font-bold" tabindex="-1">
        Серия создана
      </h2>
      <p v-for="line in seriesResultLines(seriesResult)" :key="line" class="text-sm">{{ line }}</p>
      <div class="flex flex-wrap gap-2 pt-2">
        <NuxtLink :to="base" class="vt-btn vt-btn--primary">К событиям</NuxtLink>
        <button type="button" class="vt-btn vt-btn--ghost" @click="createAnother">
          Создать ещё
        </button>
      </div>
    </section>
    <EventForm
      v-else
      :key="formKey"
      :org-id="orgId"
      :tz="tz"
      :currency="orgData!.organization.defaultCurrency"
      :subscriptions-enabled="orgData!.organization.subscriptionsEnabled"
      :split-pricing-enabled="orgData?.capabilities?.eventSplitPricing === true"
      :invite-mode-enabled="orgData?.capabilities?.eventInviteMode === true"
      allow-series
      submit-label="Создать событие"
      :can-submit="canSubmit"
      @saved="saved"
      @series-created="seriesCreated"
    />
  </section>
</template>
