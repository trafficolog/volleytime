<script setup lang="ts">
import type { PublicCatalogView } from '@volley-time/shared'

import GroupLogo from '~/components/GroupLogo.vue'
import {
  catalogJsonLd,
  catalogPath,
  catalogTitle,
  groupPagePath,
  jsonLdText,
} from '~/utils/public-group-page'

/**
 * Каталог «Волейбол в городе {город}» (24.1.2, W-14): только индексируемые группы (страница
 * опубликована и `seoIndex`). Групп нет — 404 и noindex. Данные — `GET /api/public/catalog/{city}`.
 */
const route = useRoute()
const city = String(route.params.city ?? '')
const { data, error } = await useFetch<PublicCatalogView>(
  `/api/public/catalog/${encodeURIComponent(city)}`,
  { key: `public-catalog-${city.toLowerCase()}` },
)
const url = useRequestURL()

if (import.meta.server) {
  const event = useRequestEvent()
  if (event && !data.value) {
    setResponseStatus(event, error.value?.statusCode === 429 ? 429 : 404)
    useResponseHeader('x-robots-tag').value = 'noindex, nofollow'
  }
  if (data.value) useResponseHeader('cache-control').value = 'public, max-age=60, s-maxage=60'
}

const description = computed(() =>
  data.value
    ? `Волейбольные группы в городе ${data.value.city}: ${data.value.groups.length} — расписание игр, залы, уровни и запись онлайн в Volley Time.`
    : '',
)

useHead(() => {
  const d = data.value
  if (!d)
    return {
      title: 'Каталог не найден — Volley Time',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    }
  const canonical = `${url.origin}${catalogPath(d.city)}`
  return {
    title: catalogTitle(d.city),
    meta: [
      { name: 'description', content: description.value },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: catalogTitle(d.city) },
      { property: 'og:description', content: description.value },
      { property: 'og:url', content: canonical },
    ],
    link: [{ rel: 'canonical', href: canonical }],
    script: [{ type: 'application/ld+json', innerHTML: jsonLdText(catalogJsonLd(d, url.origin)) }],
  }
})
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink">
    <header class="border-b border-vt-stroke">
      <div class="mx-auto flex max-w-[960px] items-center gap-2 px-4 py-3.5 md:px-8">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Volley Time — на главную">
          <img src="/logo/vt-mark-color.svg" alt="" width="26" height="26" />
          <span class="uppercase" style="font-family: var(--f-display); font-weight: 700">
            Volley<span style="color: var(--vt-flame-ink)">Time</span>
          </span>
        </NuxtLink>
      </div>
    </header>
    <main v-if="data" class="mx-auto max-w-[960px] px-4 pb-12 pt-6 md:px-8">
      <h1
        class="text-[length:var(--fs-4xl)] uppercase"
        style="font-family: var(--f-display); font-weight: 700; line-height: 1.05"
      >
        Волейбол в городе {{ data.city }}
      </h1>
      <p class="mt-2 text-vt-mute-2" data-testid="catalog-geo">{{ description }}</p>
      <ul class="mt-6 grid gap-3 md:grid-cols-2">
        <li v-for="g in data.groups" :key="g.slug">
          <NuxtLink
            :to="groupPagePath(g.slug)"
            class="vt-card flex items-center gap-3 p-4"
            data-testid="catalog-group"
          >
            <GroupLogo
              :org-id="g.id"
              :name="g.name"
              :logo-updated-at="g.logoUpdatedAt"
              size-class="h-12 w-12 text-lg"
            />
            <span class="min-w-0">
              <span class="block font-semibold">{{ g.name }}</span>
              <span class="block text-[length:var(--fs-sm)] text-vt-mute-2">
                {{ [g.district, g.levels.join(', ')].filter(Boolean).join(' · ') }}
              </span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </main>
    <div v-else class="flex min-h-[60vh] items-center justify-center px-5">
      <EmptyState
        icon="alert"
        title="Групп в этом городе пока нет"
        description="Откройте главную, чтобы узнать о Volley Time."
      >
        <template #action>
          <NuxtLink to="/" class="vt-btn vt-btn--primary">На главную</NuxtLink>
        </template>
      </EmptyState>
    </div>
  </div>
</template>
