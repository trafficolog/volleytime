<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import SettingsField from './SettingsField.vue'
import SettingsRow from './SettingsRow.vue'

import { apiErrorMessage, apiErrorStatus } from '~/utils/api-error'
import { settingsErrorMessage, type SettingsErrors } from '~/utils/group-settings'
import {
  PAYMENT_IMPACT,
  PAYMENT_METHOD_TITLES,
  REQUISITE_LIMIT,
  UNAVAILABLE_METHODS,
  UNAVAILABLE_NOTE,
  draftOf,
  methodSubtitle,
  requisitesPatch,
  validateRequisites,
  type PaymentMethodCode,
  type PaymentMethodView,
} from '~/utils/payment-methods'

/**
 * Способы оплаты группы (W-11, 21.2.11): включение «Наличными» и «Переводом», реквизиты перевода
 * (банк, последние 4 цифры, получатель). Выключение меняет только экран оплаты игрока: запись и
 * подтверждение платежей работают как прежде. Доступно владельцу и организатору.
 */
const props = defineProps<{ orgId: number; canManage: boolean }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const methods = ref<PaymentMethodView[]>([])
const loading = ref(true)
const loadError = ref('')
const pending = ref<PaymentMethodCode | null>(null)
const saving = ref(false)
const errors = ref<SettingsErrors>({})
const formError = ref('')
const draft = reactive({ bank: '', cardLast4: '', recipient: '' })

const base = computed(() => `/api/organizations/${props.orgId}/payment-methods`)
const cash = computed(() => methods.value.find((m) => m.method === 'cash'))
const transfer = computed(() => methods.value.find((m) => m.method === 'transfer'))
const patch = computed(() => requisitesPatch(transfer.value, draft))
const dirty = computed(() => Object.keys(patch.value).length > 0)
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)
const allOff = computed(() => methods.value.length > 0 && methods.value.every((m) => !m.enabled))
const locked = computed(() => !props.canManage || saving.value)

function resetDraft() {
  Object.assign(draft, draftOf(transfer.value))
  errors.value = {}
  formError.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ methods: PaymentMethodView[] }>(base.value)
    methods.value = data.methods
    resetDraft()
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить способы оплаты')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function replace(next: PaymentMethodView) {
  methods.value = methods.value.map((m) => (m.method === next.method ? next : m))
}

const failure = (cause: unknown, fallback: string) =>
  settingsErrorMessage(apiErrorStatus(cause), apiErrorMessage(cause, fallback))

async function toggle(code: PaymentMethodCode, enabled: boolean) {
  if (!props.canManage || pending.value) return
  pending.value = code
  try {
    const res = await $fetch<{ method: PaymentMethodView }>(`${base.value}/${code}`, {
      method: 'PATCH',
      body: { enabled },
    })
    replace(res.method)
    emit('toast', `${PAYMENT_METHOD_TITLES[code]} · ${enabled ? 'включён' : 'выключен'}`, 'ok')
  } catch (cause) {
    emit('toast', failure(cause, 'Не удалось сохранить способ оплаты'), 'danger')
  } finally {
    pending.value = null
  }
}

async function submit() {
  if (!props.canManage || saving.value || !dirty.value) return
  errors.value = validateRequisites(draft)
  formError.value = ''
  if (Object.keys(errors.value).length > 0) return
  saving.value = true
  try {
    const res = await $fetch<{ method: PaymentMethodView }>(`${base.value}/transfer`, {
      method: 'PATCH',
      body: patch.value,
    })
    replace(res.method)
    resetDraft()
    emit('toast', 'Реквизиты сохранены', 'ok')
  } catch (cause) {
    formError.value = failure(cause, 'Не удалось сохранить реквизиты')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card">
    <div class="vt-settings-card__head">
      <h2 class="vt-settings-card__title">Способы оплаты</h2>
    </div>
    <p class="vt-settings-hint">
      Игрок видит включённые способы и реквизиты, когда его запись ждёт оплаты. Подтверждает оплату
      организатор, как и раньше.
    </p>

    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем способы оплаты…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <template v-else-if="cash && transfer">
      <div class="vt-settings-stack">
        <SettingsRow
          :label="PAYMENT_METHOD_TITLES.cash"
          :hint="`${sentence(methodSubtitle(cash))} ${PAYMENT_IMPACT.enabled}`"
          :model-value="cash.enabled"
          :disabled="pending !== null"
          :readonly="!canManage"
          @update:model-value="toggle('cash', $event)"
        />
        <SettingsRow
          :label="PAYMENT_METHOD_TITLES.transfer"
          :hint="`${sentence(methodSubtitle(transfer))} ${PAYMENT_IMPACT.enabled}`"
          :model-value="transfer.enabled"
          :disabled="pending !== null"
          :readonly="!canManage"
          @update:model-value="toggle('transfer', $event)"
        />
        <SettingsRow
          v-for="item in UNAVAILABLE_METHODS"
          :key="item.key"
          :label="item.title"
          :hint="UNAVAILABLE_NOTE"
          :model-value="false"
          disabled
          readonly
        />
      </div>
      <p v-if="allOff" class="vt-settings-note" role="note">
        Оба способа выключены: игрок увидит, что оплату нужно уточнить у организатора. Запись на
        события по-прежнему работает.
      </p>

      <form class="vt-settings-stack" novalidate @submit.prevent="submit">
        <h3 class="vt-settings-card__title">Реквизиты перевода</h3>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Банк"
          :hint="PAYMENT_IMPACT.bank"
          :error="errors.bank"
        >
          <input
            :id="id"
            v-model="draft.bank"
            class="vt-field"
            :maxlength="REQUISITE_LIMIT"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :readonly="!canManage"
            :disabled="saving"
          />
        </SettingsField>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Карта: последние 4 цифры"
          :hint="PAYMENT_IMPACT.cardLast4"
          :error="errors.cardLast4"
        >
          <input
            :id="id"
            v-model="draft.cardLast4"
            class="vt-field vt-mono"
            inputmode="numeric"
            autocomplete="off"
            maxlength="4"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :readonly="!canManage"
            :disabled="saving"
          />
        </SettingsField>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Получатель"
          :hint="PAYMENT_IMPACT.recipient"
          :error="errors.recipient"
        >
          <input
            :id="id"
            v-model="draft.recipient"
            class="vt-field"
            :maxlength="REQUISITE_LIMIT"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :readonly="!canManage"
            :disabled="saving"
          />
        </SettingsField>
        <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
          {{ formError }}
        </p>
        <div v-if="canManage" class="vt-settings-actions">
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="!dirty || locked"
            @click="resetDraft"
          >
            Отмена
          </button>
          <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="!dirty || locked">
            {{ saving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </template>
  </section>
</template>
