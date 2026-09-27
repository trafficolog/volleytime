<script setup lang="ts">
import type { OrganizationListItem } from '~/composables/useOrganizations'

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Мои группы — Volley Time' })

const { orgs, fetchAll } = useOrganizations()
const route = useRoute()
const loading = ref(true)
const error = ref('')
const eligible = computed(() =>
  orgs.value.filter(
    (org) =>
      org.membershipStatus === 'active' &&
      (org.membershipRole === 'owner' || org.membershipRole === 'organizer') &&
      org.status !== 'archived',
  ),
)
const active = computed(() => eligible.value.filter((org) => org.status === 'active'))

async function load() {
  loading.value = true
  error.value = ''
  try {
    await fetchAll()
    if (active.value.length === 1 && route.query.choose !== '1')
      await navigateTo(`/app/orgs/${active.value[0]!.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e, 'Не удалось загрузить группы')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function groupLabel(org: OrganizationListItem) {
  return org.status === 'suspended' ? 'Приостановлена' : 'Открыть кабинет'
}
</script>

<template>
  <main class="vt-desktop__entry space-y-6">
    <header class="space-y-3">
      <NuxtLink to="/" class="vt-desktop__brand !p-0">
        <img src="/logo.png" alt="" width="32" height="32" /> Volley Time
      </NuxtLink>
      <h1 class="text-3xl">Мои группы</h1>
      <p class="text-vt-mute-2">Выберите группу для работы в кабинете организатора.</p>
    </header>

    <p v-if="loading" role="status">Загружаем группы…</p>
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <div v-else class="space-y-4">
      <ul v-if="eligible.length" class="space-y-3">
        <li
          v-for="org in eligible"
          :key="org.id"
          class="vt-card p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <h2 class="text-xl">{{ org.name }}</h2>
            <p class="text-vt-mute-2">{{ org.city || 'Город не указан' }}</p>
          </div>
          <NuxtLink
            v-if="org.status === 'active'"
            :to="`/app/orgs/${org.id}`"
            class="vt-btn vt-btn--primary"
            >{{ groupLabel(org) }}</NuxtLink
          >
          <span v-else class="text-vt-mute-2">{{ groupLabel(org) }}</span>
        </li>
      </ul>
      <p v-else class="vt-card p-5">У вас пока нет группы для управления.</p>
      <NuxtLink to="/app/orgs/new" class="vt-btn vt-btn--ghost">Создать группу</NuxtLink>
    </div>
  </main>
</template>
