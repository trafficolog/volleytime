<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import SettingsField from './SettingsField.vue'

import GroupLogo from '~/components/GroupLogo.vue'
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '~/utils/api-error'
import {
  LOGO_ACCEPT,
  LOGO_MAX_LABEL,
  SHORT_LINK_HINT,
  SHORT_LINK_PREFIX,
  validateLogoFile,
  validateShortLink,
} from '~/utils/group-logo'
import { settingsErrorMessage } from '~/utils/group-settings'

/**
 * Логотип и короткая ссылка группы (W-11 «Профиль», 21.2.16). Логотип: выбор файла, предпросмотр,
 * сохранение и удаление; адрес `volleytime.by/<имя>`: проверка формата в браузере, занятость и
 * зарезервированные слова проверяет сервер. Доступно владельцу и организатору. Публичную
 * страницу по адресу строит 24.1.2, пока адрес только сохраняется.
 */
const props = defineProps<{
  orgId: number
  name: string
  logoUpdatedAt: string | Date | null
  shortLink: string | null
  /** Логотип: владелец и организатор. */
  canManage: boolean
  /** Короткая ссылка: только владелец (решение владельца 2026-11-09). */
  canEditLink: boolean
}>()
const emit = defineEmits<{
  toast: [message: string, tone: 'ok' | 'danger']
  /** Свежие значения группы для шапки и боковой панели кабинета. */
  changed: [value: { logoUpdatedAt: string | null; shortLink: string | null }]
}>()

const base = computed(() => `/api/organizations/${props.orgId}`)
// свои коды (logo.*, short_link.*) объясняют причину; остальное — общие тексты настроек
const failure = (cause: unknown, fallback: string) =>
  /^(logo|short_link)\./.test(apiErrorCode(cause) ?? '')
    ? apiErrorMessage(cause, fallback)
    : settingsErrorMessage(apiErrorStatus(cause), apiErrorMessage(cause, fallback))

// ── логотип ──
const fileInput = ref<HTMLInputElement | null>(null)
const picked = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const logoError = ref('')
const logoBusy = ref(false)

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}
onBeforeUnmount(releasePreview)

function chooseFile() {
  if (props.canManage && !logoBusy.value) fileInput.value?.click()
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  logoError.value = ''
  if (!file) return
  const problem = validateLogoFile(file)
  if (problem) {
    cancelPick()
    logoError.value = problem
    return
  }
  releasePreview()
  picked.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function cancelPick() {
  picked.value = null
  releasePreview()
  logoError.value = ''
}

async function uploadLogo() {
  const file = picked.value
  if (!file || !props.canManage || logoBusy.value) return
  logoBusy.value = true
  logoError.value = ''
  try {
    const body = new FormData()
    body.set('file', file, file.name)
    const res = await $fetch<{ logoUpdatedAt: string }>(`${base.value}/logo`, {
      method: 'POST',
      body,
    })
    cancelPick()
    emit('changed', { logoUpdatedAt: res.logoUpdatedAt, shortLink: props.shortLink })
    emit('toast', 'Логотип сохранён', 'ok')
  } catch (cause) {
    logoError.value = failure(cause, 'Не удалось загрузить логотип')
  } finally {
    logoBusy.value = false
  }
}

async function removeLogo() {
  if (!props.logoUpdatedAt || !props.canManage || logoBusy.value) return
  logoBusy.value = true
  logoError.value = ''
  try {
    await $fetch(`${base.value}/logo`, { method: 'DELETE' })
    cancelPick()
    emit('changed', { logoUpdatedAt: null, shortLink: props.shortLink })
    emit('toast', 'Логотип удалён', 'ok')
  } catch (cause) {
    logoError.value = failure(cause, 'Не удалось удалить логотип')
  } finally {
    logoBusy.value = false
  }
}

// ── короткая ссылка ──
const linkDraft = ref(props.shortLink ?? '')
const linkError = ref('')
const linkBusy = ref(false)
const normalized = computed(() => linkDraft.value.trim().toLowerCase())

// Предпроверка адреса при вводе (debounce): формат — в браузере, занятость и зарезервированные
// слова — сервер. Подсказка: окончательно решает сохранение (409 при гонке).
type Availability = 'checking' | 'available' | 'taken' | 'reserved' | 'invalid'
const availability = ref<Availability | null>(null)
const CHECK_DELAY_MS = 400
let checkTimer: ReturnType<typeof setTimeout> | undefined
let checkSeq = 0
onBeforeUnmount(() => clearTimeout(checkTimer))

const AVAILABILITY_TEXT: Record<Availability, string> = {
  checking: 'Проверяем адрес…',
  available: 'Адрес свободен',
  taken: 'Этот адрес уже занят другой группой',
  reserved: 'Это слово занято приложением',
  invalid: 'Строчные латинские буквы, цифры и дефис; от 3 до 32 знаков',
}
const linkDirty = computed(() => normalized.value !== (props.shortLink ?? ''))
watch(normalized, (value) => {
  clearTimeout(checkTimer)
  const seq = ++checkSeq
  linkError.value = ''
  if (!props.canEditLink || value === (props.shortLink ?? '') || value === '') {
    availability.value = null
    return
  }
  if (validateShortLink(value)) {
    availability.value = 'invalid'
    return
  }
  availability.value = 'checking'
  checkTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ status: Exclude<Availability, 'checking'> }>(
        `${base.value}/short-link/availability`,
        { query: { value } },
      )
      if (seq === checkSeq) availability.value = res.status
    } catch {
      // подсказка недоступна: сохранение всё равно проверит адрес
      if (seq === checkSeq) availability.value = null
    }
  }, CHECK_DELAY_MS)
})
const linkBlocked = computed(
  () =>
    availability.value === 'taken' ||
    availability.value === 'reserved' ||
    availability.value === 'invalid',
)

