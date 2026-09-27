<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'

import { canSaveDesktopSettings } from '~/utils/desktop-settings'
import { organizationSettingsPayload } from '~/utils/organization-settings-payload'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const path = computed(() => `/app/orgs/${orgId.value}/settings`)
const { fetchAll } = useOrganizations()
const {
  data,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: Organization
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-org-${orgId.value}` })
const org = computed(() =>
  data.value?.organization.id === orgId.value ? data.value.organization : null,
)
const actor = computed(() => (org.value ? (data.value?.myMember ?? null) : null))
const isOwner = computed(() => actor.value?.role === 'owner' && actor.value.status === 'active')
const form = reactive({
  name: '',
  city: '',
  description: '',
  defaultMemberStatus: 'active' as 'active' | 'pending',
  subscriptionsEnabled: true,
})
const saving = ref(false)
const archiving = ref(false)
const saved = ref(false)
const formError = ref('')
let alive = true

function syncForm(value: Organization | null) {
  if (!value) return
  form.name = value.name
  form.city = value.city ?? ''
  form.description = value.description ?? ''
  form.defaultMemberStatus = value.defaultMemberStatus
  form.subscriptionsEnabled = value.subscriptionsEnabled
}

watch(org, syncForm, { immediate: true })
watch(orgId, () => {
  saved.value = false
  formError.value = ''
})
onBeforeUnmount(() => {
  alive = false
})

function canMutate(targetOrgId: number, expectedPath: string) {
  return (
    alive &&
    org.value?.id === targetOrgId &&
    canSaveDesktopSettings(actor.value, route.path, expectedPath, saving.value || archiving.value)
  )
}

async function save() {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  const confirmedOrg = org.value
  if (!confirmedOrg || !canMutate(targetOrgId, expectedPath)) return
  const requestedSubscriptionsEnabled = form.subscriptionsEnabled
  const changedSubscriptions = requestedSubscriptionsEnabled !== confirmedOrg.subscriptionsEnabled
  saving.value = true
  saved.value = false
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}`, {
      method: 'PATCH',
      body: organizationSettingsPayload(form, confirmedOrg.subscriptionsEnabled),
    })
    if (!alive || orgId.value !== targetOrgId || route.path !== expectedPath) return
    // Refresh the shared org data without switching the shell into its loading branch:
    // that branch unmounts this page and would erase the save/error feedback.
    const confirmed = await $fetch<{ organization: Organization; myMember: OrganizationMember }>(
      `/api/organizations/${targetOrgId}`,
    )
    if (
      confirmed.organization.id !== targetOrgId ||
      (changedSubscriptions &&
        confirmed.organization.subscriptionsEnabled !== requestedSubscriptionsEnabled)
    ) {
      throw new Error('Organization settings could not be confirmed')
    }
    data.value = confirmed
    await fetchAll()
    if (alive && orgId.value === targetOrgId && route.path === expectedPath) saved.value = true
  } catch (cause) {
    if (alive && orgId.value === targetOrgId && route.path === expectedPath) {
      form.subscriptionsEnabled =
        org.value?.subscriptionsEnabled ?? confirmedOrg.subscriptionsEnabled
      formError.value = apiErrorMessage(cause, 'Не удалось сохранить настройки')
    }
  } finally {
    saving.value = false
  }
}

