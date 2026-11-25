<script setup lang="ts">
import type { PlatformUserBlockResult, PlatformUserDetail } from '@volley-time/shared'

import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { rootOverviewFailure } from '~/utils/root-overview'
import { blockErrorMessage, userDetailView, userRowView } from '~/utils/root-users'

definePageMeta({ layout: 'root', middleware: ['root'] })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, pending, error, refresh } = await useFetch<PlatformUserDetail>(
  () => `/api/platform/users/${id.value}`,
  { key: `root-user-${id.value}` },
)
const failure = rootOverviewFailure(apiErrorStatus(error.value))
if (error.value && failure === 'forbidden') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Нет доступа к разделу',
    fatal: true,
  })
}
if (error.value && failure === 'login') await navigateTo('/auth/login')
const notFound = computed(() => apiErrorStatus(error.value) === 404)

const view = computed(() => (data.value ? userDetailView(data.value) : null))
const stats = computed(() => (data.value ? userRowView(data.value, new Date()) : null))
useHead({ title: computed(() => `${view.value?.title ?? 'Пользователь'} — Root Admin`) })

// Блокировка: сначала подтверждение (в макете — диалог «Заблокировать …?»), затем запрос
const confirming = ref(false)
const submitting = ref(false)
const actionError = ref('')
const cancelButton = ref<HTMLButtonElement | null>(null)

async function askBlock() {
  actionError.value = ''
  confirming.value = true
  await nextTick()
  cancelButton.value?.focus()
}

async function run(action: 'block' | 'unblock') {
  if (submitting.value) return
  submitting.value = true
  actionError.value = ''
  try {
    await $fetch<PlatformUserBlockResult>(`/api/platform/users/${id.value}/${action}`, {
      method: 'POST',
    })
    confirming.value = false
    await refresh()
  } catch (e) {
    const status = apiErrorStatus(e)
    if (status === 401) return navigateTo('/auth/login')
    if (status === 403 && apiErrorCode(e) === 'forbidden.root_only') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Нет доступа к разделу',
        fatal: true,
      })
    }
    actionError.value = blockErrorMessage(apiErrorCode(e))
    // состояние могло измениться у другого администратора: показываем актуальное
    await refresh()
    confirming.value = false
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="vt-root-orgs vt-root-org vt-root-user">
    <NuxtLink to="/root/users" class="vt-root-org__back">
      <VtIcon name="chevron-l" :size="14" /> Все пользователи
    </NuxtLink>

    <SkeletonList v-if="pending && !view" :count="4" />
    <EmptyState
      v-else-if="notFound"
      icon="users"
      title="Пользователь не найден"
      description="Возможно, номер указан неверно"
    />
    <ErrorState
      v-else-if="error || !view || !data || !stats"
      message="Не удалось загрузить пользователя"
      @retry="refresh()"
    />
    <template v-else>
      <header class="vt-root-overview__heading vt-root-orgs__head">
        <div>
          <h1 tabindex="-1">
            {{ view.title }}
            <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
            <span v-if="view.statusLabel" class="vt-chip vt-chip--rose">{{
              view.statusLabel
            }}</span>
          </h1>
          <p class="vt-mono text-vt-mute-2">{{ view.subtitle }}</p>
        </div>
        <div class="vt-root-orgs__actions">
          <button
            v-if="view.canBlock"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="submitting || confirming"
            @click="askBlock()"
          >
            Заблокировать
          </button>
          <button
            v-else-if="view.canUnblock"
            type="button"
            class="vt-btn vt-btn--ink vt-btn--sm"
            :disabled="submitting"
            @click="run('unblock')"
          >
            {{ submitting ? 'Разблокируем…' : 'Разблокировать' }}
          </button>
        </div>
      </header>

      <section
        v-if="confirming"
        class="vt-card vt-root-user__confirm"
        role="alertdialog"
        aria-labelledby="user-block-title"
        aria-describedby="user-block-body"
      >
        <h2 id="user-block-title">Заблокировать {{ view.title }}?</h2>
        <p id="user-block-body">
          Пользователь не сможет войти в платформу. Сессии будут закрыты. Действие попадёт в журнал.
        </p>
        <div class="vt-root-orgs__actions">
          <button
            ref="cancelButton"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="submitting"
            @click="confirming = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--rose vt-btn--sm"
            :disabled="submitting"
            @click="run('block')"
          >
            {{ submitting ? 'Блокируем…' : 'Заблокировать' }}
          </button>
        </div>
      </section>

      <p v-if="actionError" role="alert" class="vt-root-audit__error">{{ actionError }}</p>

      <ul class="vt-root-org__kpis vt-root-user__kpis" aria-label="Показатели пользователя">
        <li class="vt-card">
          <p class="vt-cap">Групп</p>
          <p class="vt-root-org__kpi-value vt-mono">{{ stats.groups }}</p>
          <p class="vt-root-org__kpi-note">{{ stats.role || 'активных членств нет' }}</p>
        </li>
        <li class="vt-card">
          <p class="vt-cap">Записей</p>
          <p class="vt-root-org__kpi-value vt-mono">{{ stats.bookings }}</p>
          <p class="vt-root-org__kpi-note">без отменённых</p>
        </li>
        <li class="vt-card">
          <p class="vt-cap">Активность</p>
          <p class="vt-root-org__kpi-value vt-mono">{{ stats.activity }}</p>
          <p class="vt-root-org__kpi-note">последняя запись или вход</p>
        </li>
      </ul>

      <div class="vt-root-org__cols">
        <div class="vt-root-org__col">
          <section class="vt-card vt-root-org__panel" aria-labelledby="user-profile">
            <h2 id="user-profile">Профиль</h2>
            <dl class="vt-root-org__profile">
              <template v-for="p in view.profile" :key="p.label">
                <dt>{{ p.label }}</dt>
                <dd>{{ p.value }}</dd>
              </template>
            </dl>
          </section>

          <section class="vt-card vt-root-org__panel" aria-labelledby="user-audit">
            <h2 id="user-audit">Журнал блокировок</h2>
            <p v-if="!view.audit.length" class="vt-root-org__empty">Записей нет</p>
            <ol v-else class="vt-root-org__list">
              <li v-for="a in view.audit" :key="a.id">
                <span class="vt-mono vt-root-org__time">{{ a.time }}</span>
                <span>{{ a.action }}</span>
                <span class="vt-root-org__who">{{ a.actor }}</span>
              </li>
            </ol>
          </section>
        </div>

        <section class="vt-card vt-root-org__panel" aria-labelledby="user-groups">
          <h2 id="user-groups">Группы и роли</h2>
          <p v-if="!view.memberships.length" class="vt-root-org__empty">Групп нет</p>
          <ul v-else class="vt-root-org__list vt-root-user__groups">
            <li v-for="m in view.memberships" :key="m.key">
              <span>
                <NuxtLink :to="`/root/organizations/${m.key}`" class="vt-root-user__link">
                  {{ m.name }}
                </NuxtLink>
                <span class="vt-mono vt-root-org__who vt-root-user__code">{{ m.code }}</span>
              </span>
              <span>{{ m.role }}</span>
              <span class="vt-root-org__who">{{ m.status }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