watch(
  () => props.shortLink,
  (value) => {
    if (!linkDirty.value || !linkBusy.value) linkDraft.value = value ?? ''
  },
)

async function saveLink() {
  if (!props.canEditLink || linkBusy.value || !linkDirty.value) return
  linkError.value = ''
  const value = normalized.value === '' ? null : normalized.value
  if (value !== null) {
    const problem = validateShortLink(value)
    if (problem) {
      linkError.value = problem
      document.querySelector<HTMLElement>('[data-settings-field="shortLink"]')?.focus()
      return
    }
  }
  linkBusy.value = true
  try {
    const res = await $fetch<{ shortLink: string | null }>(`${base.value}/short-link`, {
      method: 'PUT',
      body: { shortLink: value },
    })
    linkDraft.value = res.shortLink ?? ''
    availability.value = null
    emit('changed', {
      logoUpdatedAt: props.logoUpdatedAt ? new Date(props.logoUpdatedAt).toISOString() : null,
      shortLink: res.shortLink,
    })
    emit('toast', res.shortLink ? 'Короткая ссылка сохранена' : 'Короткая ссылка снята', 'ok')
  } catch (cause) {
    linkError.value = failure(cause, 'Не удалось сохранить ссылку')
  } finally {
    linkBusy.value = false
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card" aria-labelledby="settings-logo-title">
    <h2 id="settings-logo-title" class="vt-settings-card__title">Логотип и короткая ссылка</h2>

    <div class="vt-logo-row">
      <img
        v-if="previewUrl"
        data-logo-preview
        :src="previewUrl"
        alt="Предпросмотр логотипа"
        class="vt-logo-row__image"
      />
      <GroupLogo
        v-else
        :org-id="orgId"
        :name="name"
        :logo-updated-at="logoUpdatedAt"
        size-class="h-16 w-16 text-xl"
      />
      <div class="vt-logo-row__body">
        <input
          ref="fileInput"
          type="file"
          class="sr-only"
          data-logo-input
          :accept="LOGO_ACCEPT"
          tabindex="-1"
          aria-label="Файл логотипа"
          @change="onPick"
        />
        <div v-if="canManage" class="vt-logo-row__actions">
          <template v-if="picked">
            <button
              type="button"
              class="vt-btn vt-btn--ink vt-btn--sm"
              data-logo-save
              :disabled="logoBusy"
              @click="uploadLogo"
            >
              {{ logoBusy ? 'Загружаем…' : 'Сохранить логотип' }}
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="logoBusy"
              @click="cancelPick"
            >
              Отмена
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              data-logo-choose
              :disabled="logoBusy"
              @click="chooseFile"
            >
              {{ logoUpdatedAt ? 'Заменить логотип' : 'Загрузить логотип' }}
            </button>
            <button
              v-if="logoUpdatedAt"
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              data-logo-remove
              :disabled="logoBusy"
              @click="removeLogo"
            >
              Удалить
            </button>
          </template>
        </div>
        <p class="vt-settings-hint">
          PNG или JPEG, до {{ LOGO_MAX_LABEL }}. Показывается в шапке и списке ваших групп в
          приложении; без логотипа — монограмма из названия.
        </p>
        <p v-if="logoError" class="vt-settings-error" role="alert" data-logo-error>
          {{ logoError }}
        </p>
      </div>
    </div>

    <form class="vt-settings-field-form" novalidate @submit.prevent="saveLink">
      <SettingsField
        v-slot="{ id, describedby, invalid }"
        label="Короткая ссылка"
        :hint="`${SHORT_LINK_HINT} Публичная страница по адресу появится позже; пока адрес только сохраняется.`"
        :error="linkError"
      >
        <div class="vt-short-link">
          <span class="vt-field vt-short-link__prefix" aria-hidden="true">
            {{ SHORT_LINK_PREFIX }}
          </span>
          <input
            :id="id"
            v-model="linkDraft"
            class="vt-field vt-short-link__input"
            data-settings-field="shortLink"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
            maxlength="32"
            placeholder="vt-minsk"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :readonly="!canEditLink"
            :disabled="linkBusy"
          />
        </div>
        <p
          v-if="availability"
          data-link-status
          :data-status="availability"
          class="vt-settings-hint"
          role="status"
          aria-live="polite"
        >
          {{ AVAILABILITY_TEXT[availability] }}
        </p>
      </SettingsField>
      <div v-if="canEditLink" class="vt-settings-actions">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="!linkDirty || linkBusy"
          @click="((linkDraft = shortLink ?? ''), (linkError = ''))"
        >
          Отмена
        </button>
        <button
          type="submit"
          class="vt-btn vt-btn--ink vt-btn--sm"
          data-link-save
          :disabled="!linkDirty || linkBusy || linkBlocked"
        >
          {{ linkBusy ? 'Сохраняем…' : 'Сохранить ссылку' }}
        </button>
      </div>
      <p v-else class="vt-settings-hint">Менять короткую ссылку может только владелец группы.</p>
    </form>
  </section>
</template>

<style scoped>
.vt-logo-row {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
}
.vt-logo-row__image {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 12px;
  object-fit: cover;
}
.vt-logo-row__body {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.vt-logo-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.vt-settings-field-form {
  margin-top: 18px;
}
.vt-short-link {
  display: flex;
}
.vt-short-link__prefix {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: auto;
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--vt-bone-2);
  color: var(--vt-mute-2);
  font-size: var(--fs-sm);
}
.vt-short-link__input {
  min-width: 0;
  flex: 1;
  border-radius: 0 10px 10px 0;
}
</style>
