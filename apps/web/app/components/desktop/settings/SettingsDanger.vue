<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'

import VtAlert from '~/components/vt/Alert.vue'
import VtSelect from '~/components/vt/Select.vue'
import {
  dangerErrorMessage,
  deleteNameMatches,
  formatDangerDate,
  transferOptions,
  type TransferCandidate,
} from '~/utils/group-danger'

/**
 * Опасная зона (W-11, 21.2.17, D-15): архивирование (как было), передача владения и мягкое
 * удаление группы. Права проверяет сервер (только owner); раздел показывается только владельцу.
 * Передача: выбрать действующего участника → подтвердить → отправить ему личную ссылку (она
 * показывается один раз). Удаление: подтверждение вводом названия группы.
 */
const props = withDefaults(
  defineProps<{
    busy: boolean
    error: string
    orgId: number
    orgName: string
    ownerUserId: number
    timeZone?: string
  }>(),
  { timeZone: 'Europe/Minsk' },
)
const emit = defineEmits<{
  archive: []
  deleted: [value: { deletedAt: string; restoreUntil: string }]
  toast: [message: string, tone: 'ok' | 'danger']
}>()

interface PendingTransfer {
  id: number
  toName: string | null
  expiresAt: string
}

const uid = useId()
const base = computed(() => `/api/organizations/${props.orgId}`)
const archiveOpen = ref(false)

// ── передача владения ──
const pending = ref<PendingTransfer | null>(null)
const restoreDays = ref(30)
const links = ref<{ telegram: string | null; web: string } | null>(null)
const transferOpen = ref(false)
const cancelOpen = ref(false)
const candidates = ref<TransferCandidate[]>([])
const recipient = ref('')
const transferBusy = ref(false)
const transferError = ref('')
const options = computed(() => transferOptions(candidates.value, props.ownerUserId))

async function loadTransfer() {
  try {
    const data = await $fetch<{ transfer: PendingTransfer | null; restoreWindowDays: number }>(
      `${base.value}/ownership-transfer`,
    )
    pending.value = data.transfer
    restoreDays.value = data.restoreWindowDays
  } catch (cause) {
    transferError.value = dangerErrorMessage(cause, 'Не удалось загрузить состояние передачи')
  }
}
onMounted(loadTransfer)

async function openTransfer() {
  transferError.value = ''
  recipient.value = ''
  transferOpen.value = true
  try {
    const data = await $fetch<{ members: TransferCandidate[] }>(`${base.value}/members`, {
      query: { statuses: 'active' },
    })
    candidates.value = data.members
  } catch (cause) {
    transferError.value = dangerErrorMessage(cause, 'Не удалось загрузить участников')
  }
}

async function startTransfer() {
  if (!recipient.value || transferBusy.value) return
  transferBusy.value = true
  transferError.value = ''
  try {
    const data = await $fetch<{
      transfer: PendingTransfer
      links: { telegram: string | null; web: string }
    }>(`${base.value}/ownership-transfer`, {
      method: 'POST',
      body: { recipientMemberId: Number(recipient.value) },
    })
    pending.value = data.transfer
    links.value = data.links
    emit('toast', 'Передача начата: отправьте ссылку получателю', 'ok')
  } catch (cause) {
    transferError.value = dangerErrorMessage(cause, 'Не удалось начать передачу')
    await loadTransfer()
  } finally {
    transferBusy.value = false
  }
}

async function cancelTransfer() {
  if (transferBusy.value) return
  transferBusy.value = true
  transferError.value = ''
  try {
    await $fetch(`${base.value}/ownership-transfer`, { method: 'DELETE' })
    pending.value = null
    links.value = null
    emit('toast', 'Передача отменена: ссылка больше не действует', 'ok')
  } catch (cause) {
    transferError.value = dangerErrorMessage(cause, 'Не удалось отменить передачу')
  } finally {
    transferBusy.value = false
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    emit('toast', 'Ссылка скопирована', 'ok')
  } catch {
    emit('toast', 'Не удалось скопировать: выделите ссылку вручную', 'danger')
  }
}

// ── удаление ──
const deleteOpen = ref(false)
const typedName = ref('')
const deleteBusy = ref(false)
const deleteError = ref('')
const nameMatches = computed(() => deleteNameMatches(typedName.value, props.orgName))

