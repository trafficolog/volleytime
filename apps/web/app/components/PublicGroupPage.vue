<script setup lang="ts">
import { formatEventDate, type PublicGroupPageView } from '@volley-time/shared'
import { computed } from 'vue'

import GroupLogo from '~/components/GroupLogo.vue'
import PublicGroupComplaint from '~/components/PublicGroupComplaint.vue'
import { SECTION_TITLES } from '~/utils/group-page-builder'
import { catalogPath, groupGeoText } from '~/utils/public-group-page'

/**
 * Публичная страница группы (24.1.2, W-14): серверный рендер того же содержимого, что показывает
 * предпросмотр конструктора (24.1.1). Только данные `GET /api/public/groups/{slug}`: секции уже
 * отфильтрованы сервером (включённые и непустые), событий «по приглашению» и персональных данных нет.
 */
const props = defineProps<{ data: PublicGroupPageView; host: string }>()

const g = computed(() => props.data.group)
const cover = computed(() => props.data.sections.find((s) => s.kind === 'cover'))
const body = computed(() => props.data.sections.filter((s) => s.kind !== 'cover'))
const when = (iso: string) => formatEventDate(iso, g.value.timezone)
const geo = computed(() => groupGeoText(props.data))
const address = computed(() =>
  g.value.shortLink ? `${props.host}/${g.value.shortLink}` : `${props.host}${props.data.path}`,
)
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink">
    <header class="border-b border-vt-stroke">
      <div class="mx-auto flex max-w-[960px] items-center gap-3.5 px-4 py-3.5 md:px-8">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Volley Time — на главную">
          <img src="/logo/vt-mark-color.svg" alt="" width="26" height="26" />
          <span class="uppercase" style="font-family: var(--f-display); font-weight: 700">
            Volley<span style="color: var(--vt-flame-ink)">Time</span>
          </span>
        </NuxtLink>
        <span
          class="ml-auto hidden rounded-full bg-vt-bone px-3 py-1.5 text-[length:var(--fs-xs)] text-vt-mute-2 sm:inline"
          data-testid="group-address"
          >{{ address }}</span
        >
      </div>
    </header>

    <main class="mx-auto max-w-[960px] px-4 pb-12 pt-6 md:px-8">
      <nav
        v-if="g.city && data.indexable"
        aria-label="Навигация"
        class="mb-4 text-[length:var(--fs-sm)] text-vt-mute-2"
      >
        <NuxtLink :to="catalogPath(g.city)" class="underline" data-testid="catalog-link"
          >Волейбол в городе {{ g.city }}</NuxtLink
        >
      </nav>

      <section
        class="vt-card vt-card--hero relative overflow-hidden p-6 md:p-8"
        aria-labelledby="group-title"
        data-gp-block="cover"
      >
        <div class="relative flex flex-wrap items-center gap-4">
          <GroupLogo
            :org-id="g.id"
            :name="g.name"
            :logo-updated-at="g.logoUpdatedAt"
            size-class="h-16 w-16 text-2xl"
          />
          <div class="min-w-0">
            <h1
              id="group-title"
              class="break-words text-[length:var(--fs-4xl)] uppercase md:text-[length:var(--fs-6xl)]"
              style="
                font-family: var(--f-display);
                font-weight: 700;
                line-height: 1.05;
                color: var(--vt-on-hero);
              "
            >
              {{ cover?.kind === 'cover' ? cover.headline : g.name }}
            </h1>
            <p
              v-if="cover?.kind === 'cover' && cover.subtitle"
              class="mt-2 text-[length:var(--fs-lg)]"
              style="color: var(--vt-on-hero)"
            >
              {{ cover.subtitle }}
            </p>
          </div>
        </div>
      </section>

      <div class="mt-6 grid gap-4">
        <template v-for="section in body" :key="section.kind">
          <section
            class="vt-card p-5 md:p-6"
            :aria-labelledby="`gp-${section.kind}`"
            :data-gp-block="section.kind"
          >
            <h2
              :id="`gp-${section.kind}`"
              class="mb-3 text-[length:var(--fs-xl)] font-semibold"
              style="font-family: var(--f-display)"
            >
              {{ SECTION_TITLES[section.kind] }}
            </h2>

            <template v-if="section.kind === 'about'">
              <p v-if="section.text" class="whitespace-pre-line">{{ section.text }}</p>
              <p v-if="section.place" class="mt-2 text-vt-mute-2">{{ section.place }}</p>
            </template>

            <template v-else-if="section.kind === 'schedule'">
              <ul v-if="section.events.length" class="grid gap-2">
                <li
                  v-for="e in section.events"
                  :key="e.publicSlug"
                  class="flex flex-wrap items-baseline justify-between gap-2 border-b border-vt-stroke pb-2 last:border-0"
                >
                  <NuxtLink :to="`/e/${e.publicSlug}`" class="font-semibold underline">{{
                    e.title
                  }}</NuxtLink>
                  <span class="text-vt-mute-2">
                    {{ when(e.startsAt)
                    }}<template v-if="e.place.name"> · {{ e.place.name }}</template>
                  </span>
                </li>
              </ul>
              <p v-else class="text-vt-mute-2">Ближайших открытых игр пока нет.</p>
            </template>

            <template v-else-if="section.kind === 'formats'">
              <p v-if="section.levels.length" class="mb-2 flex flex-wrap gap-1.5">
                <span v-for="level in section.levels" :key="level" class="vt-chip">{{
                  level
                }}</span>
              </p>
              <p v-if="section.text" class="whitespace-pre-line">{{ section.text }}</p>
            </template>

            <p v-else-if="section.kind === 'prices'" class="whitespace-pre-line">
              {{ section.text }}
            </p>

            <ul v-else-if="section.kind === 'venues'" class="grid gap-2">
              <li v-for="(v, i) in section.venues" :key="i">
                <strong>{{ v.name }}</strong>
                <span v-if="v.address" class="block text-vt-mute-2">{{ v.address }}</span>
              </li>
            </ul>

            <p v-else-if="section.kind === 'join'" class="whitespace-pre-line">
              {{ section.text }}
            </p>

            <dl v-else-if="section.kind === 'faq'" class="grid gap-3">
              <div v-for="(item, i) in section.items" :key="i">
                <dt class="font-semibold">{{ item.question }}</dt>
                <dd class="mt-1 whitespace-pre-line">{{ item.answer }}</dd>
              </div>
            </dl>
          </section>
        </template>
      </div>

      <p class="mt-8 text-[length:var(--fs-sm)] text-vt-mute-2" data-testid="geo-text">
        {{ geo }}
      </p>

      <PublicGroupComplaint :slug="data.slug" />
    </main>
  </div>
</template>
