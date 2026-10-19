<script setup lang="ts">
import { publicEventModel, publicEventProblem, type PublicEventPayload } from '~/utils/public-event'

/**
 * Публичная страница события по ссылке (20.6.1, P-17): без авторизации, серверный рендер.
 * Индексирование — по `seoIndex` группы (ответ API: `indexable`); иначе noindex в meta и в
 * заголовке X-Robots-Tag. Данные — `GET /api/public/events/{slug}`.
 */
const route = useRoute()
const slug = String(route.params.slug ?? '')
const { data, error } = await useFetch<PublicEventPayload>(
  `/api/public/events/${encodeURIComponent(slug)}`,
  { key: `public-event-${slug}` },
)

// одно значение «сейчас» на сервере и при гидратации; на клиенте обновляется раз в минуту
const nowMs = useState('public-event-now', () => Date.now())
const now = computed(() => new Date(nowMs.value))
if (import.meta.client) {
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    nowMs.value = Date.now()
    timer = setInterval(() => (nowMs.value = Date.now()), 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
}

const url = useRequestURL()
const linkLabel = computed(() => `${url.host}/e/${slug}`)
const found = computed(() => (data.value ? publicEventModel(data.value, now.value) : null))
const problem = computed(() => publicEventProblem(error.value?.statusCode))

if (import.meta.server) {
  const event = useRequestEvent()
  if (event && !data.value) setResponseStatus(event, problem.value.status)
  if (data.value) useResponseHeader('cache-control').value = 'public, max-age=15, s-maxage=15'
  if (!data.value?.indexable) useResponseHeader('x-robots-tag').value = 'noindex, nofollow'
}

useHead(() => {
  const d = data.value
  if (!d || !found.value)
    return {
      title: 'Событие не найдено — Volley Time',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    }
  const canonical = `${url.origin}/e/${d.slug}`
  return {
    title: found.value.seoTitle,
    meta: [
      { name: 'description', content: found.value.seoDescription },
      { name: 'robots', content: d.indexable ? 'index, follow' : 'noindex, nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: found.value.seoTitle },
      { property: 'og:description', content: found.value.seoDescription },
    ],
    link: d.indexable ? [{ rel: 'canonical', href: canonical }] : [],
  }
})
</script>

<template>
  <PublicEventPage v-if="data" :data="data" :now="now" :link-label="linkLabel" />
  <div v-else class="flex min-h-screen items-center justify-center bg-vt-paper px-5 text-vt-ink">
    <EmptyState icon="alert" :title="problem.title" :description="problem.description">
      <template #action>
        <NuxtLink to="/" class="vt-btn vt-btn--primary">На главную</NuxtLink>
      </template>
    </EmptyState>
  </div>
</template>
