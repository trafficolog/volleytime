<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import SettingsBookings from '~/components/desktop/settings/SettingsBookings.vue'
import SettingsDanger from '~/components/desktop/settings/SettingsDanger.vue'
import SettingsIntegrations from '~/components/desktop/settings/SettingsIntegrations.vue'
import SettingsNotifications from '~/components/desktop/settings/SettingsNotifications.vue'
import SettingsProfile from '~/components/desktop/settings/SettingsProfile.vue'
import SettingsTeam from '~/components/desktop/settings/SettingsTeam.vue'
import SettingsVenues from '~/components/desktop/settings/SettingsVenues.vue'
import { canSaveDesktopSettings } from '~/utils/desktop-settings'
import {
  parseSection,
  visibleSections,
  type GroupSettings,
  type PlayerLevelCode,
} from '~/utils/group-settings'
import { createSettingsController, type OrgProfile } from '~/utils/group-settings-controller'

// Ключ по группе: смена группы пересоздаёт страницу, смена раздела (?section=) — нет.
definePageMeta({
  layout: 'desktop-org',
  middleware: ['auth'],
  key: (route) => `settings-${route.params.orgId}`,
})

const route = useRoute()
const orgId = Number(route.params.orgId)
const base = `/app/orgs/${orgId}`
const path = `${base}/settings`
const config = useRuntimeConfig()
const { fetchAll } = useOrganizations()
const toast = useToast()
const {
  data,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{ organization: Organization; myMember: OrganizationMember }>(
  `/api/organizations/${orgId}`,
  { key: `desktop-org-${orgId}` },
)
const {
  data: settingsData,
  error: settingsError,
  refresh: refreshSettings,
} = await useFetch<{ settings: GroupSettings }>(`/api/organizations/${orgId}/settings`, {
  key: `desktop-settings-${orgId}`,
})
const { data: levelsData } = useFetch<{
  levels: { code: PlayerLevelCode; title: string; description: string }[]
}>('/api/levels', { key: 'levels', lazy: true })

const actor = computed(() => data.value?.myMember ?? null)
const isOwner = computed(() => actor.value?.role === 'owner' && actor.value.status === 'active')
const section = computed(() => parseSection(route.query.section, isOwner.value))
const sections = computed(() => visibleSections(isOwner.value))

const settings = ref<GroupSettings | null>(settingsData.value?.settings ?? null)
const profile = ref<OrgProfile | null>(
  data.value
    ? {
        name: data.value.organization.name,
        description: data.value.organization.description,
        defaultMemberStatus: data.value.organization.defaultMemberStatus,
      }
    : null,
)
watch(settingsData, (value) => {
  if (value) settings.value = value.settings
})

let alive = true
onBeforeUnmount(() => {
  alive = false
})
const isCurrent = () => alive && route.path === path

const controller = createSettingsController({
  orgId,
  request: (url, init) => $fetch(url, init) as never,
  settings,
  org: profile,
  toast: toast.show,
  errorMessage: (cause, fallback) => apiErrorMessage(cause, fallback),
  isCurrent,
})

// Название и «Абонементы» в боковом меню кабинета живут в общих данных группы: подтянуть сразу.
watch(
  [profile, () => settings.value?.subscriptionsEnabled],
  async ([value, subscriptionsEnabled], [previous]) => {
    if (!data.value || !value) return
    data.value = {
      ...data.value,
      organization: {
        ...data.value.organization,
        ...value,
        ...(subscriptionsEnabled === undefined ? {} : { subscriptionsEnabled }),
        city: settings.value?.city ?? data.value.organization.city,
      },
    }
    if (previous && previous.name !== value.name) await fetchAll().catch(() => undefined)
  },
)

async function retry() {
  await Promise.all([refreshOrg(), refreshSettings()])
}

const archiving = ref(false)
const archiveError = ref('')
async function archive() {
  if (!isCurrent() || !canSaveDesktopSettings(actor.value, route.path, path, archiving.value))
    return
  archiving.value = true
  archiveError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId}/archive`, { method: 'POST' })
    if (!isCurrent()) return
    await fetchAll().catch(() => undefined)
    if (isCurrent()) await navigateTo('/app?choose=1')
  } catch (cause) {
    if (isCurrent()) archiveError.value = apiErrorMessage(cause, 'Не удалось архивировать группу')
  } finally {
    archiving.value = false
  }
}
</script>

<template>
  <section class="vt-settings">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Настройки</h1>
        <p class="text-vt-mute-2">Профиль, записи и оплата, залы, команда и интеграции.</p>
      </div>
    </header>

    <ErrorState
      v-if="orgError || settingsError"
      message="Не удалось открыть настройки"
      @retry="retry"
    />
    <SkeletonList v-else-if="!data || !settings || !profile" :count="2" />
    <div v-else class="vt-settings__layout">
      <nav class="vt-settings__menu" aria-label="Разделы настроек">
        <NuxtLink
          v-for="item in sections"
          :key="item.key"
          :to="{ path, query: { section: item.key } }"
          class="vt-settings__menu-link"
          :class="{ 'vt-settings__menu-link--danger': item.key === 'danger' }"
          :aria-current="section === item.key ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="vt-settings__content">
        <p v-if="!isOwner" class="vt-settings-note" role="note">
          Изменять настройки может только владелец группы. Вы видите текущие значения.
        </p>
        <SettingsProfile
          v-if="section === 'profile'"
          :org="profile"
          :settings="settings"
          :can-edit="isOwner"
          :controller="controller"
        />
        <SettingsBookings
          v-else-if="section === 'bookings'"
          :settings="settings"
          :level-options="levelsData?.levels ?? []"
          :can-edit="isOwner"
          :controller="controller"
        />
        <SettingsVenues
          v-else-if="section === 'venues'"
          :org-id="orgId"
          :can-manage="true"
          @toast="toast.show"
        />
        <SettingsTeam
          v-else-if="section === 'team'"
          :org="profile"
          :base="base"
          :can-edit="isOwner"
          :controller="controller"
        />
        <SettingsNotifications v-else-if="section === 'notifications'" />
        <SettingsIntegrations
          v-else-if="section === 'integrations'"
          :bot-username="config.public.telegramBotUsername"
          :base="base"
        />
        <SettingsDanger
          v-else-if="section === 'danger' && isOwner"
          :busy="archiving"
          :error="archiveError"
          @archive="archive"
        />
      </div>
    </div>
    <VtToast />
  </section>
</template>