function openDelete() {
  typedName.value = ''
  deleteError.value = ''
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!nameMatches.value || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    const result = await $fetch<{ deletedAt: string; restoreUntil: string }>(
      `${base.value}/delete`,
      { method: 'POST', body: { confirmName: typedName.value } },
    )
    emit('deleted', result)
  } catch (cause) {
    deleteError.value = dangerErrorMessage(cause, 'Не удалось удалить группу')
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card vt-settings-card--danger">
    <div>
      <h2 class="vt-settings-card__title vt-settings-card__title--danger">Опасная зона</h2>
      <p class="vt-settings-hint">Необратимые действия. Будьте осторожны.</p>
    </div>
    <div class="vt-settings-row">
      <div class="vt-settings-row__text">
        <div class="vt-settings-row__title">Архивировать группу</div>
        <div class="vt-settings-hint">
          Группа исчезнет из активного списка, события скроются. Данные и история сохранятся.
        </div>
      </div>
      <button
        type="button"
        class="vt-btn vt-btn--danger vt-btn--sm"
        data-danger="archive"
        :disabled="busy"
        @click="archiveOpen = true"
      >
        {{ busy ? 'Архивируем…' : 'Архивировать' }}
      </button>
    </div>
    <p v-if="error" class="vt-settings-error vt-settings-error--form" role="alert">{{ error }}</p>

    <div class="vt-settings-row" data-danger-row="transfer">
      <div class="vt-settings-row__text">
        <div class="vt-settings-row__title">Передать владение</div>
        <div v-if="pending" class="vt-settings-hint" data-transfer-pending>
          Ожидает принятия: {{ pending.toName ?? 'участник группы' }}. Ссылка действует до
          {{ formatDangerDate(pending.expiresAt, timeZone) }}. До принятия владелец — вы.
        </div>
        <div v-else class="vt-settings-hint">
          Назначить нового владельца. Он примет передачу по личной ссылке, вы станете
          организатором.
        </div>
      </div>
      <button
        v-if="pending"
        type="button"
        class="vt-btn vt-btn--danger vt-btn--sm"
        data-danger="cancel-transfer"
        :disabled="transferBusy"
        @click="cancelOpen = true"
      >
        Отменить передачу
      </button>
      <button
        v-else
        type="button"
        class="vt-btn vt-btn--danger vt-btn--sm"
        data-danger="transfer"
        :disabled="transferBusy"
        @click="openTransfer"
      >
        Передать
      </button>
    </div>
    <div v-if="links && pending" class="vt-settings-transfer-links" data-transfer-links>
      <p class="vt-settings-hint">
        Отправьте ссылку получателю сами — она показывается один раз и работает только для него.
        Потеряли ссылку — отмените передачу и начните заново.
      </p>
      <div v-if="links.telegram" class="vt-settings-field">
        <label class="vt-label" :for="`${uid}-tg`">Ссылка для Telegram</label>
        <div class="vt-settings-copy">
          <input :id="`${uid}-tg`" class="vt-input" :value="links.telegram" readonly />
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="copy(links.telegram)">
            Скопировать
          </button>
        </div>
      </div>
      <div class="vt-settings-field">
        <label class="vt-label" :for="`${uid}-web`">Ссылка для браузера</label>
        <div class="vt-settings-copy">
          <input :id="`${uid}-web`" class="vt-input" :value="links.web" readonly />
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="copy(links.web)">
            Скопировать
          </button>
        </div>
      </div>
    </div>
    <p
      v-if="transferError && !transferOpen"
      class="vt-settings-error vt-settings-error--form"
      role="alert"
    >
      {{ transferError }}
    </p>

    <div class="vt-settings-row" data-danger-row="delete">
      <div class="vt-settings-row__text">
        <div class="vt-settings-row__title">Удалить группу</div>
        <div class="vt-settings-hint">
          Группа скроется у всех участников, запись и оплата остановятся. Деньги и история
          сохраняются; восстановить группу можно в течение {{ restoreDays }} дней.
        </div>
      </div>
      <button
        type="button"
        class="vt-btn vt-btn--danger vt-btn--sm"
        data-danger="delete"
        :disabled="deleteBusy || Boolean(pending)"
        @click="openDelete"
      >
        {{ deleteBusy ? 'Удаляем…' : 'Удалить' }}
      </button>
    </div>
    <p v-if="pending" class="vt-settings-hint">
      Удалить группу можно после отмены ожидающей передачи владения.
    </p>
    <p v-if="deleteError && !deleteOpen" class="vt-settings-error vt-settings-error--form" role="alert">
      {{ deleteError }}
    </p>

    <VtAlert
      v-model="archiveOpen"
      title="Архивировать группу?"
      body="Она исчезнет из активного списка, но данные сохранятся."
      confirm-label="Архивировать"
      danger
      @confirm="emit('archive')"
    />
    <VtAlert
      v-model="transferOpen"
      title="Передать владение?"
      confirm-label="Начать передачу"
      :confirm-disabled="!recipient || transferBusy"
      danger
      wide
      @confirm="startTransfer"
    >
      <p class="vt-alert__body">
        Получатель станет владельцем, когда примет передачу по личной ссылке. После этого вы
        станете организатором и потеряете права владельца.
      </p>
      <div class="vt-settings-field">
        <span :id="`${uid}-recipient`" class="vt-label">Кому передать</span>
        <VtSelect
          v-model="recipient"
          :labelledby="`${uid}-recipient`"
          :options="options"
          placeholder="Выберите участника"
        />
        <p v-if="!options.length && !transferError" class="vt-settings-hint">
          В группе нет других действующих участников.
        </p>
      </div>
      <p v-if="transferError" class="vt-settings-error" role="alert">{{ transferError }}</p>
    </VtAlert>
    <VtAlert
      v-model="cancelOpen"
      title="Отменить передачу?"
      body="Ссылка перестанет работать, владельцем останетесь вы."
      confirm-label="Отменить передачу"
      cancel-label="Не отменять"
      danger
      @confirm="cancelTransfer"
    />
    <VtAlert
      v-model="deleteOpen"
      title="Удалить группу?"
      confirm-label="Удалить группу"
      :confirm-disabled="!nameMatches || deleteBusy"
      danger
      wide
      @confirm="confirmDelete"
    >
      <p class="vt-alert__body">
        Группа скроется у всех участников, из списка групп и с публичных страниц; запись, оплата и
        уведомления остановятся. Баланс событий, касса, абонементы и платежи не изменятся.
        Восстановить группу можно в течение {{ restoreDays }} дней.
      </p>
      <div class="vt-settings-field">
        <label class="vt-label" :for="`${uid}-confirm`">
          Введите название группы «{{ orgName }}», чтобы подтвердить
        </label>
        <input
          :id="`${uid}-confirm`"
          v-model="typedName"
          class="vt-input"
          autocomplete="off"
          spellcheck="false"
          data-delete-confirm
        />
      </div>
      <p v-if="deleteError" class="vt-settings-error" role="alert">{{ deleteError }}</p>
    </VtAlert>
  </section>
</template>
