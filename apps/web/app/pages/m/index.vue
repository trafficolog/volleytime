<script setup lang="ts">
import { resolveStartParam } from '@volley-time/shared'
definePageMeta({ layout: 'miniapp' })

/**
 * Стартовый роутер Mini App (Task 8.8.3 / 8.8.8):
 * Telegram-вход → start_param → последняя организация → список групп.
 * Вне Telegram без сессии → экран входа.
 */
const { isTelegram, init, authenticate, startParam } = useTelegram()
const { fetchSession, user } = useAuth()
const status = ref<'loading' | 'error'>('loading')
const errorText = ref('')

async function targetRoute(): Promise<string> {
  const target = resolveStartParam(startParam.value)
  if (target.kind === 'invite') return `/m/invite/${encodeURIComponent(target.token)}`
  if (target.kind === 'event') {
    try {
      const { orgId, eventId } = await $fetch<{ orgId: number; eventId: number }>(
        `/api/events/${target.eventId}/locate`,
      )
      return `/m/orgs/${orgId}/events/${eventId}`
    } catch {
      return '/m/orgs'
    }
  }
  const last = import.meta.client ? window.localStorage.getItem('vt.lastOrgId') : null
  return last && /^\d+$/.test(last) ? `/m/orgs/${last}` : '/m/orgs'
}

onMounted(async () => {
  init()
  try {
    if (isTelegram.value) {
      await authenticate()
    } else {
      await fetchSession()
      if (!user.value) {
        await navigateTo('/auth/login?redirect=/m/')
        return
      }
    }
    await navigateTo(await targetRoute(), { replace: true })
  } catch (e) {
    status.value = 'error'
    errorText.value = isTelegram.value
      ? 'Не удалось войти через Telegram. Перезапустите приложение из чата с ботом.'
      : 'Не удалось войти. Попробуйте ещё раз.'
    void e
  }
})
</script>

<template>
  <main class="flex items-center justify-center min-h-screen px-5">
    <div v-if="status === 'loading'" class="text-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-vt-flame mx-auto mb-3" />
      <p class="text-vt-mute-2 text-sm">Открываем Volley Time…</p>
    </div>
    <ErrorState
      v-else
      :message="errorText"
      retry-label="Войти по email"
      @retry="navigateTo('/auth/login?redirect=/m/')"
    />
  </main>
</template>
