<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { apiErrorMessage } from '~/utils/api-error'

/**
 * Telegram-бот группы (W-11, 21.2.15): состояние привязки чата, invite-ссылка с копированием,
 * тест-сообщение и переподключение. Всё берётся из API кабинета (`telegram-chat`, `invites`); токена
 * бота и Telegram id чата на клиенте нет. Число участников чата не показывается: у бота нет
 * контракта для него (см. карточку 21.2.15).
 */
interface ChatStatus {
  link: {
    status: 'active' | 'invalid'
    title: string
    invalidReason: 'no_rights' | 'migrated' | null
  } | null
  pendingCode: { expiresAt: string } | null
  released: { reason: 'organizer' | 'bot_removed' } | null
}
interface InviteRow {
  isRevoked: boolean
  expiresAt: string | null
  maxUses: number | null
  usesCount: number
  roleToAssign: string
  deeplinkUrl: string
}

const props = defineProps<{ orgId: number; botUsername: string; base: string }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const botLink = props.botUsername ? `https://t.me/${props.botUsername}` : ''
const api = `/api/organizations/${props.orgId}`

const status = ref<ChatStatus | null>(null)
const loading = ref(true)
const loadError = ref('')
const inviteUrl = ref('')
const busy = ref<'test' | 'reconnect' | 'code' | null>(null)
const actionError = ref('')
const confirmReconnect = ref(false)
const linkCommand = ref('')

const INVALID_TEXT: Record<string, string> = {
  no_rights: 'У бота нет права писать в чат. Верните право или переподключите чат.',
  migrated: 'Чат перенесён в супергруппу. Переподключите чат.',
}
const RELEASED_TEXT: Record<string, string> = {
  bot_removed: 'Бота исключили из чата. Подключите чат заново.',
  organizer: 'Чат отвязан.',
}

/** Статус только из ответа API: недоступный чат — ошибка, а не «подключён». */
const indicator = computed<{ tone: 'ok' | 'danger' | 'idle'; label: string; detail: string }>(
  () => {
    const s = status.value
    if (s?.link?.status === 'active')
      return { tone: 'ok', label: 'Подключён', detail: `Чат «${s.link.title}»` }
    if (s?.link)
      return {
        tone: 'danger',
        label: 'Недоступен',
        detail: `Чат «${s.link.title}». ${INVALID_TEXT[s.link.invalidReason ?? ''] ?? ''}`.trim(),
      }
    if (s?.released)
      return { tone: 'danger', label: 'Не подключён', detail: RELEASED_TEXT[s.released.reason]! }
    return { tone: 'idle', label: 'Не подключён', detail: 'Чат группы ещё не привязан.' }
  },
)

async function loadInvite() {
  try {
    const { invites } = await $fetch<{ invites: InviteRow[] }>(`${api}/invites`)
    const now = Date.now()
    const live = invites.find(
      (i) =>
        !i.isRevoked &&
        (!i.expiresAt || new Date(i.expiresAt).getTime() > now) &&
        (i.maxUses === null || i.usesCount < i.maxUses) &&
        i.roleToAssign === 'player',
    )
    inviteUrl.value = live?.deeplinkUrl ?? ''
  } catch {
    inviteUrl.value = '' // ссылка вспомогательна: нет доступа или сбой — без неё
  }
}

async function loadStatus() {
  status.value = await $fetch<ChatStatus>(`${api}/telegram-chat`)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([loadStatus(), loadInvite()])
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить состояние бота')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    emit('toast', 'Ссылка скопирована', 'ok')
  } catch {
    emit('toast', 'Не удалось скопировать ссылку', 'danger')
  }
}

async function sendTest() {
  if (busy.value) return
  busy.value = 'test'
  actionError.value = ''
  try {
    await $fetch(`${api}/telegram-chat/test-message`, { method: 'POST', body: {} })
    emit('toast', 'Тестовое сообщение отправлено в чат', 'ok')
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не удалось отправить тестовое сообщение')
    // сбой доставки мог пометить чат недействительным
    await loadStatus().catch(() => undefined)
  } finally {
    busy.value = null
  }
}

/** Выдать одноразовый код: чат привязывает администратор командой `/link <код>`. */
async function issueCode() {
  const r = await $fetch<{ command: string }>(`${api}/telegram-chat/link-code`, {
    method: 'POST',
    body: {},
  })
  linkCommand.value = r.command
}

