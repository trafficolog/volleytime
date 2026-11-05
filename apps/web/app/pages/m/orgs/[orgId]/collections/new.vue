<script setup lang="ts">
import { DEFAULT_TIMEZONE } from '@volley-time/shared'

import { isManagerMember } from '~/utils/organizer-collections'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Новый сбор организатора (21.1.5, `OrgContribCreate`). Доступен организатору и владельцу при
 * включённом `COLLECTIONS_ENABLED`; при выключенном флаге создание скрыто.
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const listPath = computed(() => `/m/orgs/${orgId.value}/collections`)
const toast = useToast()
const { haptic } = useTelegram()
const { data: orgData, error: orgError } = await useFetch<{
  organization: { id: number; defaultCurrency?: string; defaultTimezone?: string }
  capabilities?: { collections?: boolean }
  myMember?: { role: string; status: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-nav-${orgId.value}` })

const org = computed(() =>
  !orgError.value && orgData.value?.organization?.id === orgId.value
    ? orgData.value.organization
    : null,
)
const isManager = computed(() => org.value !== null && isManagerMember(orgData.value?.myMember))
// флаг мог выключиться после загрузки страницы: сервер ответит collection.disabled
const disabledByServer = ref(false)
const enabled = computed(
  () => orgData.value?.capabilities?.collections === true && !disabledByServer.value,
)
const busy = ref(false)
const serverError = ref('')
let alive = true
onBeforeUnmount(() => {
  alive = false
})

async function save(body: Record<string, unknown>) {
  if (!enabled.value || busy.value) return
  const targetOrgId = orgId.value
  const expectedPath = route.path
  busy.value = true
  serverError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/collections`, { method: 'POST', body })
    haptic('success')
    toast.show(`Создан сбор «${String(body.title)}»`)
    if (alive && route.path === expectedPath) await navigateTo(`/m/orgs/${targetOrgId}/collections`)
  } catch (e) {
    haptic('error')
    if (!alive) return
    if (apiErrorCode(e) === 'collection.disabled') {
      disabledByServer.value = true
      serverError.value = ''
    } else serverError.value = apiErrorMessage(e, 'Не удалось создать сбор')
  } finally {
    if (alive) busy.value = false
  }
}
</script>

<template>
  <OrganizerCollectionForm
    v-if="isManager && enabled"
    mode="create"
    title="Новый сбор"
    :back="listPath"
    :tz="org?.defaultTimezone ?? DEFAULT_TIMEZONE"
    :currency="org?.defaultCurrency ?? 'BYN'"
    :busy="busy"
    :server-error="serverError"
    @submit="save"
  />
  <div v-else class="min-h-screen pb-10">
    <VtMiniHeader title="Новый сбор" :back="listPath" />
    <main class="px-4 py-3">
      <ErrorState
        v-if="!org"
        message="Не удалось проверить настройки группы. Создание сборов недоступно."
        :retry="false"
      />
      <EmptyState
        v-else-if="!isManager"
        icon="lock"
        title="Только для организаторов"
        description="Создавать сборы могут владелец и организаторы группы"
      >
        <template #action>
          <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
      <EmptyState
        v-else
        icon="gift"
        title="Создание сборов пока недоступно"
        description="Существующие сборы можно разбирать и закрывать, новые появятся позже"
      >
        <template #action>
          <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
    </main>
  </div>
</template>
