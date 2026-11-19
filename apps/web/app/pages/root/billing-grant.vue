<script setup lang="ts">
import {
  PLATFORM_GRANT_CATEGORIES,
  PLATFORM_GRANT_COMMENT_MAX,
  PLATFORM_GRANT_MAX_UNITS,
  type PlatformGrantResult,
  type PlatformOrganizationDetail,
  type PlatformOrganizationsPage,
} from '@volley-time/shared'

import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { pluralEvents } from '~/utils/cabinet-shell'
import {
  GRANT_CATEGORY_LABELS,
  GRANT_PRESETS,
  type GrantForm,
  type GrantFormErrors,
  balanceAfterLabel,
  grantBody,
  grantErrorMessage,
  grantFormErrors,
  parseGrantUnits,
} from '~/utils/root-grants'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Выдать баланс — Root Admin' })

const route = useRoute()

/** Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход. */
function reactToStatus(status: number | undefined): boolean {
  const reaction = rootOverviewFailure(status)
  if (reaction === 'forbidden') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Раздел доступен только администратору платформы',
      fatal: true,
    })
  }
  if (reaction === 'login') {
    void navigateTo('/auth/login')
    return true
  }
  return false
}

const orgId = computed(() => {
  const raw = Array.isArray(route.query.org) ? route.query.org[0] : route.query.org
  return raw && /^\d{1,10}$/.test(raw) ? Number(raw) : null
})

// Выбор организации: поиск по названию, пока организация не выбрана
const search = ref('')
const debounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debounced.value = value.trim()), 250)
})
onBeforeUnmount(() => clearTimeout(timer))

const {
  data: found,
  pending: searching,
  error: searchError,
  refresh: researchOrgs,
} = await useFetch<PlatformOrganizationsPage>('/api/platform/organizations', {
  key: 'root-grant-org-search',
  query: computed(() => ({ q: debounced.value || undefined, pageSize: 8, sort: 'activity' })),
  immediate: orgId.value === null,
  watch: [debounced],
})
reactToStatus(apiErrorStatus(searchError.value))

