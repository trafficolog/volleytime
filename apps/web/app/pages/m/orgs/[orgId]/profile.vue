<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import { playerHomeAccess } from '~/utils/player-home'
import { playerGroupOptions, playerProfileFields } from '~/utils/player-navigation'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { user } = useAuth()
const fields = computed(() => playerProfileFields(user.value))
const { orgs, loading: groupsLoading, fetchAll, selectOrg } = useOrganizations()
const groupsError = ref('')
const groupOptions = computed(() => playerGroupOptions(orgs.value, orgId.value))

async function loadGroups() {
  groupsError.value = ''
  try {
    await fetchAll()
  } catch (cause) {
    groupsError.value = apiErrorMessage(cause, 'Не удалось загрузить группы')
  }
}
await loadGroups()

function chooseGroup(group: { id: number; selectable: boolean }) {
  if (group.selectable) selectOrg(group.id)
}

const { data, error, pending, refresh } = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `org-profile-${orgId.value}` })
const organization = computed(() =>
  data.value?.organization.id === orgId.value ? data.value.organization : null,
)
const access = computed(() =>
  playerHomeAccess(orgId.value, organization.value, data.value?.myMember ?? null),
)
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader title="Профиль" :back="base" />
    <main class="px-4 py-4 space-y-6">
      <ErrorState v-if="error" message="Не удалось открыть профиль группы" @retry="refresh()" />
      <SkeletonList v-else-if="pending || access === 'loading'" :count="2" />
      <div
        v-else-if="access === 'pending' || access === 'suspended'"
        class="vt-card p-4"
        role="status"
      >
        <VtChip :tone="access === 'suspended' ? 'rose' : 'amber'" dot>
          {{ access === 'suspended' ? 'Группа приостановлена' : 'Заявка на рассмотрении' }}
        </VtChip>
        <p class="text-sm text-vt-mute-2 mt-3">
          {{
            access === 'suspended'
              ? 'Доступ к записям сейчас закрыт.'
              : 'После одобрения заявки откроются записи.'
          }}
        </p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>
      <ErrorState
        v-else-if="access === 'denied'"
        message="Доступ в группу закрыт"
        @retry="refresh()"
      />

      <template v-else>
        <section class="vt-card vt-card--cool p-5">
          <div class="flex items-center gap-3">
            <VtAvatar
              v-if="user?.name || user?.image"
              size="lg"
              :name="user?.name ?? ''"
              :src="user?.image ?? null"
            />
            <span v-else class="vt-avi vt-avi--lg" aria-hidden="true"
              ><VtIcon name="users" :size="22"
            /></span>
            <div class="min-w-0">
              <h2 class="text-[26px]">{{ user?.name?.trim() || 'Профиль' }}</h2>
              <p v-if="organization" class="text-sm text-vt-mute-2 mt-1 truncate">
                {{ organization.name }}
              </p>
            </div>
          </div>
          <dl v-if="fields.length" class="mt-5 space-y-3">
            <div
              v-for="field in fields"
              :key="field.label"
              class="flex justify-between gap-3 text-sm"
            >
              <dt class="text-vt-mute-2">{{ field.label }}</dt>
              <dd class="font-semibold text-right break-all">{{ field.value }}</dd>
            </div>
          </dl>
          <p v-else class="text-sm text-vt-mute-2 mt-5">Личные данные пока не указаны.</p>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl">Мои группы</h2>
          <SkeletonList v-if="groupsLoading" :count="2" />
          <ErrorState v-else-if="groupsError" :message="groupsError" @retry="loadGroups" />
          <ul v-else-if="groupOptions.length" class="space-y-3">
            <li v-for="group in groupOptions" :key="group.id">
              <NuxtLink
                :to="group.to"
                class="vt-card p-4 flex items-center justify-between gap-3 min-h-11"
                :aria-current="group.selected ? 'true' : undefined"
                @click="chooseGroup(group)"
              >
                <span class="min-w-0">
                  <span class="block font-semibold truncate">{{ group.name }}</span>
                  <span
                    v-if="group.statusLabel || group.city"
                    class="block text-xs text-vt-mute-2 mt-1"
                  >
                    {{ group.statusLabel ?? group.city }}
                  </span>
                </span>
                <VtIcon name="chevron-r" :size="18" />
              </NuxtLink>
            </li>
          </ul>
          <EmptyState v-else icon="users" title="Группы пока не найдены" />
          <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full"
            >Открыть все группы</NuxtLink
          >
          <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full justify-start">
            <VtIcon name="plus" :size="18" /> Вступить по приглашению
          </NuxtLink>
        </section>

        <section class="space-y-3">
          <h2 class="text-xl">Активность</h2>
          <NuxtLink
            :to="`${base}/bookings`"
            class="vt-card p-4 flex items-center justify-between gap-3 min-h-11"
          >
            <span class="font-semibold">Мои записи</span><VtIcon name="chevron-r" :size="18" />
          </NuxtLink>
        </section>
      </template>
    </main>
  </div>
</template>
