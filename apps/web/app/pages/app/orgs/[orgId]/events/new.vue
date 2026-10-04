<script setup lang="ts">
import type { Organization } from '@volley-time/db'

import { canSubmitDesktopEventAction } from '~/utils/desktop-event-actions'

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
  capabilities: { eventSplitPricing: boolean }
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
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <NuxtLink :to="base" class="vt-btn vt-btn--ghost">К событиям</NuxtLink>
    <header>
      <h1 tabindex="-1">Новое событие</h1>
      <p class="text-vt-mute-2">Создайте тренировку с рабочими полями текущего MVP.</p>
    </header>
    <SkeletonList v-if="orgPending" :count="2" />
    <ErrorState
      v-else-if="orgError || !canSubmit()"
      message="Не удалось открыть форму события"
      @retry="refreshOrg()"
    />
    <div v-else class="vt-card vt-desktop-form-page__card">
      <EventForm
        :org-id="orgId"
        :tz="tz"
        :currency="orgData!.organization.defaultCurrency"
        :subscriptions-enabled="orgData!.organization.subscriptionsEnabled"
        :split-pricing-enabled="orgData?.capabilities?.eventSplitPricing === true"
        submit-label="Создать событие"
        :can-submit="canSubmit"
        @saved="saved"
      />
    </div>
  </section>
</template>
