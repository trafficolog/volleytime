<script setup lang="ts">
useHead({ title: 'Вход — Volley Time' })

const RESEND_SECONDS = 60

const email = ref('')
const code = ref('')
const step = ref<'email' | 'code'>('email')
const error = ref('')
const submitting = ref(false)
const resendIn = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const { fetchSession } = useAuth()
const route = useRoute()
/** Куда вернуться после входа (8.8.8). */
const redirectTo = computed(() => {
  const r = String(route.query.redirect ?? '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/m/orgs'
})

function startResendTimer() {
  resendIn.value = RESEND_SECONDS
  clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value = Math.max(0, resendIn.value - 1)
    if (resendIn.value === 0) clearInterval(timer)
  }, 1000)
}
onUnmounted(() => clearInterval(timer))

const resendLabel = computed(() => {
  const m = Math.floor(resendIn.value / 60)
  const s = String(resendIn.value % 60).padStart(2, '0')
  return `${m}:${s}`
})

async function sendCode() {
  if (!email.value) return
  submitting.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      body: { email: email.value, type: 'sign-in' },
    })
    step.value = 'code'
    code.value = ''
    startResendTimer()
  } catch {
    error.value = 'Не удалось отправить код. Проверьте email и попробуйте снова.'
  } finally {
    submitting.value = false
  }
}

function changeEmail() {
  step.value = 'email'
  code.value = ''
  error.value = ''
}

async function onVerify() {
  if (code.value.length < 6) return
  submitting.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      body: { email: email.value, otp: code.value },
    })
    await fetchSession()
    await navigateTo(redirectTo.value)
  } catch {
    error.value = 'Неверный или просроченный код. Попробуйте снова или запросите новый.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-5 py-10">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2 mb-6">
        <img src="/logo.png" alt="" width="28" height="28" />
        <span class="font-display font-bold tracking-tight">Volley Time</span>
      </div>

      <form v-if="step === 'email'" class="space-y-3" @submit.prevent="sendCode">
        <h1 class="text-2xl font-semibold">Вход</h1>
        <p class="text-sm text-vt-mute-2 mb-2">
          Войдите тем же аккаунтом, которым пользуетесь в Telegram-боте.
        </p>
        <label for="email" class="vt-label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          placeholder="ivan@example.com"
          class="vt-field"
        />
        <button
          type="submit"
          :disabled="submitting || !email"
          class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full"
        >
          {{ submitting ? 'Отправляем…' : 'Получить код' }}
        </button>
      </form>

      <form v-else class="space-y-3" @submit.prevent="onVerify">
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="changeEmail">
          <VtIcon name="chevron-l" :size="13" /> Изменить email
        </button>
        <h1 class="text-2xl font-semibold">Введите код</h1>
        <p class="text-sm text-vt-mute-2">
          Отправили 6 цифр на <b class="text-vt-ink">{{ email }}</b
          >. Код действует 5 минут.
        </p>
        <label for="otp" class="vt-label">Код из письма</label>
        <input
          id="otp"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="[0-9]{6}"
          required
          placeholder="••••••"
          class="vt-field vt-mono text-center text-xl tracking-[0.5em]"
        />
        <button
          type="submit"
          :disabled="submitting || code.length < 6"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
        >
          {{ submitting ? 'Проверяем…' : 'Войти' }}
        </button>
        <div class="flex items-center justify-between text-xs pt-1">
          <span class="text-vt-mute-2">Не пришёл код?</span>
          <span v-if="resendIn > 0" class="vt-mono text-vt-mute-2"
            >Повтор через {{ resendLabel }}</span
          >
          <button
            v-else
            type="button"
            class="font-semibold text-vt-flame"
            :disabled="submitting"
            @click="sendCode"
          >
            Отправить повторно
          </button>
        </div>
      </form>

      <p v-if="error" class="mt-4 text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
    </div>
  </main>
</template>
