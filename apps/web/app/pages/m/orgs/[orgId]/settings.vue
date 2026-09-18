<script setup lang="ts">
import type { Organization, OrganizationMember } from '@volley-time/db'
import { canManageOrgSettingsUi } from '~/utils/organization-ui'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { fetchAll } = useOrganizations()
const { confirm, haptic } = useTelegram()

const {
  data: orgData,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{ organization: Organization; myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const org = computed(() => orgData.value?.organization ?? null)
const me = computed(() => orgData.value?.myMember ?? null)
const canManage = computed(() => canManageOrgSettingsUi(me.value))

const form = reactive({
  name: '',
  city: '',
  description: '',
  defaultMemberStatus: 'active' as 'active' | 'pending',
})

function syncForm(value: Organization | null) {
  if (!value) return
  form.name = value.name
  form.city = value.city ?? ''
  form.description = value.description ?? ''
  form.defaultMemberStatus = value.defaultMemberStatus
}

watch(org, syncForm, { immediate: true })

const saving = ref(false)
const saved = ref(false)
const formError = ref('')
const archiving = ref(false)

async function onSave() {
  if (!canManage.value || saving.value) return
  saving.value = true
  saved.value = false
  formError.value = ''

  try {
    await $fetch(`/api/organizations/${orgId.value}`, {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        city: form.city.trim() || null,
        description: form.description.trim() || null,
        defaultMemberStatus: form.defaultMemberStatus,
      },
    })
    await refreshOrg()
    await fetchAll()
    saved.value = true
    haptic('success')
  } catch (e) {
    formError.value = apiErrorMessage(e, 'Не удалось сохранить настройки')
    haptic('error')
  } finally {
    saving.value = false
  }
}

async function onArchive() {
  if (!canManage.value || archiving.value) return
  if (
    !(await confirm('Архивировать группу? Она исчезнет из активного списка, но данные сохранятся.'))
  )
    return

  archiving.value = true
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/archive`, { method: 'POST' })
    await fetchAll()
    haptic('success')
    await navigateTo('/m/orgs')
  } catch (e) {
    formError.value = apiErrorMessage(e, 'Не удалось архивировать группу')
    haptic('error')
  } finally {
    archiving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Настройки группы" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4">
      <ErrorState v-if="orgError" message="Не удалось открыть настройки" @retry="refreshOrg()" />
      <EmptyState
        v-else-if="!canManage"
        icon="settings"
        title="Настройки доступны владельцу"
        description="Изменять параметры и архивировать группу может только владелец."
      />
      <template v-else-if="org">
        <form class="vt-card p-4 space-y-4" @submit.prevent="onSave">
          <div>
            <label class="vt-label" for="settings-name">Название</label>
            <input
              id="settings-name"
              v-model="form.name"
              class="vt-field"
              required
              minlength="2"
              maxlength="200"
              :disabled="saving"
            />
          </div>
          <div>
            <label class="vt-label" for="settings-city">Город</label>
            <input
              id="settings-city"
              v-model="form.city"
              class="vt-field"
              maxlength="120"
              :disabled="saving"
            />
          </div>
          <div>
            <label class="vt-label" for="settings-description">Описание</label>
            <textarea
              id="settings-description"
              v-model="form.description"
              class="vt-field min-h-24 resize-y"
              maxlength="2000"
              :disabled="saving"
            />
          </div>
          <fieldset>
            <legend class="vt-label">Новые участники</legend>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="form.defaultMemberStatus"
                  type="radio"
                  value="active"
                  :disabled="saving"
                />
                <span>Сразу в составе</span>
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="form.defaultMemberStatus"
                  type="radio"
                  value="pending"
                  :disabled="saving"
                />
                <span>После одобрения организатором</span>
              </label>
            </div>
          </fieldset>

          <p v-if="formError" class="text-sm text-vt-rose-ink" role="alert">{{ formError }}</p>
          <p v-if="saved" class="text-sm text-vt-grass-ink" role="status">Сохранено</p>
          <button
            type="submit"
            class="vt-btn vt-btn--primary vt-btn--full"
            :disabled="saving || form.name.trim().length < 2"
          >
            {{ saving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </form>

        <section class="vt-card p-4 mt-5 border-vt-rose">
          <h2 class="font-semibold text-vt-rose-ink">Архивировать группу</h2>
          <p class="text-sm text-vt-mute-2 mt-1 mb-3">
            Группа перестанет быть активной. Данные и история сохранятся.
          </p>
          <button
            type="button"
            class="vt-btn vt-btn--danger vt-btn--full"
            :disabled="archiving"
            @click="onArchive"
          >
            <VtIcon name="trash" :size="15" />
            {{ archiving ? 'Архивируем…' : 'Архивировать группу' }}
          </button>
        </section>
      </template>
    </main>
  </div>
</template>
