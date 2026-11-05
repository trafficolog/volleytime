<script setup lang="ts">
import { pledgePlayerName, type DesktopPledge } from '~/utils/desktop-collections'
import { PAYMENT_METHOD_LABELS, formatMoneyRu } from '~/utils/labels'

/**
 * Панель «Обещания» (W-08, 21.2.23): ожидающие взносы игроков с кнопками «Подтвердить» и
 * «Отклонить». Решение принимает страница; пока решение по взносу в работе, его кнопки отключены.
 */
defineProps<{
  pledges: readonly DesktopPledge[]
  /** Взносы, по которым решение уже отправлено. */
  busyIds: ReadonlySet<number>
  /** Решения недоступны (группа не загрузилась): панель только показывает обещания. */
  readonly?: boolean
  /** Показаны не все сборы с обещаниями. */
  partial?: boolean
}>()
const emit = defineEmits<{ confirm: [pledge: DesktopPledge]; reject: [pledge: DesktopPledge] }>()
</script>

<template>
  <section class="vt-card vt-desktop-pledges" aria-labelledby="collection-pledges-title">
    <h2 id="collection-pledges-title" class="vt-desktop-pledges__title">
      Обещания
      <span v-if="pledges.length > 0" class="text-vt-amber-ink text-sm" data-testid="pledges-count"
        >{{ pledges.length }} ждут</span
      >
    </h2>
    <p class="text-vt-mute-2 text-xs">Подтверждённые деньги попадут в кассу.</p>
    <p v-if="readonly" class="text-vt-mute-2 text-xs" role="status">
      Решения по обещаниям сейчас недоступны.
    </p>
    <p v-if="pledges.length === 0" class="text-vt-mute-2 text-sm" role="status">
      Ожидающих обещаний нет
    </p>
    <ul v-else class="vt-desktop-pledges__list">
      <li v-for="p in pledges" :key="p.id" class="vt-desktop-pledges__row" data-testid="pledge-row">
        <VtAvatar :name="pledgePlayerName(p.user)" :src="p.user.image" size="sm" />
        <div class="vt-desktop-pledges__who">
          <strong class="text-sm">{{ pledgePlayerName(p.user) }}</strong>
          <small class="text-vt-mute-2 block">
            {{ p.collectionTitle }} · {{ PAYMENT_METHOD_LABELS[p.method] ?? p.method }}
          </small>
        </div>
        <span class="vt-mono text-sm font-bold">{{ formatMoneyRu(p.amount, p.currency) }}</span>
        <div v-if="!readonly" class="vt-desktop-pledges__actions">
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--sm"
            :disabled="busyIds.has(p.id)"
            :aria-label="`Подтвердить обещание: ${pledgePlayerName(p.user)}`"
            @click="emit('confirm', p)"
          >
            Подтвердить
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="busyIds.has(p.id)"
            :aria-label="`Отклонить обещание: ${pledgePlayerName(p.user)}`"
            @click="emit('reject', p)"
          >
            Отклонить
          </button>
        </div>
      </li>
    </ul>
    <p v-if="partial" class="text-vt-mute-2 text-xs" role="status">
      Показаны обещания по последним сборам.
    </p>
  </section>
</template>
