<script setup lang="ts">
import { parseInviteInput } from '@volley-time/shared'
definePageMeta({ layout: 'miniapp', middleware: ['auth'] })

const { orgs, loading, fetchAll, selectOrg } = useOrganizations()
const loadError = ref('')
async function load() {
  loadError.value = ''
  try {
    await fetchAll()
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить группы')
  }
}
await load()

// «У меня есть приглашение» (Task 4.9.18)
const inviteOpen = ref(false)
const inviteInput = ref('')
const inviteError = ref('')
function openInvite() {
  const token = parseInviteInput(inviteInput.value)
  if (!token) {
    inviteError.value = 'Не похоже на ссылку-приглашение. Вставьте ссылку из чата группы.'
    return
  }
  inviteOpen.value = false
  navigateTo(`/m/invite/${encodeURIComponent(token)}`)
}
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="Мои группы">
      <template #right>
        <NuxtLink to="/m/orgs/create" class="vt-btn vt-btn--ghost vt-btn--sm">
          <VtIcon name="plus" :size="14" /> Создать
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <main class="px-4 py-4">
      <div v-if="loading" role="status" aria-label="Загружаем группы">
        <SkeletonList :count="2" />
      </div>
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="orgs.length === 0"
        icon="users"
        title="У вас пока нет групп"
        description="Откройте приглашение от организатора или создайте свою группу."
      >
        <template #action>
          <button type="button" class="vt-btn vt-btn--primary" @click="inviteOpen = true">
            У меня есть приглашение
          </button>
          <NuxtLink to="/m/orgs/create" class="vt-btn vt-btn--ghost">Создать группу</NuxtLink>
        </template>
      </EmptyState>
      <template v-else>
        <ul class="space-y-2.5">
          <li v-for="org in orgs" :key="org.id">
            <NuxtLink
              :to="`/m/orgs/${org.id}`"
              class="vt-card p-4 flex items-center gap-3"
              @click="selectOrg(org.id)"
            >
              <img
                src="/logo.png"
                alt=""
                width="36"
                height="36"
                class="rounded-full bg-white p-1"
              />
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">{{ org.name }}</div>
                <div v-if="org.city" class="text-sm text-vt-mute-2 truncate">{{ org.city }}</div>
              </div>
              <VtChip v-if="org.membershipStatus === 'pending'" tone="amber">Заявка</VtChip>
              <VtChip v-else-if="org.status === 'suspended'" tone="rose">Приостановлена</VtChip>
              <VtIcon name="chevron-r" :size="16" class="text-vt-mute" />
            </NuxtLink>
          </li>
        </ul>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full mt-4"
          @click="inviteOpen = true"
        >
          У меня есть приглашение
        </button>
      </template>
    </main>

    <VtSheet v-model="inviteOpen" title="Приглашение в группу">
      <form class="space-y-3" @submit.prevent="openInvite">
        <label for="invite" class="vt-label">Ссылка или код приглашения</label>
        <input
          id="invite"
          v-model="inviteInput"
          class="vt-field"
          placeholder="https://t.me/…?start=org_…"
          autocomplete="off"
          @input="inviteError = ''"
        />
        <p v-if="inviteError" class="text-sm text-vt-rose-ink" role="alert">{{ inviteError }}</p>
        <button type="submit" class="vt-btn vt-btn--primary vt-btn--full" :disabled="!inviteInput">
          Открыть приглашение
        </button>
      </form>
    </VtSheet>
  </div>
</template>
