<script setup lang="ts">
import { computed, useSlots } from 'vue'

import type { VisibleHomeBlock } from '~/utils/home-blocks'

/**
 * Блок «Сегодня» главной игрока (23.2.1): общий каркас для блоков, подключаемых по флагам.
 * Контракт — `~/utils/home-blocks`. Содержимое и заголовок блока приходят в слот с именем блока;
 * блок без слота не рисуется, поэтому пустых заголовков не бывает: «Сегодня» показывается, только
 * когда есть хотя бы один блок.
 */
const props = defineProps<{ blocks: readonly VisibleHomeBlock[] }>()
const slots = useSlots()
const rendered = computed(() => props.blocks.filter((block) => !!slots[block.id]))
</script>

<template>
  <section v-if="rendered.length" aria-labelledby="home-today-title" data-testid="home-today">
    <h2 id="home-today-title" class="vt-cap mb-2 px-1 text-vt-mute-2">Сегодня</h2>
    <div class="space-y-3">
      <section
        v-for="block in rendered"
        :key="block.id"
        :data-home-block="block.id"
        class="vt-card p-4"
      >
        <slot :name="block.id" :block="block" />
      </section>
    </div>
  </section>
</template>
