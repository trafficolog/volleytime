<script setup lang="ts">
import {
  formatEventDate,
  type GroupPageContent,
  type GroupPageEvent,
  type GroupPageVenue,
  type GroupPageView,
} from '@volley-time/shared'
import { computed } from 'vue'

import GroupLogo from '~/components/GroupLogo.vue'
import { SECTION_TITLES } from '~/utils/group-page-builder'

/**
 * Предпросмотр страницы группы (24.1.1, D-24): лёгкий клиентский компонент, который рисуется по
 * данным формы (`GroupPageContent`) и данным группы из ответа API, без запросов. На нём строится
 * публичный рендер 24.1.2: тот же вход (`content` + `group` + `venues` + `events` + `defaults`).
 * Показываются только включённые секции, в порядке `content.sections`.
 */
const props = withDefaults(
  defineProps<{
    content: GroupPageContent
    group: GroupPageView['group']
    venues: GroupPageVenue[]
    events: GroupPageEvent[]
    /** Значения по умолчанию: подставляются, когда текст не задан. */
    defaults: GroupPageView['resolved']
    /** Заголовки уровней по коду; нет заголовка — показывается код. */
    levelTitles?: Record<string, string>
    device: 'desktop' | 'phone'
  }>(),
  { levelTitles: () => ({}) },
)

const sections = computed(() => props.content.sections.filter((s) => s.enabled))
const title = computed(() => props.content.metaTitle ?? props.defaults.metaTitle)
const description = computed(() => props.content.metaDescription ?? props.defaults.metaDescription)
const place = computed(() => [props.group.city, props.group.district].filter(Boolean).join(', '))
const selectedVenues = (ids: number[]) =>
  ids.flatMap((id) => props.venues.filter((v) => v.id === id))
const when = (event: GroupPageEvent) => formatEventDate(event.startsAt, props.group.timezone)
</script>

<template>
  <div class="vt-gp-preview" :data-device="device">
    <div class="vt-gp-snippet" data-gp-snippet>
      <p class="vt-gp-snippet__url">volleytime.by/g/{{ group.slug }}</p>
      <p class="vt-gp-snippet__title">{{ title }}</p>
      <p class="vt-gp-snippet__text">{{ description }}</p>
    </div>
    <div class="vt-gp-frame" :class="`vt-gp-frame--${device}`">
      <article class="vt-gp-page">
        <p v-if="sections.length === 0" class="vt-settings-hint" data-gp-empty>
          Все секции выключены: на странице нечего показывать.
        </p>
        <template v-for="section in sections" :key="section.kind">
          <section
            v-if="section.kind === 'cover'"
            class="vt-gp-block vt-gp-block--cover"
            data-gp-block="cover"
          >
            <GroupLogo
              :org-id="group.id"
              :name="group.name"
              :logo-updated-at="group.logoUpdatedAt"
              size-class="h-14 w-14 text-xl"
            />
            <h3 class="vt-gp-block__headline">{{ section.headline ?? group.name }}</h3>
            <p v-if="section.subtitle" class="vt-gp-block__lead">{{ section.subtitle }}</p>
          </section>
          <section v-else-if="section.kind === 'about'" class="vt-gp-block" data-gp-block="about">
            <h4>{{ SECTION_TITLES.about }}</h4>
            <p v-if="section.text" class="vt-gp-block__text">{{ section.text }}</p>
            <p v-if="place" class="vt-gp-block__meta">{{ place }}</p>
          </section>
          <section
            v-else-if="section.kind === 'schedule'"
            class="vt-gp-block"
            data-gp-block="schedule"
          >
            <h4>{{ SECTION_TITLES.schedule }}</h4>
            <ul v-if="events.length" class="vt-gp-list">
              <li v-for="event in events" :key="event.id">
                <strong>{{ event.title }}</strong>
                <span>{{ when(event) }}</span>
              </li>
            </ul>
            <p v-else class="vt-gp-block__meta">Ближайших игр пока нет.</p>
          </section>
          <section
            v-else-if="section.kind === 'formats'"
            class="vt-gp-block"
            data-gp-block="formats"
          >
            <h4>{{ SECTION_TITLES.formats }}</h4>
            <p v-if="group.levels.length" class="vt-gp-chips">
              <span v-for="code in group.levels" :key="code" class="vt-chip">{{
                levelTitles[code] ?? code
              }}</span>
            </p>
            <p v-if="section.text" class="vt-gp-block__text">{{ section.text }}</p>
          </section>
          <section v-else-if="section.kind === 'prices'" class="vt-gp-block" data-gp-block="prices">
            <h4>{{ SECTION_TITLES.prices }}</h4>
            <p v-if="section.text" class="vt-gp-block__text">{{ section.text }}</p>
          </section>
          <section v-else-if="section.kind === 'venues'" class="vt-gp-block" data-gp-block="venues">
            <h4>{{ SECTION_TITLES.venues }}</h4>
            <ul v-if="selectedVenues(section.venueIds).length" class="vt-gp-list">
              <li v-for="venue in selectedVenues(section.venueIds)" :key="venue.id">
                <strong>{{ venue.name }}</strong>
                <span v-if="venue.address">{{ venue.address }}</span>
              </li>
            </ul>
            <p v-else class="vt-gp-block__meta">Залы не выбраны.</p>
          </section>
          <section v-else-if="section.kind === 'join'" class="vt-gp-block" data-gp-block="join">
            <h4>{{ SECTION_TITLES.join }}</h4>
            <p class="vt-gp-block__text">{{ section.text ?? defaults.joinText }}</p>
          </section>
          <section v-else-if="section.kind === 'faq'" class="vt-gp-block" data-gp-block="faq">
            <h4>{{ SECTION_TITLES.faq }}</h4>
            <dl v-if="section.items.length" class="vt-gp-faq">
              <template v-for="(item, i) in section.items" :key="i">
                <dt>{{ item.question }}</dt>
                <dd>{{ item.answer }}</dd>
              </template>
            </dl>
            <p v-else class="vt-gp-block__meta">Вопросов пока нет.</p>
          </section>
        </template>
      </article>
    </div>
  </div>
</template>