async function connect() {
  if (busy.value) return
  busy.value = 'code'
  actionError.value = ''
  try {
    await issueCode()
    await loadStatus()
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не удалось выдать код привязки')
  } finally {
    busy.value = null
  }
}

/** Переподключение: отвязать текущий чат группы и выдать новый код; второго чата не появится. */
async function reconnect() {
  if (busy.value) return
  busy.value = 'reconnect'
  actionError.value = ''
  confirmReconnect.value = false
  try {
    await $fetch(`${api}/telegram-chat`, { method: 'DELETE' })
    await issueCode()
    await loadStatus()
    emit('toast', 'Чат отвязан. Отправьте команду в чате группы', 'ok')
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не удалось переподключить чат')
    await loadStatus().catch(() => undefined)
  } finally {
    busy.value = null
  }
}

async function refresh() {
  actionError.value = ''
  try {
    await loadStatus()
    if (status.value?.link) linkCommand.value = ''
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не удалось обновить состояние')
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card">
    <h2 class="vt-settings-card__title">Telegram-бот</h2>
    <p class="vt-settings-hint">
      Через бота игроки открывают Mini App группы, а группа отправляет уведомления о записи и
      оплате.
    </p>

    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем состояние бота…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <template v-else>
      <dl class="vt-settings-facts">
        <dt>Бот</dt>
        <dd v-if="botUsername">
          <a :href="botLink" class="vt-settings-link" target="_blank" rel="noopener noreferrer">
            @{{ botUsername }}
          </a>
        </dd>
        <dd v-else>Имя бота не настроено на сервере</dd>
        <dt>Статус</dt>
        <dd data-testid="bot-status" :data-tone="indicator.tone">
          <strong class="vt-settings-status" :class="`vt-settings-status--${indicator.tone}`">{{
            indicator.label
          }}</strong>
          {{ indicator.detail }}
        </dd>
        <dt v-if="botLink">Mini App</dt>
        <dd v-if="botLink">
          <a :href="botLink" class="vt-settings-link" target="_blank" rel="noopener noreferrer">{{
            botLink
          }}</a>
        </dd>
        <dt>Приглашение</dt>
        <dd v-if="inviteUrl" class="vt-settings-invite">
          <input
            class="vt-input"
            readonly
            aria-label="Ссылка-приглашение в группу"
            :value="inviteUrl"
          />
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="copyInvite">
            Копировать
          </button>
        </dd>
        <dd v-else>
          Действующей ссылки нет. Создайте её на странице
          <NuxtLink :to="`${base}/invite`" class="vt-settings-link">«Приглашения»</NuxtLink>.
        </dd>
      </dl>

      <div v-if="linkCommand && !status?.link" class="vt-settings-note" role="status">
        Добавьте бота в чат группы, сделайте его администратором и отправьте в чате команду
        <code>{{ linkCommand }}</code> (действует 15 минут). Затем нажмите «Обновить».
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="refresh">
          Обновить
        </button>
      </div>

      <p v-if="actionError" role="alert" class="vt-settings-error vt-settings-error--form">
        {{ actionError }}
      </p>

      <div class="vt-settings-actions vt-settings-actions--start">
        <button
          v-if="status?.link"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="busy !== null || status.link.status !== 'active'"
          @click="sendTest"
        >
          {{ busy === 'test' ? 'Отправляем…' : 'Тест-сообщение' }}
        </button>
        <button
          v-if="status?.link && !confirmReconnect"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="busy !== null"
          @click="confirmReconnect = true"
        >
          Переподключить
        </button>
        <button
          v-else-if="!status?.link"
          type="button"
          class="vt-btn vt-btn--primary vt-btn--sm"
          :disabled="busy !== null"
          @click="connect"
        >
          Подключить чат
        </button>
        <NuxtLink :to="`${base}/invite`" class="vt-btn vt-btn--ghost vt-btn--sm">
          Открыть приглашения
        </NuxtLink>
      </div>

      <div
        v-if="confirmReconnect"
        class="vt-settings-note"
        role="alertdialog"
        aria-label="Переподключение"
      >
        Текущий чат будет отвязан, а уведомления в чат остановятся, пока вы не привяжете чат новым
        кодом. Продолжить?
        <div class="vt-settings-actions vt-settings-actions--start">
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--sm"
            :disabled="busy !== null"
            @click="reconnect"
          >
            Да, переподключить
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            @click="confirmReconnect = false"
          >
            Отмена
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
