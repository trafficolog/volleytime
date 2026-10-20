<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import { groupMonogram } from '~/utils/group-monogram'
import { playerHomeAccess } from '~/utils/player-home'
import { levelTitle, type PlayerLevelView } from '~/utils/player-level'
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
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const activityRows = computed(() => [
  {
    to: `${base.value}/bookings`,
    icon: 'calendar',
    title: 'Мои записи',
    sub: 'предстоящие и прошедшие',
  },
  {
    to: `${base.value}/notifications`,
    icon: 'bell',
    title: 'Уведомления',
    sub: 'лента группы',
  },
])
const levelCode = computed(() => data.value?.myMember?.level ?? null)
const levelName = computed(() => levelTitle(levelCode.value, levelsData.value?.levels ?? []))
const levelDescription = computed(
  () =>
    (levelsData.value?.levels ?? []).find((level) => level.code === levelCode.value)?.description ??
    null,
)
const access = computed(() =>
  playerHomeAccess(
    orgId.value,
    organization.value,
    data.value?.myMember ?? null,
    apiErrorCode(error.value),
  ),
)
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader title="Профиль" :back="base" />
    <main class="px-4 py-4 space-y-6">
      <ErrorState
        v-if="error && access !== 'suspended' && access !== 'denied'"
        message="Не удалось открыть профиль группы"
        @retry="refresh()"
      />
      <SkeletonList v-else-if="pending || access === 'loading'" :count="2" />
      <div
        v-else-if="access === 'pending' || access === 'suspended' || access === 'denied'"
        class="vt-card p-4"
        role="status"
      >
        <VtChip :tone="access === 'pending' ? 'amber' : 'rose'" dot>
          {{
            access === 'suspended'
              ? 'Группа приостановлена'
              : access === 'denied'
                ? 'Доступ в группу закрыт'
                : 'Заявка на рассмотрении'
          }}
        </VtChip>
        <p class="text-sm text-vt-mute-2 mt-3">
          {{
            access === 'suspended'
              ? 'Доступ к записям сейчас закрыт.'
              : access === 'denied'
                ? 'Запись и покупки в этой группе недоступны.'
                : 'После одобрения заявки откроются записи.'
          }}
        </p>
        <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
      </div>
      <template v-else>
        <section class="flex items-center gap-3.5 px-1 pb-1 pt-1.5">
          <VtAvatar
            v-if="user?.name || user?.image"
            size="lg"
            :name="user?.name ?? ''"
            :src="user?.image ?? null"
          />
          <span v-else class="vt-avi vt-avi--lg" aria-hidden="true"
            ><VtIcon name="users" :size="22"
          /></span>
          <div class="min-w-0 flex-1">
            <h2 class="font-display !normal-case text-lg font-bold leading-[1.1] break-words">
              {{ user?.name?.trim() || 'Профиль' }}
            </h2>
            <p
              v-if="user?.telegramUsername || levelName"
              class="mt-1 flex items-center gap-1 text-sm text-vt-mute-2"
            >
              <VtIcon v-if="user?.telegramUsername" name="tg" :size="12" aria-hidden="true" />
              <span class="truncate"
                >{{ user?.telegramUsername ? `@${user.telegramUsername.replace(/^@/, '')}` : ''
                }}{{ user?.telegramUsername && levelName ? ' · ' : ''
                }}{{ levelName ? `уровень ${levelName}` : '' }}</span
              >
            </p>
            <p v-else-if="organization" class="mt-1 truncate text-sm text-vt-mute-2">
              {{ organization.name }}
            </p>
          </div>
        </section>

        <section aria-labelledby="profile-data-title">
          <h2 id="profile-data-title" class="vt-cap mb-2 px-1 text-vt-mute-2">Личные данные</h2>
          <dl v-if="fields.length" class="vt-card space-y-3 p-4">
            <div
              v-for="field in fields"
              :key="field.label"
              class="flex justify-between gap-3 text-sm"
            >
              <dt class="text-vt-mute-2">{{ field.label }}</dt>
              <dd class="break-all text-right font-semibold">{{ field.value }}</dd>
            </div>
          </dl>
          <p v-else class="vt-card p-4 text-sm text-vt-mute-2">Личные данные пока не указаны.</p>
        </section>

        <section aria-labelledby="profile-level-title">
          <h2 id="profile-level-title" class="vt-cap mb-2 px-1 text-vt-mute-2">Уровень в группе</h2>
          <div class="vt-card p-4">
            <template v-if="levelCode">
              <VtChip tone="solid">{{ levelName ?? 'Уровень назначен' }}</VtChip>
              <p v-if="levelDescription" class="mt-2 text-sm text-vt-mute-2">
                {{ levelDescription }}
              </p>
            </template>
            <p v-else class="text-sm text-vt-mute-2">Уровень пока не назначен организатором.</p>
          </div>
        </section>

        <section aria-labelledby="profile-groups-title" class="space-y-2">
          <h2 id="profile-groups-title" class="vt-cap px-1 text-vt-mute-2">Мои группы</h2>
          <SkeletonList v-if="groupsLoading" :count="2" />
          <ErrorState v-else-if="groupsError" :message="groupsError" @retry="loadGroups" />
          <ul v-else-if="groupOptions.length" class="space-y-2">
            <li v-for="group in groupOptions" :key="group.id">
              <NuxtLink
                :to="group.to"
                class="vt-card !flex min-h-11 items-center gap-3 !px-3.5 !py-3"
                :class="group.selectable ? '' : 'grayscale'"
                :aria-current="group.selected ? 'true' : undefined"
                @click="chooseGroup(group)"
              >
                <span
                  data-monogram
                  aria-hidden="true"
                  class="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  :class="groupMonogram(group.name).className"
                  >{{ groupMonogram(group.name).initials }}</span
                >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[15px] font-semibold">{{ group.name }}</span>
                  <span
                    v-if="group.statusLabel || group.city"
                    class="mt-0.5 block truncate text-xs text-vt-mute-2"
                  >
                    {{ group.statusLabel ?? group.city }}
                  </span>
                </span>
                <VtChip v-if="group.selected" tone="grass" dot>актив.</VtChip>
              </NuxtLink>
            </li>
          </ul>
          <EmptyState v-else icon="users" title="Группы пока не найдены" />
          <NuxtLink
            to="/m/orgs"
            class="vt-btn vt-btn--ghost vt-btn--full !justify-start gap-2.5 !px-3.5 !py-3"
          >
            <VtIcon name="plus" :size="16" /> Вступить по приглашению
          </NuxtLink>
          <NuxtLink
            to="/m/orgs/create"
            class="vt-btn vt-btn--ghost vt-btn--full !justify-start gap-2.5 !px-3.5 !py-3"
          >
            <VtIcon name="plus" :size="16" /> Создать группу
          </NuxtLink>
        </section>

        <section aria-labelledby="profile-settings-title">
          <h2 id="profile-settings-title" class="vt-cap mb-2 px-1 text-vt-mute-2">Активность</h2>
          <ul class="vt-card divide-y divide-vt-stroke overflow-hidden">
            <li v-for="row in activityRows" :key="row.to">
              <NuxtLink :to="row.to" class="flex min-h-11 items-center gap-3 px-3.5 py-3">
                <VtIcon :name="row.icon" :size="16" class="text-vt-mute-2" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block text-[15px] font-medium">{{ row.title }}</span>
                  <span class="mt-0.5 block text-xs text-vt-mute-2">{{ row.sub }}</span>
                </span>
                <VtIcon name="chevron-r" :size="14" class="text-vt-mute-2" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
