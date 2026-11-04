<script setup lang="ts">
import type { Organization } from '@volley-time/db'
import { DEFAULT_TIMEZONE } from '@volley-time/shared'

import {
  buildCollectionBody,
  COLLECTION_ICON_KEYS,
  COLLECTION_ICON_META,
} from '~/utils/desktop-collections'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const listPath = computed(() => `/app/orgs/${orgId.value}/collections`)
const { data: orgData, error: orgError } = await useFetch<{
  organization: Organization
  capabilities?: { collections?: boolean }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-org-${orgId.value}` })
const org = computed(() =>
  !orgError.value && orgData.value?.organization.id === orgId.value
    ? orgData.value.organization
    : null,
)
/** Форма доступна только при явном `capabilities.collections === true`. */
const enabled = computed(
  () => org.value !== null && orgData.value?.capabilities?.collections === true,
)
const currency = computed(() => org.value?.defaultCurrency ?? 'BYN')
const form = reactive({
  title: '',
  description: '',
  icon: 'ball',
  target: '',
  deadline: '',
  visibility: 'active' as 'active' | 'draft',
})
const errors = reactive({ title: '', target: '', deadline: '' })
const formError = ref('')
const busy = ref(false)
let alive = true
onBeforeUnmount(() => {
  alive = false
})

const visibilityOptions = [
  { value: 'active', label: 'Вся группа', hint: 'Сбор сразу виден игрокам' },
  { value: 'draft', label: 'Черновик', hint: 'Видят только организаторы' },
] as const

async function save() {
  if (!enabled.value || busy.value) return
  const targetOrgId = orgId.value
  const expectedPath = route.path
  const built = buildCollectionBody(form, org.value?.defaultTimezone ?? DEFAULT_TIMEZONE)
  errors.title = built.ok ? '' : (built.errors.title ?? '')
  errors.target = built.ok ? '' : (built.errors.target ?? '')
  errors.deadline = built.ok ? '' : (built.errors.deadline ?? '')
  formError.value = ''
  if (!built.ok) return
  busy.value = true
  try {
    await $fetch(`/api/organizations/${targetOrgId}/collections`, {
      method: 'POST',
      body: built.body,
    })
    if (alive && route.path === expectedPath)
      await navigateTo(`/app/orgs/${targetOrgId}/collections`)
  } catch (cause) {
    if (alive) formError.value = apiErrorMessage(cause, 'Не удалось создать сбор')
  } finally {
    if (alive) busy.value = false
  }
}
</script>

<template>
  <section class="vt-desktop-collections-form space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Сборы</p>
        <h1 tabindex="-1">Новый сбор</h1>
        <p class="text-vt-mute-2">Кампания по сбору средств</p>
      </div>
    </header>

    <div v-if="!enabled" class="vt-card p-4 space-y-3" role="status">
      <p v-if="org">Создание сборов пока недоступно.</p>
      <p v-else>Не удалось проверить настройки группы. Создание сборов недоступно.</p>
      <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">К списку сборов</NuxtLink>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="save">
      <div class="vt-desktop-collections-form__grid">
        <div class="vt-card p-6 space-y-4">
          <h2>О сборе</h2>
          <fieldset class="vt-desktop-collections-form__icons">
            <legend class="vt-label">Иконка</legend>
            <div role="radiogroup" aria-label="Иконка сбора" class="flex gap-2">
              <button
                v-for="key in COLLECTION_ICON_KEYS"
                :key="key"
                type="button"
                role="radio"
                :aria-checked="form.icon === key"
                :aria-label="COLLECTION_ICON_META[key].label"
                :title="COLLECTION_ICON_META[key].label"
                class="vt-desktop-collections-form__icon"
                :class="{ 'is-selected': form.icon === key }"
                :disabled="busy"
                @click="form.icon = key"
              >
                <DesktopCollectionIcon :name="key" :size="44" />
              </button>
            </div>
          </fieldset>
          <div>
            <label class="vt-label" for="collection-title">Название</label>
            <input
              id="collection-title"
              v-model="form.title"
              class="vt-field"
              maxlength="120"
              required
              :aria-invalid="errors.title ? 'true' : undefined"
              :aria-describedby="errors.title ? 'collection-title-error' : undefined"
              :disabled="busy"
            />
            <p
              v-if="errors.title"
              id="collection-title-error"
              class="text-vt-rose-ink"
              role="alert"
            >
              {{ errors.title }}
            </p>
          </div>
          <div>
            <label class="vt-label" for="collection-description">Описание · на что собираем</label>
            <textarea
              id="collection-description"
              v-model="form.description"
              class="vt-field"
              rows="3"
              maxlength="2000"
              :disabled="busy"
            />
          </div>
        </div>

        <div class="space-y-4">
          <div class="vt-card p-5 space-y-4">
            <h2>Цель и срок</h2>
            <div>
              <label class="vt-label" for="collection-target">Целевая сумма</label>
              <div class="vt-desktop-collections-form__amount">
                <input
                  id="collection-target"
                  v-model="form.target"
                  class="vt-field vt-mono vt-desktop-collections-form__target"
                  inputmode="decimal"
                  placeholder="Без цели"
                  :aria-invalid="errors.target ? 'true' : undefined"
                  :aria-describedby="errors.target ? 'collection-target-error' : undefined"
                  :disabled="busy"
                />
                <span class="vt-field vt-desktop-collections-form__currency">{{ currency }}</span>
              </div>
              <p
                v-if="errors.target"
                id="collection-target-error"
                class="text-vt-rose-ink"
                role="alert"
              >
                {{ errors.target }}
              </p>
            </div>
            <div>
              <label class="vt-label" for="collection-deadline">Дедлайн</label>
              <input
                id="collection-deadline"
                v-model="form.deadline"
                class="vt-field"
                type="date"
                :aria-invalid="errors.deadline ? 'true' : undefined"
                :aria-describedby="
                  errors.deadline ? 'collection-deadline-error' : 'collection-deadline-hint'
                "
                :disabled="busy"
              />
              <p
                v-if="errors.deadline"
                id="collection-deadline-error"
                class="text-vt-rose-ink"
                role="alert"
              >
                {{ errors.deadline }}
              </p>
              <p v-else id="collection-deadline-hint" class="text-vt-mute-2 text-xs">
                Только напоминание в списке: сбор закрывается вручную.
              </p>
            </div>
            <fieldset>
              <legend class="vt-label">Кто видит сбор</legend>
              <div class="vt-desktop-collections-form__visibility">
                <label
                  v-for="option in visibilityOptions"
                  :key="option.value"
                  :class="{ 'is-selected': form.visibility === option.value }"
                >
                  <input
                    v-model="form.visibility"
                    type="radio"
                    name="collection-visibility"
                    :value="option.value"
                    :disabled="busy"
                  />
                  <span>
                    <strong class="text-sm">{{ option.label }}</strong>
                    <small class="text-vt-mute-2 block">{{ option.hint }}</small>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>
          <div class="vt-card p-4 flex items-start gap-2 text-xs text-vt-mute-2">
            <VtIcon name="wallet" :size="15" />
            <span>
              Подтверждённые взносы попадут в кассу с категорией
              <b class="text-vt-ink">contribution</b>.
            </span>
          </div>
        </div>
      </div>

      <p v-if="formError" class="text-vt-rose-ink" role="alert">{{ formError }}</p>
      <div class="vt-desktop-members__actions">
        <NuxtLink :to="listPath" class="vt-btn vt-btn--ghost">Отмена</NuxtLink>
        <button type="submit" class="vt-btn vt-btn--primary" :disabled="busy">
          <VtIcon name="check" :size="14" /> {{ busy ? 'Создаём…' : 'Создать сбор' }}
        </button>
      </div>
    </form>
  </section>
</template>
