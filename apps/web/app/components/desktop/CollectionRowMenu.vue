<script setup lang="ts">
import {
  collectionMenuItems,
  type CollectionAction,
  type DesktopCollection,
} from '~/utils/desktop-collections'

/**
 * Меню строки сбора ⋯ (W-08, 21.2.23): «Изменить», «Опубликовать» (черновик), «Завершить сбор»,
 * «Отменить сбор». Пункты зависят от статуса; у закрытого сбора меню нет. Действия выполняет
 * страница, меню только сообщает о выборе.
 */
const props = withDefaults(
  defineProps<{ collection: DesktopCollection; busy?: boolean; writable?: boolean }>(),
  { writable: true },
)
const emit = defineEmits<{ action: [action: CollectionAction] }>()

const open = ref(false)
const items = computed(() => collectionMenuItems(props.collection.status, props.writable))
</script>

<template>
  <div v-if="items.length > 0" @click.stop>
    <VtPopover
      v-model="open"
      align="right"
      :label="`Действия: ${collection.title}`"
      :items="items"
      @select="(item) => emit('action', item.key as CollectionAction)"
    >
      <template #trigger="{ toggle, attrs }">
        <button
          type="button"
          v-bind="attrs"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :aria-label="`Действия со сбором «${collection.title}»`"
          :disabled="busy"
          @click="toggle"
        >
          <VtIcon name="more" :size="16" />
        </button>
      </template>
    </VtPopover>
  </div>
</template>
