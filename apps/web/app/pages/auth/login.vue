<script setup lang="ts">
import { type AuthOrg, type OrganizerEntry } from '../../utils/auth-destination'
import {
  botLink,
  completeEmailSignIn,
  continueEmailSignIn,
  formatOtpResendCountdown,
  switchEmailAccount,
} from '../../utils/auth-flow'
import { TELEGRAM_WIDGET_ENDPOINT, signInWithTelegramWidget } from '../../utils/telegram-widget'

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
// Кнопка Telegram показывается только если сервер сообщил, что флаг включён (D-05)
const widgetBot = ref<string | null>(null)
const widgetReady = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const { fetchSession, user, logout } = useAuth()
const { orgs, fetchAll } = useOrganizations()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const telegramUrl = computed(() => botLink(runtimeConfig.public.telegramBotUsername))

onMounted(async () => {
  try {
    const options = await $fetch<{ telegramWidget: { botUsername: string } | null }>(
      '/api/auth/login-options',
    )
    widgetBot.value = options?.telegramWidget?.botUsername ?? null
  } catch {
    widgetBot.value = null
  }
})

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
const resendLabel = computed(() => formatOtpResendCountdown(resendIn.value))

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

async function onTelegramAuth(widgetUser: Record<string, unknown>) {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    const result = await signInWithTelegramWidget(widgetUser, (body) =>
      $fetch<unknown>(TELEGRAM_WIDGET_ENDPOINT, { method: 'POST', body }),
    )
    if (result.kind === 'error') {
      error.value = 'Не удалось войти через Telegram. Попробуйте ещё раз или получите код на email.'
      return
    }
    step.value = 'verifying'
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
  <div class="auth">
    <main class="auth__main" :aria-busy="submitting">
      <div class="auth__column">
        <div class="auth__brand">
          <img src="/logo/vt-mark-color.svg" alt="" width="32" height="32" />
          <span class="auth__wordmark">Volley<span class="auth__wordmark-accent">Time</span></span>
        </div>

        <form v-if="step === 'email'" class="auth__step" @submit.prevent="sendCode">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Кабинет организатора</h1>
            <p class="auth__sub">Получите код на email вашего аккаунта.</p>
          </div>
          <div v-if="error" id="auth-error" class="auth__banner auth__banner--rose" role="alert">
            <VtIcon name="close" :size="17" class="auth__banner-icon" />
            <span class="auth__banner-title">{{ error }}</span>
          </div>
          <template v-if="widgetBot">
            <TelegramLoginButton
              v-show="widgetReady"
              :bot-username="widgetBot"
              @auth="onTelegramAuth"
              @ready="widgetReady = true"
            />
            <div v-if="widgetReady" class="auth__divider" aria-hidden="true">
              <span class="auth__rule" /><span class="auth__or">или</span
              ><span class="auth__rule" />
            </div>
          </template>
          <div>
            <label for="email" class="vt-label">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="ivan@example.com"
              class="vt-field"
              :aria-invalid="Boolean(error)"
              :aria-describedby="error ? 'auth-error' : undefined"
            />
          </div>
          <button
            type="submit"
            :disabled="submitting"
            class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full"
          >
            {{ submitting ? 'Отправляем…' : 'Получить код' }}
          </button>
          <p v-if="telegramUrl" class="auth__hint">
            Нет организации? Создайте её в
            <a :href="telegramUrl" rel="noopener" class="auth__link">боте в Telegram</a> — займёт
            минуту.
          </p>
        </form>

        <form v-else-if="step === 'code'" class="auth__step" @submit.prevent="onVerify">
          <div>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="submitting"
              @click="changeEmail"
            >
              <VtIcon name="chevron-l" :size="13" /> Изменить email
            </button>
          </div>
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Введите код</h1>
            <p v-if="!error" class="auth__sub">
              Отправили 6 цифр на <b class="auth__strong">{{ email }}</b
              >. Код действует 5 минут.
            </p>
          </div>
          <div v-if="error" id="auth-error" class="auth__banner auth__banner--rose" role="alert">
            <VtIcon name="close" :size="17" class="auth__banner-icon" />
            <span class="auth__banner-title">{{ error }}</span>
          </div>
          <div>
            <label for="otp" class="vt-label">Код из письма</label>
            <input
              id="otp"
              v-model="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              class="vt-field vt-code auth__otp"
              :class="{ 'auth__otp--error': error }"
              :aria-invalid="Boolean(error)"
              :aria-describedby="error ? 'auth-error' : undefined"
            />
          </div>
          <button
            type="submit"
            :disabled="submitting"
            class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
          >
            Войти
          </button>
          <div class="auth__resend">
            <span class="auth__muted">Не пришёл код?</span>
            <span v-if="resendIn > 0" class="vt-mono auth__muted"
              >Повтор через {{ resendLabel }}</span
            >
            <button
              v-else
              type="button"
              class="auth__link auth__link--button"
              :disabled="submitting"
              @click="sendCode"
            >
              Отправить повторно
            </button>
          </div>
        </form>

        <section v-else-if="step === 'verifying'" role="status" class="auth__step">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Проверяем вход</h1>
            <p class="auth__sub">Секунду — подтягиваем ваши организации.</p>
          </div>
          <div class="vt-card vt-card--raised auth__loading">
            <span class="auth__spinner" aria-hidden="true" />
            <span class="auth__loading-text">Авторизация…</span>
          </div>
        </section>

        <section v-else-if="step === 'choose' && entry.kind === 'choose'" class="auth__step">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Выберите организацию</h1>
            <p class="auth__sub">Вы состоите в нескольких — можно переключаться в любой момент.</p>
          </div>
          <ul class="auth__orgs">
            <li v-for="org in entry.orgs" :key="org.id">
              <button
                type="button"
                class="vt-card vt-card--raised auth__org"
                @click="chooseOrganization(org)"
              >
                <span class="auth__org-name">{{ org.name }}</span>
                <span v-if="org.status === 'suspended'" class="auth__org-note">Приостановлена</span>
                <VtIcon name="chevron-r" :size="16" class="auth__org-chevron" />
              </button>
            </li>
          </ul>
        </section>

        <section v-else-if="step === 'blocked' && entry.kind === 'blocked'" class="auth__step">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Доступ приостановлен</h1>
          </div>
          <div class="auth__banner auth__banner--rose">
            <VtIcon name="logout" :size="17" class="auth__banner-icon" />
            <div>
              <div class="auth__banner-title">Организация приостановлена</div>
              <div class="auth__banner-body">
                «{{ entry.org.name }}» сейчас открыть нельзя. Выберите другую организацию.
              </div>
            </div>
          </div>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--full"
            :disabled="submitting"
            @click="retryOrganizations"
          >
            Выбрать другую организацию
          </button>
        </section>

        <section v-else-if="step === 'no_access'" class="auth__step">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">Нет доступа организатора</h1>
          </div>
          <div class="auth__banner auth__banner--amber">
            <VtIcon name="user" :size="17" class="auth__banner-icon" />
            <div>
              <div class="auth__banner-title">Это не аккаунт организатора</div>
              <div class="auth__banner-body">
                Для этого аккаунта нет доступных организаций с ролью владельца или организатора.
              </div>
            </div>
          </div>
          <a
            v-if="telegramUrl"
            :href="telegramUrl"
            rel="noopener"
            class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full"
          >
            <VtIcon name="tg" :size="17" /> Открыть бота в Telegram
          </a>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--full"
            :disabled="submitting"
            @click="changeAccount"
          >
            Сменить аккаунт
          </button>
        </section>

        <section v-else-if="step === 'load_error'" class="auth__step">
          <div class="auth__head">
            <h1 ref="heading" tabindex="-1" class="auth__title">
              Не удалось загрузить организации
            </h1>
          </div>
          <div class="auth__banner auth__banner--rose" role="alert">
            <VtIcon name="close" :size="17" class="auth__banner-icon" />
            <span class="auth__banner-title"
              >Проверьте соединение и попробуйте снова. Повторный код не нужен.</span
            >
          </div>
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
            :disabled="submitting"
            @click="retryOrganizations"
          >
            Повторить загрузку
          </button>
        </section>
      </div>
    </main>
    <footer class="auth__footer">
      <span>volleytime.by</span>
    </footer>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--vt-paper);
  color: var(--vt-ink);
}
.auth__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 28px;
}
.auth__column {
  width: 100%;
  max-width: 360px;
}
.auth__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 26px;
}
.auth__wordmark {
  font-family: var(--f-display);
  text-transform: uppercase;
  font-weight: 700;
  font-size: var(--fs-xl);
}
.auth__wordmark-accent {
  color: var(--vt-flame-ink);
}
.auth__step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.auth__head {
  margin-bottom: 6px;
}
.auth__title {
  font-family: var(--f-display);
  text-transform: uppercase;
  font-weight: 700;
  font-size: var(--fs-4xl);
  line-height: 1;
  overflow-wrap: anywhere;
}
/* Заголовок получает фокус программно при смене шага (скринридер читает новый шаг); он не интерактивен. */
.auth__title:focus {
  outline: none;
}
.auth__sub {
  font-size: var(--fs-sm);
  color: var(--vt-mute-2);
  margin-top: 8px;
  line-height: 1.45;
}
.auth__strong {
  color: var(--vt-ink);
  overflow-wrap: anywhere;
}
.auth__muted {
  color: var(--vt-mute-2);
}
.auth__hint {
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
  line-height: 1.45;
}
.auth__link {
  color: var(--vt-flame-ink);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.auth__link--button {
  background: none;
  border: 0;
  padding: 8px 0;
  min-height: 44px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}
.auth__link:focus-visible {
  outline: 2px solid var(--vt-flame);
  outline-offset: 2px;
  border-radius: 4px;
}
.auth__divider {
  display: flex;
  align-items: center;
  gap: 12px;
}
.auth__rule {
  flex: 1;
  height: 1px;
  background: var(--vt-bone-2);
}
.auth__or {
  font-size: var(--fs-2xs);
  color: var(--vt-mute-2);
  font-weight: 600;
}
.auth__banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--r-tile);
}
.auth__banner--rose {
  background: var(--vt-rose-soft);
  color: var(--vt-rose-ink);
}
.auth__banner--amber {
  background: var(--vt-amber-soft);
  color: var(--vt-amber-ink);
}
.auth__banner-icon {
  flex: none;
  margin-top: 1px;
}
.auth__banner-title {
  font-size: var(--fs-base);
  font-weight: 700;
}
.auth__banner-body {
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
  margin-top: 4px;
  line-height: 1.4;
}
.auth__otp {
  text-align: center;
  font-size: var(--fs-2xl);
  font-weight: 700;
  letter-spacing: 0.5em;
  padding-left: calc(12px + 0.5em);
}
.auth__otp--error {
  background: var(--vt-rose-soft);
  color: var(--vt-rose-ink);
}
.auth__resend {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--fs-xs);
}
.auth__loading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
}
.auth__loading-text {
  font-size: var(--fs-sm);
  font-weight: 500;
}
.auth__spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--vt-flame);
  border-top-color: transparent;
  animation: auth-spin 0.7s linear infinite;
}
@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth__spinner {
    animation: none;
    border-top-color: var(--vt-flame);
  }
}
.auth__orgs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.auth__org {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
}
.auth__org-name {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-base);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.auth__org-note {
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
}
.auth__org-chevron {
  color: var(--vt-icon-idle);
  flex: none;
}
.auth__footer {
  padding: 14px 28px;
  background: var(--vt-bone);
  font-size: var(--fs-xs);
  color: var(--vt-mute-2);
}
</style>
