<script setup lang="ts">
import { resolveStartParam } from '@volley-time/shared'
import { botLink } from '../../utils/auth-flow'
import { enterMiniApp } from '../../utils/mini-auth-state'
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
const entering = ref(false)
const runtimeConfig = useRuntimeConfig()
const telegramUrl = computed(() => botLink(runtimeConfig.public.telegramBotUsername))

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

async function enter() {
  if (entering.value) return
  entering.value = true
  status.value = 'loading'
  errorText.value = ''
  init()
  try {
    const result = await enterMiniApp({
      isTelegram: isTelegram.value,
      authenticate,
      fetchSession: async () => {
        await fetchSession()
        return Boolean(user.value)
      },
      targetRoute,
    })
    if (result.kind === 'navigate') {
      await navigateTo(result.to, { replace: true })
    } else {
      status.value = 'error'
      errorText.value =
        result.kind === 'telegram_error'
          ? 'Не удалось подтвердить вход через Telegram. Откройте приложение из чата с ботом и попробуйте снова.'
          : 'Не удалось проверить вход. Попробуйте ещё раз.'
    }
  } finally {
    entering.value = false
  }
}
onMounted(enter)
</script>

<template>
  <main class="flex items-center justify-center min-h-screen px-5">
    <div v-if="status === 'loading'" class="text-center" role="status">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-vt-flame mx-auto mb-3" />
      <p class="text-vt-mute-2 text-sm">Открываем Volley Time…</p>
    </div>
    <div v-else class="w-full max-w-sm text-center space-y-4">
      <ErrorState :message="errorText" retry-label="Повторить проверку" @retry="enter" />
      <a
        v-if="telegramUrl && isTelegram"
        :href="telegramUrl"
        rel="noopener"
        class="vt-btn vt-btn--ghost vt-btn--full"
        >Открыть бота в Telegram</a
      >
    </div>
  </main>
</template>
