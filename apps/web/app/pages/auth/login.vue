<script setup lang="ts">
import { type AuthOrg, type OrganizerEntry } from '../../utils/auth-destination'
import {
  botLink,
  completeEmailSignIn,
  continueEmailSignIn,
  switchEmailAccount,
} from '../../utils/auth-flow'

useHead({ title: 'Вход — Volley Time' })
type Step = 'email' | 'code' | 'verifying' | 'choose' | 'no_access' | 'blocked' | 'load_error'
const email = ref('')
const code = ref('')
const step = ref<Step>('email')
const error = ref('')
const submitting = ref(false)
const resendIn = ref(0)
const entry = ref<OrganizerEntry>({ kind: 'none' })
const heading = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const { fetchSession, user, logout } = useAuth()
const { orgs, fetchAll } = useOrganizations()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const telegramUrl = computed(() => botLink(runtimeConfig.public.telegramBotUsername))

watch(step, async () => {
  await nextTick()
  heading.value?.focus()
})
watch(code, () => {
  if (step.value === 'code') error.value = ''
})

function startResendTimer() {
  resendIn.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    resendIn.value = Math.max(0, resendIn.value - 1)
    if (resendIn.value === 0) clearInterval(timer)
  }, 1000)
}
onUnmounted(() => clearInterval(timer))
const resendLabel = computed(() => `0:${String(resendIn.value).padStart(2, '0')}`)

async function sendCode() {
  if (submitting.value || !email.value) return
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
  if (submitting.value) return
  step.value = 'email'
  code.value = ''
  error.value = ''
}

async function onVerify() {
  if (submitting.value || !/^\d{6}$/.test(code.value)) return
  submitting.value = true
  step.value = 'verifying'
  error.value = ''
  try {
    const result = await completeEmailSignIn({
      verify: async () => {
        await $fetch('/api/auth/sign-in/email-otp', {
          method: 'POST',
          body: { email: email.value, otp: code.value },
        })
      },
      session: activeSession,
      fetchOrgs: organizerOrgs,
      redirect: route.query.redirect,
    })
    await showSignInResult(result)
  } finally {
    submitting.value = false
  }
}

async function activeSession(): Promise<boolean> {
  await fetchSession()
  return Boolean(user.value)
}

async function organizerOrgs() {
  await fetchAll()
  return orgs.value
}

async function showSignInResult(result: Awaited<ReturnType<typeof completeEmailSignIn>>) {
  if (result.kind === 'navigate') await navigateTo(result.to)
  else if (result.kind === 'invalid_code') {
    step.value = 'code'
    error.value = 'Неверный или просроченный код. Попробуйте снова или запросите новый.'
  } else if (result.kind === 'load_error') step.value = 'load_error'
  else {
    entry.value = result
    step.value = result.kind === 'none' ? 'no_access' : result.kind
  }
}

async function retryOrganizations() {
  if (submitting.value) return
  submitting.value = true
  step.value = 'verifying'
  try {
    await showSignInResult(
      await continueEmailSignIn({
        session: activeSession,
        fetchOrgs: organizerOrgs,
        redirect: route.query.redirect,
      }),
    )
  } catch {
    step.value = 'load_error'
  } finally {
    submitting.value = false
  }
}

async function changeAccount() {
  if (submitting.value) return
  submitting.value = true
  try {
    await switchEmailAccount({ step, emailStep: 'email', email, code, error, signOut: logout })
    if (step.value === 'email') entry.value = { kind: 'none' }
  } finally {
    submitting.value = false
  }
}

