<script setup lang="ts">
import OwnershipTransferAccept from '~/components/OwnershipTransferAccept.vue'
import { readTransferToken } from '~/utils/group-danger'

/**
 * Mini App: принятие передачи владения (21.2.17). Токен из `startapp=transfer_<token>` сохраняет
 * стартовый роутер `/m` на время сессии; в адрес страницы он не попадает.
 */
definePageMeta({ layout: 'miniapp' })

const token = ref<string | null>(null)
const ready = ref(false)
onMounted(() => {
  token.value = readTransferToken()
  ready.value = true
})
</script>

<template>
  <main class="px-4 py-6 space-y-4">
    <OwnershipTransferAccept v-if="ready" :token="token" org-base="/m/orgs" />
  </main>
</template>
