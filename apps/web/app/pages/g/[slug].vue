<script setup lang="ts">
import type { PublicGroupPageView } from '@volley-time/shared'

import { groupPageJsonLd, groupPagePath, jsonLdText } from '~/utils/public-group-page'

/**
 * Публичная страница группы (24.1.2, W-14): серверный рендер, schema.org, canonical, OG.
 * Индексирование — по `seoIndex` группы (`indexable`): иначе noindex в meta и X-Robots-Tag.
 * Данные — `GET /api/public/groups/{slug}`; выключенная страница — 404.
 */
const route = useRoute()
const slug = String(route.params.slug ?? '')
const { data, error } = await useFetch<PublicGroupPageView>(
  `/api/public/groups/${encodeURIComponent(slug)}`,
  { key: `public-group-${slug}` },
)
const url = useRequestURL()

if (import.meta.server) {
  const event = useRequestEvent()
  if (event && !data.value) setResponseStatus(event, error.value?.statusCode === 429 ? 429 : 404)
  if (data.value) useResponseHeader('cache-control').value = 'public, max-age=15, s-maxage=15'
  if (!data.value?.indexable) useResponseHeader('x-robots-tag').value = 'noindex, nofollow'
}

useHead(() => {
  const d = data.value
  if (!d)
    return {
      title: 'Страница группы не найдена — Volley Time',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    }
  const canonical = `${url.origin}${groupPagePath(d.slug)}`
  const image = d.group.logoUpdatedAt
    ? `${url.origin}/api/organizations/${d.group.id}/logo`
    : `${url.origin}/logo/vt-apple-touch-icon.png`
  return {
    title: d.meta.title,
    meta: [
      { name: 'description', content: d.meta.description },
      { name: 'robots', content: d.indexable ? 'index, follow' : 'noindex, nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: d.meta.title },
      { property: 'og:description', content: d.meta.description },
      { property: 'og:url', content: canonical },
      { property: 'og:image', content: image },
      { property: 'og:locale', content: 'ru_RU' },
      { name: 'twitter:card', content: 'summary' },
    ],
    link: d.indexable ? [{ rel: 'canonical', href: canonical }] : [],
    script: groupPageJsonLd(d, url.origin).map((item) => ({
      type: 'application/ld+json',
      innerHTML: jsonLdText(item),
    })),
  }
})
</script>

<template>
  <PublicGroupPage v-if="data" :data="data" :host="url.host" />
  <div v-else class="flex min-h-screen items-center justify-center bg-vt-paper px-5 text-vt-ink">
    <EmptyState
      icon="alert"
      title="Страница группы не найдена"
      description="Группа скрыла страницу или ссылка устарела."
    >
      <template #action>
        <NuxtLink to="/" class="vt-btn vt-btn--primary">На главную</NuxtLink>
      </template>
    </EmptyState>
  </div>
</template>
