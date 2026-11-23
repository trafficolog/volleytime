<script setup lang="ts">
import type { PlatformGroupPageRow } from '@volley-time/shared'
import { computed, ref, watch } from 'vue'

import VtDialog from '~/components/vt/Dialog.vue'
import { apiErrorMessage, apiErrorStatus } from '~/utils/api-error'

/** «Вернуть» / «Вернуть индексацию» (24.1.3): подтверждение, решение root снимается без причины. */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{ page: PlatformGroupPageRow }>()
const emit = defineEmits<{ done: [page: PlatformGroupPageRow]; stale: [] }>()

const busy = ref(false)
const failure = ref('')
watch(open, (isOpen) => {
  if (isOpen) failure.value = ''
})

const hidden = computed(() => props.page.state === 'hidden')
const title = computed(() =>
  hidden.value ? `Вернуть «${props.page.name}»?` : `Вернуть индексацию «${props.page.name}»?`,
)
const sub = computed(() =>
  hidden.value
    ? 'Страница снова откроется по ссылке. В поиск она попадёт, если индексацию включил владелец. Организатор получит уведомление в бот.'
    : 'Индексация снова зависит от настройки владельца. Организатор получит уведомление в бот.',
)

async function confirm() {
  if (busy.value) return
  busy.value = true
  failure.value = ''
  try {
    const page = await $fetch<PlatformGroupPageRow>(
      `/api/platform/group-pages/${props.page.organizationId}/restore`,
      { method: 'POST' },
    )
    emit('done', page)
    open.value = false
  } catch (e) {
    failure.value = apiErrorMessage(e, 'Не удалось вернуть страницу. Попробуйте ещё раз')
    if (apiErrorStatus(e) === 409) emit('stale')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VtDialog v-model="open" :title="title" :sub="sub" :busy="busy">
    <p v-if="failure" class="vt-mod-error" role="alert">{{ failure }}</p>
    <template #footer>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        :disabled="busy"
        @click="open = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="vt-btn vt-btn--ink vt-btn--sm"
        data-testid="restore-confirm"
        :disabled="busy"
        @click="confirm"
      >
        Вернуть
      </button>
    </template>
  </VtDialog>
</template>