async function archive() {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  if (!canMutate(targetOrgId, expectedPath)) return
  if (
    !window.confirm('Архивировать группу? Она исчезнет из активного списка, но данные сохранятся.')
  )
    return
  if (!canMutate(targetOrgId, expectedPath)) return
  archiving.value = true
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/archive`, { method: 'POST' })
    if (!alive || orgId.value !== targetOrgId || route.path !== expectedPath) return
    await fetchAll()
    await navigateTo('/app?choose=1')
  } catch (cause) {
    if (alive && orgId.value === targetOrgId && route.path === expectedPath) {
      formError.value = apiErrorMessage(cause, 'Не удалось архивировать группу')
    }
  } finally {
    archiving.value = false
  }
}
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Настройки</h1>
        <p class="text-vt-mute-2">Параметры организации и доступ к абонементам.</p>
      </div>
    </header>
    <ErrorState v-if="orgError" message="Не удалось открыть настройки" @retry="refreshOrg()" />
    <SkeletonList v-else-if="!org" :count="2" />
    <div v-else-if="!isOwner" class="vt-card vt-desktop-form-page__card space-y-3">
      <p>Изменять настройки может только владелец группы.</p>
      <dl class="space-y-2">
        <div>
          <dt class="vt-cap">Название</dt>
          <dd>{{ org.name }}</dd>
        </div>
        <div>
          <dt class="vt-cap">Город</dt>
          <dd>{{ org.city || 'Не указан' }}</dd>
        </div>
        <div>
          <dt class="vt-cap">Абонементы</dt>
          <dd>{{ org.subscriptionsEnabled ? 'Включены' : 'Выключены' }}</dd>
        </div>
      </dl>
    </div>
    <template v-else>
      <form class="vt-card vt-desktop-form-page__card space-y-4" @submit.prevent="save">
        <div>
          <label class="vt-label" for="desktop-settings-name">Название</label>
          <input
            id="desktop-settings-name"
            v-model="form.name"
            class="vt-field"
            required
            minlength="2"
            maxlength="200"
            :disabled="saving || archiving"
          />
        </div>
        <div>
          <label class="vt-label" for="desktop-settings-city">Город</label>
          <input
            id="desktop-settings-city"
            v-model="form.city"
            class="vt-field"
            maxlength="120"
            :disabled="saving || archiving"
          />
        </div>
        <div>
          <label class="vt-label" for="desktop-settings-description">Описание</label>
          <textarea
            id="desktop-settings-description"
            v-model="form.description"
            class="vt-field min-h-24 resize-y"
            maxlength="2000"
            :disabled="saving || archiving"
          />
        </div>
        <fieldset>
          <legend class="vt-label">Новые участники</legend>
          <div class="space-y-2">
            <label class="flex items-center gap-2"
              ><input
                v-model="form.defaultMemberStatus"
                type="radio"
                value="active"
                :disabled="saving || archiving"
              />
              Сразу в составе</label
            >
            <label class="flex items-center gap-2"
              ><input
                v-model="form.defaultMemberStatus"
                type="radio"
                value="pending"
                :disabled="saving || archiving"
              />
              После одобрения организатором</label
            >
          </div>
        </fieldset>
        <div class="border-t border-vt-stroke pt-4">
          <label class="flex items-start gap-3" for="desktop-settings-subscriptions">
            <input
              id="desktop-settings-subscriptions"
              v-model="form.subscriptionsEnabled"
              type="checkbox"
              class="mt-1 h-5 w-5 shrink-0 accent-vt-flame"
              :disabled="saving || archiving"
              aria-describedby="desktop-settings-subscriptions-hint"
            />
            <span class="font-semibold">Использовать абонементы</span>
          </label>
          <p id="desktop-settings-subscriptions-hint" class="text-vt-mute-2 mt-2">
            При отключении новые покупки и записи по абонементу недоступны. Купленные остатки и
            история сохранятся после включения.
          </p>
        </div>
        <p v-if="formError" role="alert" class="text-vt-rose-ink">{{ formError }}</p>
        <p v-if="saved" role="status" class="text-vt-grass-ink">Настройки сохранены</p>
        <button
          type="submit"
          class="vt-btn vt-btn--primary"
          :disabled="saving || archiving || form.name.trim().length < 2"
        >
          {{ saving ? 'Сохраняем…' : 'Сохранить настройки' }}
        </button>
      </form>
      <section class="vt-card vt-desktop-form-page__card space-y-3 border border-vt-rose">
        <h2 class="text-vt-rose-ink">Архивировать группу</h2>
        <p class="text-vt-mute-2">Группа перестанет быть активной. Данные и история сохранятся.</p>
        <button
          type="button"
          class="vt-btn vt-btn--danger"
          :disabled="saving || archiving"
          @click="archive"
        >
          {{ archiving ? 'Архивируем…' : 'Архивировать группу' }}
        </button>
      </section>
    </template>
  </section>
</template>
