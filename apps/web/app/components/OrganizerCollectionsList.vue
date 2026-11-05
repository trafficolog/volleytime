<script setup lang="ts">
import { collectionDeadlineLabel } from '~/utils/collections'
import { collectionProgress } from '~/utils/desktop-collections'
import { formatMoneyRu } from '~/utils/labels'
import {
  organizerSections,
  organizerSummary,
  type ManagedCollection,
} from '~/utils/organizer-collections'

/**
 * Сборы организатора (21.1.5, `OrgContribs`): итоги, активные и завершённые сборы, «Новый сбор».
 * Загрузку и ошибки ведёт страница; при выключенном `COLLECTIONS_ENABLED` создание скрыто
 * (`canCreate = false`), существующие сборы открываются для разбора обещаний и закрытия.
 */
const props = defineProps<{
  collections: ManagedCollection[]
  base: string
  tz: string
  canCreate: boolean
  hasMore: boolean
  loadingMore: boolean
  loadError: string
}>()
const emit = defineEmits<{ loadMore: [] }>()

const now = new Date()
const summary = computed(() => organizerSummary(props.collections))
const sections = computed(() => organizerSections(props.collections))
const currency = computed(() => props.collections[0]?.currency ?? 'BYN')
const newPath = computed(() => `${props.base}/collections/new`)

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'участник'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника'
  return 'участников'
}

function meta(c: ManagedCollection): string {
  const parts = [`${c.contributors} ${plural(c.contributors)}`]
  if (c.status === 'active' || c.status === 'draft') {
    const deadline = collectionDeadlineLabel(c.deadlineAt, props.tz, now)
    if (deadline) parts.push(deadline.date)
  } else parts.push(c.status === 'cancelled' ? 'отменён' : 'завершён')
  return parts.join(' · ')
}

type ChipTone = 'default' | 'flame' | 'amber' | 'grass'
function chip(c: ManagedCollection): { tone: ChipTone; label: string; dot?: boolean } {
  if (c.status === 'draft') return { tone: 'amber', label: 'черновик' }
  if (c.status === 'cancelled') return { tone: 'default', label: 'отменён' }
  if (c.status === 'completed') return { tone: 'grass', label: 'готово', dot: true }
  const pct = collectionProgress(c)
  return { tone: 'flame', label: pct === null ? 'активен' : `${pct}%` }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Сборы" sub="управление кампаниями">
      <template v-if="canCreate" #right>
        <NuxtLink
          :to="newPath"
          class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44"
          aria-label="Новый сбор"
        >
          <VtIcon name="plus" :size="14" />
        </NuxtLink>
      </template>
    </VtMiniHeader>
    <main class="px-4 pb-5 pt-2">
      <p v-if="!canCreate" class="vt-card mb-3.5 p-3.5 text-sm text-vt-mute-2" role="status">
        Создание и правка сборов пока недоступны. Обещания можно подтверждать и отклонять, а сборы
        завершать или отменять.
      </p>

      <EmptyState
        v-if="!collections.length"
        icon="gift"
        :title="canCreate ? 'Запустите первый сбор' : 'Сборов нет'"
        :description="
          canCreate
            ? 'Мячи, форма, аренда зала на турнир — укажите цель и дедлайн, игроки увидят сбор в приложении.'
            : 'Когда создание сборов станет доступно, они появятся здесь'
        "
      >
        <template v-if="canCreate" #action>
          <NuxtLink :to="newPath" class="vt-btn vt-btn--primary">Новый сбор</NuxtLink>
        </template>
      </EmptyState>

      <template v-else>
        <section class="mb-3.5 grid grid-cols-2 gap-2" aria-label="Итоги по сборам">
          <div class="vt-card !px-3.5 !py-3">
            <div class="vt-cap text-vt-mute-2">Активных</div>
            <div class="vt-mono mt-1 text-xl font-bold" data-summary="active">
              {{ summary.active }}
            </div>
          </div>
          <div class="vt-card !px-3.5 !py-3">
            <div class="vt-cap text-vt-mute-2">Собрано всего</div>
            <div class="vt-mono mt-1 text-xl font-bold text-vt-grass-ink" data-summary="collected">
              {{ formatMoneyRu(summary.collected, currency) }}
            </div>
          </div>
        </section>
        <p v-if="hasMore" class="-mt-1.5 mb-3 px-1 text-[11px] text-vt-mute-2">
          Итоги по загруженным сборам; остальные откроет «Показать ещё».
        </p>

        <template
          v-for="section in [
            { key: 'draft', title: 'Черновики', items: sections.draft },
            { key: 'active', title: 'Активные', items: sections.active },
            { key: 'finished', title: 'Завершённые', items: sections.finished },
          ]"
          :key="section.key"
        >
          <section
            v-if="section.items.length"
            class="mb-5"
            :aria-labelledby="`org-collections-${section.key}`"
          >
            <h2 :id="`org-collections-${section.key}`" class="vt-cap mx-1 mb-2.5 text-vt-mute-2">
              {{ section.title }}
            </h2>
            <ul class="flex flex-col gap-2.5">
              <li v-for="c in section.items" :key="c.id">
                <NuxtLink
                  :to="`${base}/collections/${c.id}`"
                  class="vt-card vt-card--raised block !p-3.5"
                  :class="c.status === 'completed' || c.status === 'cancelled' ? 'grayscale' : ''"
                  data-collection-card
                >
                  <div class="flex items-center gap-2.5">
                    <VtCampaignIcon :name="c.icon" :size="40" />
                    <div class="min-w-0 flex-1">
                      <div class="font-display truncate text-base font-semibold leading-tight">
                        {{ c.title }}
                      </div>
                      <div class="mt-0.5 truncate text-[11px] text-vt-mute-2">{{ meta(c) }}</div>
                    </div>
                    <VtChip :tone="chip(c).tone" :dot="chip(c).dot" class="shrink-0">{{
                      chip(c).label
                    }}</VtChip>
                  </div>
                  <div class="mt-2.5 flex items-center gap-2">
                    <div
                      v-if="collectionProgress(c) !== null"
                      class="vt-meter h-1.5 flex-1"
                      role="meter"
                      aria-label="Собрано"
                      :aria-valuenow="collectionProgress(c)!"
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      <i
                        :style="{
                          width: `${collectionProgress(c)}%`,
                          background:
                            c.status === 'completed' ? 'var(--vt-grass)' : 'var(--vt-flame)',
                        }"
                      />
                    </div>
                    <span v-else class="flex-1" />
                    <span class="vt-mono text-xs font-semibold">
                      {{ formatMoneyRu(c.collected, c.currency)
                      }}<span v-if="c.targetAmount !== null" class="font-normal text-vt-mute-2">
                        / {{ formatMoneyRu(c.targetAmount, c.currency) }}</span
                      >
                    </span>
                  </div>
                </NuxtLink>
              </li>
            </ul>
          </section>
        </template>

        <p v-if="loadError" class="mb-3 text-sm text-vt-rose-ink" role="alert">{{ loadError }}</p>
        <button
          v-if="hasMore"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full mb-3"
          :disabled="loadingMore"
          @click="emit('loadMore')"
        >
          Показать ещё
        </button>
        <NuxtLink v-if="canCreate" :to="newPath" class="vt-btn vt-btn--ink vt-btn--full vt-btn--lg">
          <VtIcon name="plus" :size="16" /> Новый сбор
        </NuxtLink>
      </template>
    </main>
  </div>
</template>
