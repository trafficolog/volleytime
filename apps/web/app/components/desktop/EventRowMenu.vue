<script setup lang="ts">
import type { EventListItem } from '~/components/EventCard.vue'
import { rowMenuItems, type ChatLinkState, type RowAction } from '~/utils/event-row'

/**
 * Меню строки списка событий ⋯ (W-03, 20.5.8): «Открыть событие», «Дублировать», «В чат группы»,
 * разделитель, «Отменить событие». Поповер выравнивается вправо; клик по кнопке и меню не открывает
 * карточку. Выполняет действия страница, меню только сообщает о выборе.
 */
const props = defineProps<{
  event: EventListItem
  chat: ChatLinkState
  busy?: boolean
}>()
const emit = defineEmits<{ action: [action: RowAction] }>()

const open = ref(false)
// «сейчас» берём при открытии меню: событие могло начаться, пока страница была открыта
const openedAt = ref(new Date())
watch(open, (isOpen) => {
  if (isOpen) openedAt.value = new Date()
})
const items = computed(() => rowMenuItems(props.event, props.chat, openedAt.value))
</script>

<template>
  <div class="vt-desktop-table__menu" @click.stop>
    <VtPopover
      v-model="open"
      fixed
      align="right"
      :label="`Действия: ${event.title}`"
      :items="items"
      @select="(item) => emit('action', item.key as RowAction)"
    >
      <template #trigger="{ toggle, attrs }">
        <button
          type="button"
          v-bind="attrs"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :aria-label="`Действия с событием «${event.title}»`"
          :disabled="busy"
          @click="toggle"
        >
          <VtIcon name="more" :size="16" />
        </button>
      </template>
    </VtPopover>
  </div>
</template>