const {
  data: org,
  pending: orgPending,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<PlatformOrganizationDetail>(
  () => `/api/platform/organizations/${orgId.value ?? 0}`,
  { key: 'root-grant-org', immediate: orgId.value !== null, watch: [orgId] },
)
reactToStatus(apiErrorStatus(orgError.value))
const orgNotFound = computed(() => orgId.value !== null && apiErrorStatus(orgError.value) === 404)
const orgUnavailable = computed(() => org.value?.deletedAt != null)

const form = reactive<GrantForm>({ units: '10', category: 'promo', comment: '' })
const errors = ref<GrantFormErrors>({})
const failure = ref('')
const submitting = ref(false)
const done = ref<PlatformGrantResult | null>(null)
const unitsInput = ref<HTMLInputElement | null>(null)

// Ключ идемпотентности: один на попытку. Повтор отправки тех же данных (двойной клик, сбой сети)
// несёт тот же ключ и не начислит дважды; правка полей начинает новую попытку.
let attemptKey: string | null = null
watch(form, () => (attemptKey = null))

const unitsNumber = computed(() => parseGrantUnits(form.units) ?? 0)
const balanceNow = computed(() => org.value?.stats.balance ?? 0)
const after = computed(() => balanceAfterLabel(balanceNow.value, unitsNumber.value))
const initials = computed(() => (org.value?.name ?? '').slice(0, 2).toUpperCase())

function pickPreset(value: number) {
  form.units = String(value)
}

async function submit() {
  if (submitting.value || !org.value || orgUnavailable.value) return
  failure.value = ''
  errors.value = grantFormErrors(form)
  if (Object.keys(errors.value).length) {
    if (errors.value.units) unitsInput.value?.focus()
    return
  }
  submitting.value = true
  attemptKey ??= crypto.randomUUID()
  try {
    done.value = await $fetch<PlatformGrantResult>(
      `/api/platform/organizations/${org.value.id}/event-balance-grants`,
      { method: 'POST', body: grantBody(form, attemptKey) },
    )
    attemptKey = null
    await refreshOrg()
  } catch (e) {
    if (reactToStatus(apiErrorStatus(e))) return
    const code = apiErrorCode(e)
    failure.value = grantErrorMessage(apiErrorStatus(e) === 422 ? 'validation_failed' : code)
    // конфликт ключа: начинаем попытку заново, чтобы повтор не упёрся в тот же ответ
    if (code === 'platform.grant_idempotency_conflict') attemptKey = null
  } finally {
    submitting.value = false
  }
}

function another() {
  done.value = null
  Object.assign(form, { units: '10', category: 'promo', comment: '' })
  attemptKey = null
  void nextTick(() => unitsInput.value?.focus())
}
</script>

<template>
  <form class="vt-root-billing vt-root-grant" novalidate @submit.prevent="submit">
    <header class="vt-root-billing__head">
      <div>
        <h1 tabindex="-1">
          Выдать баланс <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p class="vt-root-billing__hint">
          <template v-if="org">Организация: {{ org.name }}</template>
          <template v-else>Ручное начисление: промо, компенсация, исправление ошибок</template>
        </p>
      </div>
      <div class="vt-root-billing__actions">
        <NuxtLink to="/root/billing" class="vt-btn vt-btn--ghost vt-btn--sm">
          {{ done ? 'К тарифам' : 'Отмена' }}
        </NuxtLink>
        <button
          v-if="org && !done"
          type="submit"
          class="vt-btn vt-btn--primary vt-btn--sm"
          :disabled="submitting || orgUnavailable"
        >
          <VtIcon name="check" :size="14" /> {{ submitting ? 'Выдаём…' : 'Выдать' }}
        </button>
      </div>
    </header>

    <!-- Организация не выбрана: поиск -->
    <section
      v-if="orgId === null || orgNotFound"
      class="vt-card vt-root-grant__card"
      aria-labelledby="grant-pick"
    >
      <h2 id="grant-pick">Выберите организацию</h2>
      <p v-if="orgNotFound" role="alert" class="vt-root-billing__error">Организация не найдена</p>
      <label class="vt-root-billing__field">
        <span class="vt-label">Поиск по названию</span>
        <input
          v-model="search"
          class="vt-field"
          name="organization-search"
          type="search"
          autocomplete="off"
          maxlength="100"
          placeholder="Напр. VolleyTime Минск"
        />
      </label>
      <p v-if="searchError" role="alert" class="vt-root-billing__error">
        Не удалось загрузить организации
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="researchOrgs()">
          Повторить
        </button>
      </p>
      <p v-else-if="searching && !found" class="vt-root-billing__hint">Загрузка…</p>
      <p v-else-if="found && !found.items.length" class="vt-root-billing__hint">
        Ничего не найдено
      </p>
      <ul v-else-if="found" class="vt-root-grant__orgs" aria-label="Организации">
        <li v-for="o in found.items" :key="o.id">
          <NuxtLink
            :to="{ path: '/root/billing-grant', query: { org: String(o.id) } }"
            class="vt-root-grant__org"
          >
            <span class="vt-root-grant__avatar" aria-hidden="true">{{
              o.name.slice(0, 2).toUpperCase()
            }}</span>
            <span class="vt-root-grant__org-name">{{ o.name }}</span>
            <span class="vt-mono vt-root-billing__muted">
              {{ o.balance }} {{ pluralEvents(o.balance) }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <template v-else>
      <p v-if="orgPending && !org" class="vt-root-billing__hint">Загрузка…</p>
      <p v-else-if="orgError" role="alert" class="vt-root-billing__error">
        Не удалось загрузить организацию
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="refreshOrg()">
          Повторить
        </button>
      </p>

      <section
        v-else-if="org && done"
        class="vt-card vt-root-grant__card"
        role="status"
        aria-labelledby="grant-done"
      >
        <h2 id="grant-done">Баланс выдан</h2>
        <p>
          {{ org.name }}: <b class="vt-mono vt-root-billing__income">+{{ done.delta }}</b>
          {{ pluralEvents(done.delta) }}, баланс теперь
          <b class="vt-mono">{{ done.balanceAfter }} {{ pluralEvents(done.balanceAfter) }}</b
          >.
          <template v-if="done.replayed"> Повторная отправка не изменила баланс.</template>
        </p>
        <p class="vt-root-billing__hint">Запись добавлена в журнал баланса и в аудит платформы.</p>
        <div class="vt-root-billing__actions">
          <button type="button" class="vt-btn vt-btn--ink vt-btn--sm" @click="another">
            Выдать ещё
          </button>
          <NuxtLink :to="`/root/organizations/${org.id}`" class="vt-btn vt-btn--ghost vt-btn--sm">
            Карточка организации
          </NuxtLink>
        </div>
      </section>

      <section v-else-if="org" class="vt-card vt-root-grant__card" aria-labelledby="grant-form">
        <h2 id="grant-form" class="sr-only">Начисление</h2>
        <div class="vt-root-grant__org-head">
          <span class="vt-root-grant__avatar" aria-hidden="true">{{ initials }}</span>
          <div>
            <p class="vt-root-grant__org-title">{{ org.name }}</p>
            <p class="vt-mono vt-root-billing__muted">
              текущий баланс: {{ balanceNow }} {{ pluralEvents(balanceNow) }}
            </p>
          </div>
          <NuxtLink to="/root/billing-grant" class="vt-btn vt-btn--ghost vt-btn--sm">
            Другая организация
          </NuxtLink>
        </div>

        <p v-if="orgUnavailable" role="alert" class="vt-root-billing__error">
          Организация удалена: начислять баланс нельзя до восстановления.
        </p>
        <p v-if="failure" role="alert" class="vt-root-billing__error">{{ failure }}</p>

        <label class="vt-root-billing__field">
          <span class="vt-label">Количество событий</span>
          <span class="vt-root-grant__amount">
            <span class="vt-mono vt-root-grant__plus" aria-hidden="true">+</span>
            <input
              ref="unitsInput"
              v-model="form.units"
              class="vt-field vt-mono vt-root-grant__units"
              name="units"
              inputmode="numeric"
              autocomplete="off"
              :disabled="orgUnavailable"
              :aria-invalid="errors.units ? 'true' : undefined"
              :aria-describedby="errors.units ? 'grant-units-error' : 'grant-units-hint'"
            />
          </span>
          <span v-if="errors.units" id="grant-units-error" class="vt-root-billing__error">
            {{ errors.units }}
          </span>
          <span v-else id="grant-units-hint" class="vt-root-billing__hint">
            От 1 до {{ PLATFORM_GRANT_MAX_UNITS }} за одно начисление
          </span>
        </label>
        <div class="vt-root-billing__filter" role="group" aria-label="Быстрый выбор количества">
          <button
            v-for="v in GRANT_PRESETS"
            :key="v"
            type="button"
            class="vt-btn vt-btn--sm vt-mono"
            :class="unitsNumber === v ? 'vt-btn--ink' : 'vt-btn--ghost'"
            :aria-pressed="unitsNumber === v"
            :disabled="orgUnavailable"
            @click="pickPreset(v)"
          >
            +{{ v }}
          </button>
        </div>

        <fieldset class="vt-root-grant__category">
          <legend class="vt-label">Причина</legend>
          <div class="vt-root-billing__filter">
            <button
              v-for="c in PLATFORM_GRANT_CATEGORIES"
              :key="c"
              type="button"
              class="vt-btn vt-btn--sm"
              :class="form.category === c ? 'vt-btn--ink' : 'vt-btn--ghost'"
              :aria-pressed="form.category === c"
              :disabled="orgUnavailable"
              @click="form.category = c"
            >
              {{ GRANT_CATEGORY_LABELS[c] }}
            </button>
          </div>
        </fieldset>

        <label class="vt-root-billing__field">
          <span class="vt-label">Комментарий (попадёт в аудит и в историю организатора)</span>
          <textarea
            v-model="form.comment"
            class="vt-field"
            name="comment"
            rows="2"
            required
            :maxlength="PLATFORM_GRANT_COMMENT_MAX"
            :disabled="orgUnavailable"
            placeholder="Напр. промо за участие в Private Beta"
            :aria-invalid="errors.comment ? 'true' : undefined"
            :aria-describedby="errors.comment ? 'grant-comment-error' : undefined"
          ></textarea>
          <span v-if="errors.comment" id="grant-comment-error" class="vt-root-billing__error">
            {{ errors.comment }}
          </span>
        </label>

        <div class="vt-card vt-root-grant__after">
          <span class="vt-root-billing__hint">Баланс после выдачи</span>
          <b class="vt-mono vt-root-billing__income" aria-live="polite">{{ after }}</b>
        </div>
      </section>
    </template>
  </form>
</template>
