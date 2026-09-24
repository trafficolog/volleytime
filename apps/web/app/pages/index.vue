<script setup lang="ts">
import { APP_NAME } from '@volley-time/shared'

const config = useRuntimeConfig()
const botUsername = computed(() => config.public.telegramBotUsername)
const botUrl = computed(() => (botUsername.value ? `https://t.me/${botUsername.value}` : ''))
useHead({ title: `${APP_NAME} — тренировки и учёт для волейбольных групп` })
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-5 py-10">
    <div class="w-full max-w-md">
      <div class="flex items-center gap-2 mb-8">
        <img src="/logo.png" alt="" width="36" height="36" />
        <span class="font-display font-bold text-xl tracking-tight">{{ APP_NAME }}</span>
      </div>
      <h1 class="text-3xl font-semibold mb-3">Запись на тренировки и касса группы — в Telegram</h1>
      <p class="text-vt-mute-2 mb-8">
        Игроки записываются и пользуются абонементами, организатор подтверждает оплаты и ведёт
        кассу. Без таблиц и чатов с перекличкой.
      </p>
      <div class="flex flex-col gap-2.5">
        <a
          v-if="botUrl"
          :href="botUrl"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          rel="noopener"
        >
          <VtIcon name="tg" :size="18" /> Открыть в Telegram
        </a>
        <NuxtLink to="/auth/login" class="vt-btn vt-btn--ghost vt-btn--lg vt-btn--full">
          <VtIcon name="mail" :size="18" /> Войти по email
        </NuxtLink>
      </div>
      <p v-if="botUsername" class="text-xs text-vt-mute-2 mt-6">
        Нет группы? Создайте её в боте <span class="vt-code text-vt-ink">@{{ botUsername }}</span> —
        займёт минуту.
      </p>
    </div>
  </main>
</template>
