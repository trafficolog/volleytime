<script setup lang="ts">
import type { PlatformOrganizationDetail } from '@volley-time/shared'

import { apiErrorStatus } from '~/utils/api-error'
import { orgDetailView } from '~/utils/root-organizations'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, pending, error, refresh } = await useFetch<PlatformOrganizationDetail>(
  () => `/api/platform/organizations/${id.value}`,
  { key: `root-organization-${id.value}` },
)
const status = apiErrorStatus(error.value)
const failure = rootOverviewFailure(status)
if (error.value && failure === 'forbidden') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Раздел доступен только администратору платформы',
    fatal: true,
  })
}
if (error.value && failure === 'login') await navigateTo('/auth/login')
const notFound = computed(() => apiErrorStatus(error.value) === 404)

const view = computed(() => (data.value ? orgDetailView(data.value, new Date()) : null))
useHead({ title: computed(() => `${view.value?.title ?? 'Организация'} — Root Admin`) })
</script>

<template>
  <div class="vt-root-orgs vt-root-org">
    <NuxtLink to="/root/organizations" class="vt-root-org__back">
      <VtIcon name="chevron-l" :size="14" /> Все организации
    </NuxtLink>

    <SkeletonList v-if="pending && !view" :count="4" />
    <EmptyState
      v-else-if="notFound"
      icon="home"
      title="Организация не найдена"
      description="Возможно, номер указан неверно"
    />
    <ErrorState
      v-else-if="error || !view || !data"
      message="Не удалось загрузить организацию"
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
        <NuxtLink
          :to="{ path: '/root/audit', query: { organization: String(data.id) } }"
          class="vt-btn vt-btn--ghost vt-btn--sm"
        >
          Полный аудит
        </NuxtLink>
      </header>

      <ul class="vt-root-org__kpis" aria-label="Показатели организации">
        <li v-for="k in view.kpis" :key="k.label" class="vt-card">
          <p class="vt-cap">{{ k.label }}</p>
          <p class="vt-root-org__kpi-value vt-mono" :data-tone="k.tone">{{ k.value }}</p>
          <p class="vt-root-org__kpi-note">{{ k.note }}</p>
        </li>
      </ul>

      <div class="vt-root-org__cols">
        <div class="vt-root-org__col">
          <section class="vt-card vt-root-org__panel" aria-labelledby="org-profile">
            <h2 id="org-profile">Профиль</h2>
            <dl class="vt-root-org__profile">
              <template v-for="p in view.profile" :key="p.label">
                <dt>{{ p.label }}</dt>
                <dd>{{ p.value }}</dd>
              </template>
              <dt>Модули</dt>
              <dd class="vt-root-org__modules">
                <span
                  v-for="m in view.modules"
                  :key="m.label"
                  class="vt-chip vt-mono"
                  :data-on="m.on"
                >
                  {{ m.label }}{{ m.on ? '' : ': off' }}
                </span>
              </dd>
            </dl>
          </section>

          <section class="vt-card vt-root-org__panel" aria-labelledby="org-audit">
            <h2 id="org-audit">События организации · 7 дней</h2>
            <p v-if="!view.audit.length" class="vt-root-org__empty">За 7 дней записей нет</p>
            <ol v-else class="vt-root-org__list">
              <li v-for="a in view.audit" :key="a.id">
                <span class="vt-mono vt-root-org__time">{{ a.time }}</span>
                <span class="vt-mono">{{ a.action }}</span>
                <span class="vt-root-org__who">{{ a.actor }}</span>
              </li>
            </ol>
          </section>
        </div>

        <section class="vt-card vt-root-org__panel" aria-labelledby="org-balance">
          <h2 id="org-balance">История баланса событий</h2>
          <p v-if="!view.history.length" class="vt-root-org__empty">Операций нет</p>
          <ol v-else class="vt-root-org__list vt-root-org__list--balance">
            <li v-for="h in view.history" :key="h.id">
              <span class="vt-mono vt-root-org__time">{{ h.time }}</span>
              <span>{{ h.reason }}</span>
              <b class="vt-mono">{{ h.delta }}</b>
              <span class="vt-mono vt-root-org__who">→ {{ h.after }}</span>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>
