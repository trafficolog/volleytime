<script setup lang="ts">
import OwnershipTransferAccept from '~/components/OwnershipTransferAccept.vue'
import { desktopSignInPath } from '~/utils/desktop-org-ui'
import { readTransferToken, stashTransferToken } from '~/utils/group-danger'

/**
 * Веб-страница принятия передачи владения (21.2.17): `/app/transfer#<token>`. Токен во фрагменте
 * не уходит на сервер с адресом; страница сразу убирает его из адреса и держит до конца сессии
 * вкладки, поэтому он не попадает ни в журнал доступа, ни в `redirect` страницы входа.
 */
useHead({ title: 'Передача владения — Volley Time' })

const { user, fetchSession } = useAuth()
const token = ref<string | null>(null)
const ready = ref(false)

onMounted(async () => {
  const fromHash = window.location.hash.replace(/^#/, '')
  if (fromHash) {
    stashTransferToken(fromHash)
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }
  if (user.value === null) await fetchSession()
  if (user.value === null) {
    await navigateTo(desktopSignInPath('/app/transfer'))
    return
  }
  token.value = readTransferToken()
  ready.value = true
})
</script>

<template>
  <main class="vt-desktop__entry space-y-6">
    <NuxtLink to="/" class="vt-desktop__brand !p-0">
      <img src="/logo/vt-mark-color.svg" alt="" width="32" height="32" /> Volley Time
    </NuxtLink>
    <OwnershipTransferAccept v-if="ready" :token="token" org-base="/app/orgs" />
    <p v-else role="status">Проверяем вход…</p>
  </main>
</template>