async function chooseOrganization(org: AuthOrg) {
  if (org.status === 'suspended') {
    entry.value = { kind: 'blocked', org }
    step.value = 'blocked'
  } else {
    await navigateTo(`/m/orgs/${org.id}`)
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-5 py-10" :aria-busy="submitting">
    <div class="w-full max-w-md vt-card vt-card--raised p-6 sm:p-8">
      <div class="flex items-center gap-2 mb-7">
        <img src="/logo.png" alt="" width="32" height="32" />
        <span class="font-display font-bold tracking-tight">Volley Time</span>
      </div>
      <form v-if="step === 'email'" class="space-y-3" @submit.prevent="sendCode">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Вход</h1>
        <p class="text-sm text-vt-mute-2">Получите код на email вашего аккаунта.</p>
        <label for="email" class="vt-label">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="vt-field"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'auth-error' : undefined"
        />
        <button
          type="submit"
          :disabled="submitting"
          class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full"
        >
          {{ submitting ? 'Отправляем…' : 'Получить код' }}
        </button>
      </form>
      <form v-else-if="step === 'code'" class="space-y-3" @submit.prevent="onVerify">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="submitting"
          @click="changeEmail"
        >
          <VtIcon name="chevron-l" :size="13" /> Изменить email
        </button>
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Введите код</h1>
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
          class="vt-field vt-code text-center text-xl tracking-[0.5em]"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'auth-error' : undefined"
        />
        <button
          type="submit"
          :disabled="submitting"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
        >
          Войти
        </button>
        <div class="flex items-center justify-between text-sm pt-1">
          <span class="text-vt-mute-2">Не пришёл код?</span>
          <span v-if="resendIn > 0" class="vt-mono text-vt-mute-2"
            >Повтор через {{ resendLabel }}</span
          >
          <button
            v-else
            type="button"
            class="font-semibold text-vt-link"
            :disabled="submitting"
            @click="sendCode"
          >
            Отправить повторно
          </button>
        </div>
      </form>
      <section v-else-if="step === 'verifying'" role="status" class="space-y-3">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Проверяем вход</h1>
        <p class="text-vt-mute-2">Проверяем код и доступные организации…</p>
      </section>
      <section v-else-if="step === 'choose' && entry.kind === 'choose'" class="space-y-4">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Выберите организацию</h1>
        <p class="text-vt-mute-2">В какой организации хотите продолжить?</p>
        <ul class="space-y-2">
          <li v-for="org in entry.orgs" :key="org.id">
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--full vt-btn--lg justify-between"
              @click="chooseOrganization(org)"
            >
              <span>{{ org.name }}</span
              ><span v-if="org.status === 'suspended'">Приостановлена</span>
            </button>
          </li>
        </ul>
      </section>
      <section v-else-if="step === 'blocked' && entry.kind === 'blocked'" class="space-y-4">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Доступ приостановлен</h1>
        <p class="text-vt-mute-2">
          Организация «{{ entry.org.name }}» приостановлена. Сейчас открыть её нельзя.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          :disabled="submitting"
          @click="retryOrganizations"
        >
          Выбрать другую организацию
        </button>
      </section>
      <section v-else-if="step === 'no_access'" class="space-y-4">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">Нет доступа организатора</h1>
        <p class="text-vt-mute-2">
          Для этого аккаунта нет доступных организаций с ролью владельца или организатора.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          :disabled="submitting"
          @click="changeAccount"
        >
          Сменить аккаунт
        </button>
      </section>
      <section v-else-if="step === 'load_error'" class="space-y-4">
        <h1 ref="heading" tabindex="-1" class="text-2xl font-semibold">
          Не удалось загрузить организации
        </h1>
        <p role="alert" class="text-vt-rose-ink">
          Проверьте соединение и попробуйте снова. Повторный код не нужен.
        </p>
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--full"
          :disabled="submitting"
          @click="retryOrganizations"
        >
          Повторить загрузку
        </button>
      </section>
      <p v-if="error" id="auth-error" class="mt-4 text-sm text-vt-rose-ink" role="alert">
        {{ error }}
      </p>
      <a
        v-if="telegramUrl"
        :href="telegramUrl"
        rel="noopener"
        class="vt-btn vt-btn--ghost vt-btn--full mt-6"
        >Открыть бота в Telegram</a
      >
    </div>
  </main>
</template>
