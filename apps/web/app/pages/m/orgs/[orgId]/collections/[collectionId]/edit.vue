<script setup lang="ts">
import { DEFAULT_TIMEZONE } from '@volley-time/shared'

import { isManagerMember, type ManagedCollection } from '~/utils/organizer-collections'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Правка сбора организатора (21.1.5): название, описание, иконка, цель и дедлайн; отправляются
 * только изменённые поля. Скрыта при выключенном `COLLECTIONS_ENABLED`; завершённый и отменённый
 * сбор не меняется.
 */
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const collectionId = computed(() => Number(route.params.collectionId))
const detailPath = computed(() => `/m/orgs/${orgId.value}/collections/${collectionId.value}`)
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
const disabledByServer = ref(false)
const enabled = computed(
  () => orgData.value?.capabilities?.collections === true && !disabledByServer.value,
)

const collection = ref<ManagedCollection | null>(null)
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const busy = ref(false)
const serverError = ref('')
let alive = true
onBeforeUnmount(() => {
  alive = false
})

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const result = await $fetch<{ collection: ManagedCollection }>(
      `/api/organizations/${orgId.value}/collections/${collectionId.value}`,
    )
    collection.value = result.collection
  } catch (e) {
    collection.value = null
    if (apiErrorCode(e) === 'collection.not_found') notFound.value = true
    else loadError.value = apiErrorMessage(e, 'Не удалось загрузить сбор')
  } finally {
    loading.value = false
  }
}
if (isManager.value && enabled.value) await load()

const closed = computed(
  () => collection.value?.status === 'completed' || collection.value?.status === 'cancelled',
)

async function save(body: Record<string, unknown>) {
  if (!enabled.value || busy.value) return
  if (Object.keys(body).length === 0) {
    await navigateTo(detailPath.value)
    return
  }
  const expectedPath = route.path
  busy.value = true
  serverError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/collections/${collectionId.value}`, {
      method: 'PATCH',
      body,
    })
    haptic('success')
    toast.show('Сбор обновлён')
    if (alive && route.path === expectedPath) await navigateTo(detailPath.value)
  } catch (e) {
    haptic('error')
    if (!alive) return
    if (apiErrorCode(e) === 'collection.not_active') {
      serverError.value = 'Сбор уже закрыт, изменить его нельзя'
      await load()
    } else serverError.value = apiErrorMessage(e, 'Не удалось сохранить сбор')
  } finally {
    if (alive) busy.value = false
  }
}
</script>

<template>
  <OrganizerCollectionForm
    v-if="isManager && enabled && collection && !closed"
    mode="edit"
    title="Изменить сбор"
    :back="detailPath"
    :tz="org?.defaultTimezone ?? DEFAULT_TIMEZONE"
    :currency="collection.currency"
    :collection="collection"
    :busy="busy"
    :server-error="serverError"
    @submit="save"
  />
  <div v-else class="min-h-screen pb-10">
    <VtMiniHeader title="Изменить сбор" :back="detailPath" />
    <main class="px-4 py-3">
      <ErrorState
        v-if="!org"
        message="Не удалось проверить настройки группы. Правка сборов недоступна."
        :retry="false"
      />
      <EmptyState
        v-else-if="!isManager"
        icon="lock"
        title="Только для организаторов"
        description="Менять сборы могут владелец и организаторы группы"
      >
        <template #action>
          <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
      <EmptyState
        v-else-if="!enabled"
        icon="gift"
        title="Правка сборов пока недоступна"
        description="Сбор можно завершить или отменить на его экране"
      >
        <template #action>
          <NuxtLink :to="detailPath" class="vt-btn vt-btn--ghost">К сбору</NuxtLink>
        </template>
      </EmptyState>
      <SkeletonList v-else-if="loading" :count="3" />
      <EmptyState v-else-if="notFound" icon="gift" title="Сбор не найден">
        <template #action>
          <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="closed"
        icon="check"
        title="Сбор закрыт"
        description="Завершённый или отменённый сбор не меняется"
      >
        <template #action>
          <NuxtLink :to="detailPath" class="vt-btn vt-btn--ghost">К сбору</NuxtLink>
        </template>
      </EmptyState>
    </main>
  </div>
</template>
