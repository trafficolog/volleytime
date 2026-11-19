<script setup lang="ts">
import type { PlatformOrganizationCreateResult } from '@volley-time/shared'

import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import {
  type OrgCreateForm,
  orgCreateBody,
  orgCreateErrorMessage,
  orgCreateErrors,
} from '~/utils/root-organizations'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Новая организация — Root Admin' })

const form = reactive<OrgCreateForm>({ name: '', slug: '', city: '', owner: '' })
const errors = ref<Partial<Record<keyof OrgCreateForm, string>>>({})
const failure = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  failure.value = ''
  errors.value = orgCreateErrors(form)
  if (Object.keys(errors.value).length) return
  submitting.value = true
  try {
    const created = await $fetch<PlatformOrganizationCreateResult>('/api/platform/organizations', {
      method: 'POST',
      body: orgCreateBody(form),
    })
    await navigateTo(`/root/organizations/${created.id}`)
  } catch (e) {
    const status = apiErrorStatus(e)
    if (status === 401) return navigateTo('/auth/login')
    if (status === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Раздел доступен только администратору платформы',
        fatal: true,
      })
    }
    const code = apiErrorCode(e)
    if (code === 'organization.slug_taken') errors.value = { slug: orgCreateErrorMessage(code) }
    else if (code?.startsWith('platform.owner_')) {
      errors.value = { owner: orgCreateErrorMessage(code) }
    } else failure.value = orgCreateErrorMessage(code)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="vt-root-orgs vt-root-orgs-new" novalidate @submit.prevent="submit">
    <header class="vt-root-overview__heading vt-root-orgs__head">
      <div>
        <h1 tabindex="-1">
          Новая организация <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p class="text-vt-mute-2">Ручное создание (обычно группы регистрируются сами через бота)</p>
      </div>
      <div class="vt-root-orgs__actions">
        <NuxtLink to="/root/organizations" class="vt-btn vt-btn--ghost vt-btn--sm">
          Отмена
        </NuxtLink>
        <button type="submit" class="vt-btn vt-btn--primary vt-btn--sm" :disabled="submitting">
          <VtIcon name="check" :size="14" /> {{ submitting ? 'Создаём…' : 'Создать' }}
        </button>
      </div>
    </header>

    <p v-if="failure" role="alert" class="vt-root-audit__error">{{ failure }}</p>

    <div class="vt-root-orgs-new__grid">
      <section class="vt-card vt-root-orgs-new__card" aria-labelledby="org-new-profile">
        <h2 id="org-new-profile">Профиль организации</h2>
        <div class="vt-root-orgs-new__fields">
          <div class="vt-root-orgs-new__wide">
            <label class="vt-label" for="org-name">Название</label>
            <input
              id="org-name"
              v-model="form.name"
              class="vt-field"
              name="name"
              maxlength="100"
              placeholder="Напр. VolleyTime Гомель"
              :aria-invalid="errors.name ? 'true' : undefined"
              :aria-describedby="errors.name ? 'org-name-error' : undefined"
            />
            <p v-if="errors.name" id="org-name-error" class="vt-root-orgs-new__error">
              {{ errors.name }}
            </p>
          </div>
          <div>
            <label class="vt-label" for="org-slug">Короткий код</label>
            <div class="vt-root-orgs-new__prefixed">
              <span class="vt-field vt-root-orgs-new__prefix" aria-hidden="true">org_</span>
              <input
                id="org-slug"
                v-model="form.slug"
                class="vt-field"
                name="slug"
                maxlength="64"
                placeholder="vt-gomel"
                autocapitalize="none"
                :aria-invalid="errors.slug ? 'true' : undefined"
                :aria-describedby="errors.slug ? 'org-slug-error' : 'org-slug-hint'"
              />
            </div>
            <p v-if="errors.slug" id="org-slug-error" class="vt-root-orgs-new__error">
              {{ errors.slug }}
            </p>
            <p v-else id="org-slug-hint" class="vt-root-orgs-new__hint">
              Пусто — код возьмётся из названия
            </p>
          </div>
          <div>
            <label class="vt-label" for="org-city">Город</label>
            <input
              id="org-city"
              v-model="form.city"
              class="vt-field"
              name="city"
              maxlength="100"
              placeholder="Гомель"
              :aria-invalid="errors.city ? 'true' : undefined"
            />
            <p v-if="errors.city" class="vt-root-orgs-new__error">{{ errors.city }}</p>
          </div>
          <div class="vt-root-orgs-new__wide">
            <label class="vt-label" for="org-owner">Владелец · email или Telegram</label>
            <input
              id="org-owner"
              v-model="form.owner"
              class="vt-field"
              name="owner"
              maxlength="254"
              placeholder="@username или user@mail.com"
              autocapitalize="none"
              :aria-invalid="errors.owner ? 'true' : undefined"
              :aria-describedby="errors.owner ? 'org-owner-error' : 'org-owner-hint'"
            />
            <p v-if="errors.owner" id="org-owner-error" class="vt-root-orgs-new__error">
              {{ errors.owner }}
            </p>
            <p v-else id="org-owner-hint" class="vt-root-orgs-new__hint">
              Владелец должен уже быть в системе: войти в приложение через бота или по email
            </p>
          </div>
        </div>
      </section>

      <div class="vt-root-orgs-new__side">
        <section class="vt-card vt-root-orgs-new__card" aria-labelledby="org-new-start">
          <h2 id="org-new-start">Старт</h2>
          <p class="vt-root-orgs-new__hint">
            Новой группе автоматически начисляется демо-квота баланса событий, как при обычной
            регистрации. Владелец станет её owner.
          </p>
        </section>
        <div class="vt-card vt-root-orgs-new__note" role="note">
          <VtIcon name="bell" :size="15" />
          <span>
            Создание вручную записывается в журнал как
            <b class="vt-mono">organization.created</b> с автором root.
          </span>
        </div>
      </div>
    </div>
  </form>
</template>
