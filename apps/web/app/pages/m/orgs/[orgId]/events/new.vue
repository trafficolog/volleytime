<script setup lang="ts">
import type { Organization } from '@volley-time/db'

import { seriesResultLines, type SeriesCreatedView } from '~/utils/event-series'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })
const route = useRoute()
const { isTelegram, webApp } = useTelegram()
const router = useRouter()
const orgId = computed(() => Number(route.params.orgId))
const {
  data: orgData,
  error: orgError,
  status: orgStatus,
} = await useFetch<{
  organization: Organization
  capabilities: { eventSplitPricing: boolean; eventInviteMode?: boolean }
  myMember: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `event-new-org-${orgId.value}` })
const org = computed(() =>
  orgStatus.value === 'success' &&
  !orgError.value &&
  Number.isInteger(orgId.value) &&
  orgId.value > 0 &&
  orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
const canCreate = computed(() => {
  const m = orgData.value?.myMember
  return !!org.value && !!m && m.status === 'active' && ['owner', 'organizer'].includes(m.role)
})
function onSaved(event: { id: number; organizationId: number }) {
  if (!canCreate.value || event.organizationId !== orgId.value) return
  if (Number(route.params.orgId) !== event.organizationId) return
  if (router.currentRoute.value.path !== `/m/orgs/${event.organizationId}/events/new`) return
  return navigateTo(`/m/orgs/${event.organizationId}/events/${event.id}`)
}

// Серия создаётся целиком (D-04): вместо перехода показываем итог — опубликовано, черновики, баланс.
const seriesResult = ref<SeriesCreatedView | null>(null)
const resultHeading = ref<HTMLElement | null>(null)
const formKey = ref(0)
async function onSeriesCreated(result: SeriesCreatedView) {
  if (!canCreate.value) return
  if (router.currentRoute.value.path !== `/m/orgs/${orgId.value}/events/new`) return
  seriesResult.value = result
  await nextTick()
  // форма была длинной: возвращаем экран к началу, иначе итог уходит под липкую шапку
  window.scrollTo({ top: 0 })
  resultHeading.value?.focus({ preventScroll: true })
}
function createAnother() {
  seriesResult.value = null
  formKey.value++
}

// В Telegram основное действие — системная MainButton (20.4.1); кнопка формы скрыта только там.
interface FormHandle {
  submit: () => Promise<void>
  submitDisabled: boolean
  submitText: string
  saving: boolean
}
const formRef = ref<FormHandle | null>(null)
const nativeSubmit = computed(() => isTelegram.value)
const mainButton = createMainButton(isTelegram.value ? webApp : undefined, () => {
  void formRef.value?.submit()
})
onMounted(() => {
  watchEffect(() => {
    const form = formRef.value
    mainButton.update(
      form && !seriesResult.value && canCreate.value
        ? { text: form.submitText, disabled: form.submitDisabled, loading: form.saving }
        : null,
    )
  })
})
onUnmounted(() => mainButton.destroy())
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Новое событие" :back="`/m/orgs/${orgId}/events`" />
    <main class="px-4 py-4">
      <SkeletonList v-if="orgStatus === 'pending'" :count="2" />
      <ErrorState v-else-if="orgError" message="Не удалось открыть группу" :retry="false" />
      <EmptyState
        v-else-if="!canCreate"
        icon="calendar"
        title="Создавать события могут организаторы"
        description="Попросите организатора группы добавить тренировку."
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
        <p v-for="line in seriesResultLines(seriesResult)" :key="line" class="text-sm">
          {{ line }}
        </p>
        <div class="flex flex-wrap gap-2 pt-2">
          <NuxtLink :to="`/m/orgs/${orgId}/events`" class="vt-btn vt-btn--primary">
            К событиям
          </NuxtLink>
          <button type="button" class="vt-btn vt-btn--ghost" @click="createAnother">
            Создать ещё
          </button>
        </div>
      </section>
      <EventForm
        v-else
        ref="formRef"
        :key="`${orgId}:${formKey}`"
        :org-id="orgId"
        :tz="org!.defaultTimezone"
        :subscriptions-enabled="org!.subscriptionsEnabled"
        :currency="org!.defaultCurrency"
        :split-pricing-enabled="orgData?.capabilities?.eventSplitPricing === true"
        :invite-mode-enabled="orgData?.capabilities?.eventInviteMode === true"
        allow-series
        :hide-submit="nativeSubmit"
        submit-label="Создать событие"
        @saved="onSaved"
        @series-created="onSeriesCreated"
      />
    </main>
  </div>
</template>
