<script setup lang="ts">
import type { GroupPageModerationView } from '@volley-time/shared'
import { computed } from 'vue'

import VtIcon from '~/components/vt/Icon.vue'
import { formatWhen, moderationFacts } from '~/utils/root-group-pages'

/**
 * Решение администрации по странице (24.1.3): причина, заметка «Что исправить» и время вместо
 * статуса индексации. Автор решения организатору не показывается (контракт его не отдаёт).
 * Кнопок «Ответить модератору» и «Исправил — запросить проверку» нет: отложены владельцем.
 */
const props = defineProps<{
  moderation: GroupPageModerationView
  /** Настройка индексации владельца (`seoIndex`). */
  seoIndex: boolean
  city: string | null
}>()

const hidden = computed(() => props.moderation.state === 'hidden')
const facts = computed(() => moderationFacts(props.moderation.state, props.city))
</script>

<template>
  <section
    class="vt-card vt-mod-banner"
    :data-state="moderation.state"
    aria-labelledby="gp-moderation-title"
    data-gp-moderation
  >
    <div class="vt-mod-banner__head">
      <span class="vt-mod-banner__icon" aria-hidden="true">
        <VtIcon :name="hidden ? 'lock' : 'search'" :size="18" />
      </span>
      <div>
        <h2 id="gp-moderation-title" class="vt-mod-banner__title">
          {{
            hidden
              ? 'Администрация VolleyTime скрыла страницу'
              : 'Администрация VolleyTime закрыла страницу от поиска'
          }}
          <span class="vt-code vt-mod-banner__badge">{{
            hidden ? '404 по ссылке' : 'noindex'
          }}</span>
        </h2>
        <p data-gp-moderation-reason>
          Причина: <b>{{ moderation.reasonTitle }}</b>
          <template v-if="moderation.note">
            · <span data-gp-moderation-note>{{ moderation.note }}</span>
          </template>
        </p>
        <p class="vt-mod-banner__meta">
          <time :datetime="moderation.decidedAt">{{ formatWhen(moderation.decidedAt) }}</time>
        </p>
      </div>
    </div>
    <ul class="vt-mod-banner__facts" aria-label="Что сейчас происходит со страницей">
      <li v-for="f in facts" :key="f.text" class="vt-mod-fact">
        <span class="vt-mod-fact__mark" :data-ok="f.ok" aria-hidden="true">
          <VtIcon :name="f.ok ? 'check' : 'close'" :size="11" :stroke-width="2.6" />
        </span>
        <span
          >{{ f.text }}<span class="sr-only">{{ f.ok ? ' — да' : ' — нет' }}</span></span
        >
      </li>
    </ul>
    <p v-if="!hidden && seoIndex" class="vt-mod-banner__meta" data-gp-moderation-override>
      Индексация у вас включена, но сейчас её перекрывает решение администрации.
    </p>
  </section>
</template>
