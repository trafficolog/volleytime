<script setup lang="ts">
import {
  groupPagePath,
  type PlatformGroupPageHistory,
  type PlatformGroupPageRow,
} from '@volley-time/shared'
import { ref, watch } from 'vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import VtDialog from '~/components/vt/Dialog.vue'
import { formatWhen, historyEntryText, MODERATION_STATE_CHIPS } from '~/utils/root-group-pages'

/** История страницы (24.1.3): текущее решение, затем журнал решений root и жалоб. */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{ page: PlatformGroupPageRow }>()

const history = ref<PlatformGroupPageHistory | null>(null)
const pending = ref(false)
const failed = ref(false)
let seq = 0

async function load() {
  const mine = ++seq
  pending.value = true
  failed.value = false
  history.value = null
  try {
    const res = await $fetch<PlatformGroupPageHistory>(
      `/api/platform/group-pages/${props.page.organizationId}/history`,
    )
    if (mine === seq) history.value = res
  } catch {
    if (mine === seq) failed.value = true
  } finally {
    if (mine === seq) pending.value = false
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) void load()
  },
  { immediate: true },
)
</script>

<template>
  <VtDialog
    v-model="open"
    :title="`История · ${page.name}`"
    :sub="`${groupPagePath(page.slug, page.city)}${page.city ? ` · ${page.city}` : ''}`"
  >
    <SkeletonList v-if="pending" :count="3" />
    <ErrorState v-else-if="failed" message="Не удалось загрузить историю" @retry="load()" />
    <template v-else-if="history">
      <div class="vt-card vt-mod-history__state">
        <p class="vt-cap">Состояние модерации</p>
        <dl>
          <dt>Состояние</dt>
          <dd>
            <span class="vt-chip" :class="MODERATION_STATE_CHIPS[history.page.state].chip">
              {{ MODERATION_STATE_CHIPS[history.page.state].label }}
            </span>
          </dd>
          <dt>Причина</dt>
          <dd>{{ history.page.moderation?.reasonTitle ?? '—' }}</dd>
          <dt>Кто</dt>
          <dd class="vt-code">{{ history.page.moderation?.decidedBy?.name ?? '—' }}</dd>
          <dt>Когда</dt>
          <dd>
            {{ history.page.moderation ? formatWhen(history.page.moderation.decidedAt) : '—' }}
          </dd>
        </dl>
      </div>

      <p class="vt-cap vt-mod-history__cap">Журнал</p>
      <p v-if="!history.entries.length" class="vt-mod-muted">
        Решений и жалоб по странице не было.
      </p>
      <ol v-else class="vt-mod-history__list" aria-label="Журнал решений и жалоб">
        <li v-for="(entry, i) in history.entries" :key="i" class="vt-mod-history__entry">
          <time class="vt-mono vt-mod-muted" :datetime="entry.at">{{ formatWhen(entry.at) }}</time>
          <span>
            {{ historyEntryText(entry) }}
            <span class="vt-code vt-mod-muted">
              · {{ entry.kind === 'complaint' ? 'посетитель' : (entry.actor?.name ?? 'root') }}
            </span>
            <span v-if="entry.note" class="vt-mod-history__note">{{ entry.note }}</span>
          </span>
        </li>
      </ol>
    </template>
  </VtDialog>
</template>
