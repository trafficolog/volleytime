<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { groupLogoUrl } from '~/utils/group-logo'
import { groupMonogram } from '~/utils/group-monogram'

/**
 * Логотип группы или, если его нет (или он не загрузился), монограмма (M-04, 21.2.16).
 * Размер задаёт вызывающий классами `sizeClass` (по умолчанию 40 px).
 */
const props = withDefaults(
  defineProps<{
    orgId: number
    name: string
    logoUpdatedAt?: string | Date | null
    sizeClass?: string
  }>(),
  { logoUpdatedAt: null, sizeClass: 'h-10 w-10 text-base' },
)

const failed = ref(false)
const src = computed(() => groupLogoUrl(props.orgId, props.logoUpdatedAt))
watch(src, () => {
  failed.value = false
})
const monogram = computed(() => groupMonogram(props.name))
</script>

<template>
  <img
    v-if="src && !failed"
    data-logo
    :src="src"
    alt=""
    aria-hidden="true"
    class="shrink-0 rounded-xl bg-vt-bone object-cover"
    :class="sizeClass"
    @error="failed = true"
  />
  <span
    v-else
    data-monogram
    aria-hidden="true"
    class="font-display flex shrink-0 items-center justify-center rounded-xl font-bold"
    :class="[sizeClass, monogram.className]"
    >{{ monogram.initials }}</span
  >
</template>
