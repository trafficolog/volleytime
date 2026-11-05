<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

import {
  WEEKDAYS,
  newIdempotencyKey,
  seriesBalanceNote,
  seriesResultLines,
  toggleWeekday,
  type SeriesCreatedView,
  type SeriesPreviewView,
} from '~/utils/event-series'
import { apiErrorCode } from '~/utils/api-error'
import { registerBackOverlay } from '~/utils/miniapp-back'
import {
  WIZARD_DEFAULTS,
  WIZARD_STEPS,
  buildWizardSeries,
  validateGroupName,
  validateSchedule,
  wizardStartDate,
} from '~/utils/org-wizard'

/**
 * Мастер «Своя группа» (21.1.7, M-мастер из референса): Группа → Расписание → Готово.
 * Решение владельца 2026-11-05: группа создаётся на переходе 1→2 (предпросмотр серии требует
 * существующей группы с балансом); повтор и «Назад» не создают вторую группу.
 */
definePageMeta({ layout: 'miniapp', middleware: ['auth'] })
const { create } = useOrganizations()
const { haptic, isTelegram, webApp } = useTelegram()

const step = ref(0)
const name = ref('')
const city = ref('Минск')
const days = ref<number[]>([...WIZARD_DEFAULTS.days])
const time = ref(WIZARD_DEFAULTS.time)
const seats = ref(WIZARD_DEFAULTS.seats)

const group = ref<{ id: number; name: string; city: string; tz: string } | null>(null)
const creatingGroup = ref(false)
const groupError = ref('')
const gift = ref<number | null>(null)

const preview = ref<SeriesPreviewView | null>(null)
const previewLoadedKey = ref('')
const previewLoading = ref(false)
const previewError = ref(false)
let previewSeq = 0

const creatingSeries = ref(false)
const seriesError = ref('')
const seriesResult = ref<SeriesCreatedView | null>(null)
// один ключ идемпотентности на запуск мастера: если создание прошло, а клиент увидел ошибку, повтор
// с изменённым расписанием получит 409 вместо второй серии и второго списания баланса
const runKey = newIdempotencyKey()
// попытка создать серию была, итог неизвестен (ошибка) или серия уже есть (409)
const seriesAttempted = ref(false)
const seriesExists = ref(false)

const inviteUrl = ref('')
const inviteLoading = ref(false)
const inviteError = ref(false)
const copied = ref(false)

const heading = ref<HTMLElement | null>(null)

const nameError = computed(() => (name.value.trim() ? validateGroupName(name.value) : ''))
const scheduleErrors = computed(() =>
  validateSchedule({ days: days.value, time: time.value, seats: seats.value }),
)
const scheduleValid = computed(() => Object.values(scheduleErrors.value).every((e) => !e))

const seriesBody = computed(() => {
  if (!group.value || !scheduleValid.value) return null
  return buildWizardSeries({
    name: group.value.name,
    days: days.value,
    time: time.value,
    seats: seats.value,
    startDate: wizardStartDate(new Date(), group.value.tz),
  })
})
const bodyKey = computed(() => JSON.stringify(seriesBody.value))
const previewCurrent = computed(
  () => preview.value !== null && previewLoadedKey.value === bodyKey.value,
)
const balanceNote = computed(() => (preview.value ? seriesBalanceNote(preview.value) : null))

async function loadPreview() {
  const body = seriesBody.value
  const key = bodyKey.value
  const seq = ++previewSeq
  if (!body || !group.value) {
    preview.value = null
    previewLoading.value = false
    return
  }
  previewLoading.value = true
  previewError.value = false
  try {
    const result = await $fetch<SeriesPreviewView>(
      `/api/organizations/${group.value.id}/series/preview`,
      { method: 'POST', body },
    )
    if (seq !== previewSeq) return
    preview.value = result
    previewLoadedKey.value = key
  } catch {
    if (seq !== previewSeq) return
    preview.value = null
    previewLoadedKey.value = ''
    previewError.value = true
  } finally {
    if (seq === previewSeq) previewLoading.value = false
  }
}

watch(
  [() => step.value === 1, bodyKey],
  ([onStep2]) => {
    if (onStep2) void loadPreview()
  },
  { flush: 'post' },
)

async function ensureGroup(): Promise<boolean> {
  if (group.value) return true
  if (creatingGroup.value) return false
  const nameErr = validateGroupName(name.value)
  if (nameErr) {
    groupError.value = nameErr
    haptic('error')
    return false
  }
  creatingGroup.value = true
  groupError.value = ''
  try {
    const org = await create({ name: name.value.trim(), city: city.value.trim() || undefined })
    group.value = {
      id: org.id,
      name: name.value.trim(),
      city: city.value.trim(),
      tz: (org as { defaultTimezone?: string }).defaultTimezone || 'Europe/Minsk',
    }
    haptic('success')
    // подарок — реальный баланс только что созданной группы (D-12), не константа
    try {
      const data = await $fetch<{ eventBalance: { balance: number } }>(
        `/api/organizations/${org.id}/event-balance`,
      )
      gift.value = data.eventBalance.balance
    } catch {
      gift.value = null
    }
    return true
  } catch (e) {
    haptic('error')
    groupError.value = apiErrorMessage(e, 'Не удалось создать группу')
    return false
  } finally {
    creatingGroup.value = false
  }
}

async function createSeries(): Promise<boolean> {
  const body = seriesBody.value
  if (!group.value || !body || creatingSeries.value || !previewCurrent.value) return false
  creatingSeries.value = true
  seriesAttempted.value = true
  seriesError.value = ''
  try {
    seriesResult.value = await $fetch<SeriesCreatedView>(
      `/api/organizations/${group.value.id}/series`,
      { method: 'POST', body: { ...body, idempotencyKey: runKey } },
    )
    haptic('success')
    return true
  } catch (e) {
    haptic('error')
    if (apiErrorCode(e) === 'series.idempotency_conflict') {
      // серия этого запуска уже создана (прошлая попытка прошла, ответ потерян): идём дальше
      seriesExists.value = true
      seriesResult.value = null
      return true
    }
    seriesError.value = `${apiErrorMessage(e, 'Не удалось создать расписание')}. Группа уже создана: повторите или пропустите шаг. Расписание могло создаться — проверьте события группы.`
    return false
  } finally {
    creatingSeries.value = false
  }
}

async function loadInvite() {
  if (!group.value || inviteUrl.value || inviteLoading.value) return
  inviteLoading.value = true
  inviteError.value = false
  try {
    const data = await $fetch<{ deeplinkUrl: string }>(
      `/api/organizations/${group.value.id}/invites`,
      { method: 'POST', body: { roleToAssign: 'player' } },
    )
    inviteUrl.value = data.deeplinkUrl
  } catch {
    inviteError.value = true
  } finally {
    inviteLoading.value = false
  }
}

async function goTo(next: number) {
  step.value = next
  await nextTick()
  heading.value?.focus()
  if (next === 2) void loadInvite()
}

const busy = computed(() => creatingGroup.value || creatingSeries.value)
const nextDisabled = computed(() => {
  if (busy.value) return true
  if (step.value === 0) return group.value ? false : validateGroupName(name.value) !== ''
  if (step.value === 1) return !previewCurrent.value
  return false
})

async function onNext() {
  if (nextDisabled.value) return
  if (step.value === 0) {
    if (await ensureGroup()) await goTo(1)
  } else if (step.value === 1) {
    if (await createSeries()) await goTo(2)
  } else if (group.value) {
    await navigateTo(`/m/orgs/${group.value.id}`)
  }
}
async function onSkip() {
  if (busy.value) return
  seriesResult.value = null
  await goTo(2)
}
async function onBack() {
  if (busy.value || step.value !== 1) return
  await goTo(0)
}

async function copyInvite() {
  await navigator.clipboard.writeText(inviteUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const nextLabel = computed(() => {
  if (step.value === 2) return 'Готово'
  if (step.value === 0 && creatingGroup.value) return 'Создаём группу…'
  if (step.value === 1 && creatingSeries.value) return 'Создаём…'
  return 'Дальше'
})

const daysLabel = computed(() => {
  if (seriesResult.value)
    return WEEKDAYS.filter((d) => days.value.includes(d.value))
      .map((d) => d.short)
      .join(', ')
  if (seriesExists.value) return 'расписание создано'
  if (seriesAttempted.value) return 'расписание — проверьте события группы'
  return 'расписание позже'
})

watch(bodyKey, () => {
  seriesError.value = ''
})

// В Telegram основное действие — системная MainButton (Task 20.4.1); кнопка футера скрыта
const mainButton = createMainButton(isTelegram.value ? webApp : undefined, () => {
  void onNext()
})
let unregisterBack: (() => void) | undefined
onMounted(() => {
  watchEffect(() =>
    mainButton.update({
      text: nextLabel.value,
      loading: busy.value,
      disabled: nextDisabled.value,
    }),
  )
  // системная «назад» Telegram между шагами 2→1, а не выход из мастера
  watchEffect(() => {
    unregisterBack?.()
    unregisterBack = step.value === 1 ? registerBackOverlay(() => void onBack()) : undefined
  })
})
onUnmounted(() => {
  unregisterBack?.()
  mainButton.destroy()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <VtMiniHeader
      title="Своя группа"
      :sub="`Шаг ${step + 1} из 3`"
      :back="step === 0 ? '/m/orgs' : undefined"
    />
    <ol class="px-4 pb-1.5 flex gap-1.5" aria-label="Шаги">
      <li
        v-for="(label, i) in WIZARD_STEPS"
        :key="label"
        class="flex-1"
        data-wizard-step
        :aria-current="i === step ? 'step' : undefined"
      >
        <div
          class="h-1 rounded-full"
          :class="i <= step ? 'bg-vt-flame' : 'bg-vt-bone-2'"
          aria-hidden="true"
        />
        <span
          class="block text-[11px] font-semibold mt-1.5"
          :class="i <= step ? 'text-vt-ink' : 'text-vt-mute-2'"
          >{{ label }}</span
        >
      </li>
    </ol>

    <main class="flex-1 px-4 pt-3.5 pb-4 space-y-3.5">
      <section v-if="step === 0" class="space-y-3.5">
        <h2
          id="wizard-heading"
          ref="heading"
          tabindex="-1"
          class="text-3xl leading-none font-display outline-none"
        >
          Как назовём группу?
        </h2>
        <p class="text-sm text-vt-mute-2">Название увидят игроки в приглашении и в боте.</p>
        <form class="space-y-3.5" @submit.prevent="onNext">
          <div>
            <label class="vt-label" for="org-name">Название</label>
            <input
              id="org-name"
              v-model="name"
              :readonly="!!group"
              maxlength="200"
              class="vt-field"
              placeholder="Напр. Волейбол по средам"
            />
          </div>
          <div>
            <label class="vt-label" for="org-city">Город</label>
            <input
              id="org-city"
              v-model="city"
              :readonly="!!group"
              class="vt-field"
              maxlength="120"
            />
          </div>
          <p v-if="group" class="text-xs text-vt-mute-2">
            Группа уже создана — название и город можно изменить в настройках.
          </p>
          <p v-if="nameError" class="text-sm text-vt-rose-ink">{{ nameError }}</p>
          <p v-if="groupError" class="text-sm text-vt-rose-ink" role="alert">{{ groupError }}</p>
        </form>
      </section>

      <section v-else-if="step === 1" class="space-y-3.5">
        <h2
          id="wizard-heading"
          ref="heading"
          tabindex="-1"
          class="text-3xl leading-none font-display outline-none"
        >
          Когда играете?
        </h2>
        <p class="text-sm text-vt-mute-2">
          Можно пропустить — тренировки создаются и вручную. Группа уже создана.
        </p>
        <div class="grid grid-cols-7 gap-1.5" role="group" aria-label="Дни недели">
          <button
            v-for="d in WEEKDAYS"
            :key="d.value"
            type="button"
            class="vt-btn vt-btn--sm !py-3"
            :style="
              days.includes(d.value)
                ? { background: 'var(--vt-ink)', color: 'var(--vt-paper)' }
                : { background: 'var(--vt-ctl)', color: 'var(--vt-ink)' }
            "
            :data-day="d.value"
            :aria-pressed="days.includes(d.value) ? 'true' : 'false'"
            :aria-label="d.name"
            @click="days = toggleWeekday(days, d.value)"
          >
            {{ d.short }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="vt-label" for="wizard-time">Время</label>
            <input id="wizard-time" v-model="time" type="time" class="vt-field" />
            <p v-if="scheduleErrors.time" class="text-xs text-vt-rose-ink mt-1">
              {{ scheduleErrors.time }}
            </p>
          </div>
          <div>
            <label class="vt-label" for="wizard-seats">Мест</label>
            <input id="wizard-seats" v-model="seats" inputmode="numeric" class="vt-field vt-mono" />
            <p v-if="scheduleErrors.seats" class="text-xs text-vt-rose-ink mt-1">
              {{ scheduleErrors.seats }}
            </p>
          </div>
        </div>

        <div v-if="previewLoading && !previewCurrent" role="status" class="text-sm text-vt-mute-2">
          Считаем даты и баланс…
        </div>
        <div v-else-if="previewError" class="vt-card p-3.5 space-y-2" data-preview-error>
          <p class="text-sm text-vt-rose-ink" role="alert">Не удалось рассчитать даты и баланс.</p>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="loadPreview">
            Повторить
          </button>
        </div>
        <div
          v-else-if="preview && previewCurrent"
          class="vt-card p-3.5 space-y-2"
          data-series-preview
        >
          <dl class="grid grid-cols-3 gap-2 text-center">
            <div>
              <dd class="vt-mono text-2xl font-bold" data-preview-published>
                {{ preview.published }}
              </dd>
              <dt class="text-[11px] text-vt-mute-2">опубликуем</dt>
            </div>
            <div>
              <dd class="vt-mono text-2xl font-bold" data-preview-drafts>{{ preview.drafts }}</dd>
              <dt class="text-[11px] text-vt-mute-2">черновиков</dt>
            </div>
            <div>
              <dd class="vt-mono text-2xl font-bold" data-preview-balance-after>
                {{ preview.balanceAfter }}
              </dd>
              <dt class="text-[11px] text-vt-mute-2">баланс после</dt>
            </div>
          </dl>
          <p v-if="balanceNote" class="text-xs text-vt-mute-2">{{ balanceNote.text }}</p>
        </div>
        <p v-if="seriesError" class="text-sm text-vt-rose-ink" role="alert" data-series-error>
          {{ seriesError }}
        </p>
      </section>

      <section v-else class="space-y-3" data-wizard-done>
        <h2 id="wizard-heading" ref="heading" tabindex="-1" class="sr-only">Группа создана</h2>
        <div class="vt-card vt-card--hero p-5">
          <div class="vt-cap opacity-70">Группа создана</div>
          <div class="font-display text-3xl font-bold uppercase leading-none mt-2.5">
            {{ group?.name }}
          </div>
          <div class="text-sm opacity-80 mt-2">{{ group?.city }} · {{ daysLabel }}</div>
        </div>
        <div v-if="gift !== null" class="vt-card vt-card--warm p-4 flex items-center gap-3.5">
          <div class="vt-mono text-4xl font-bold leading-none" data-gift>{{ gift }}</div>
          <p class="text-sm">
            <b>событий в подарок</b><br /><span class="text-vt-mute-2"
              >Баланс событий: 1 событие = 1 публикация.</span
            >
          </p>
        </div>
        <p v-if="seriesExists" class="vt-card p-3.5 text-sm" role="status" data-series-exists>
          Расписание уже создано. Его события — в списке событий группы.
        </p>
        <p
          v-else-if="seriesAttempted && !seriesResult"
          class="vt-card p-3.5 text-sm"
          data-series-unknown
        >
          Расписание могло создаться, проверьте события группы.
        </p>
        <div v-if="seriesResult" class="vt-card p-3.5 space-y-1" data-series-result>
          <p v-for="line in seriesResultLines(seriesResult)" :key="line" class="text-sm">
            {{ line }}
          </p>
        </div>
        <div class="vt-card p-3.5">
          <div class="text-sm font-semibold">Пригласите игроков</div>
          <p
            v-if="inviteUrl"
            class="vt-mono text-xs text-vt-mute-2 mt-1.5 break-all"
            data-invite-link
          >
            {{ inviteUrl }}
          </p>
          <p v-else-if="inviteLoading" class="text-xs text-vt-mute-2 mt-1.5" role="status">
            Готовим ссылку…
          </p>
          <div v-else-if="inviteError" class="mt-1.5" data-invite-error>
            <p class="text-xs text-vt-rose-ink" role="alert">Не удалось создать ссылку.</p>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm mt-2"
              data-invite-retry
              @click="loadInvite"
            >
              Повторить
            </button>
          </div>
          <button
            v-if="inviteUrl"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm mt-2.5 gap-1.5"
            data-invite-copy
            @click="copyInvite"
          >
            <VtIcon name="copy" :size="13" /> {{ copied ? 'Скопировано' : 'Скопировать' }}
          </button>
        </div>
      </section>
    </main>

    <footer class="px-4 pt-3 pb-4 flex gap-2">
      <button
        v-if="step === 1"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--lg flex-1"
        data-wizard-back
        :disabled="busy"
        @click="onBack"
      >
        Назад
      </button>
      <button
        v-if="step === 1"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--lg flex-1"
        data-wizard-skip
        :disabled="busy"
        @click="onSkip"
      >
        Пропустить
      </button>
      <button
        v-if="!isTelegram"
        type="button"
        class="vt-btn vt-btn--primary vt-btn--lg flex-[2]"
        data-wizard-next
        :disabled="nextDisabled"
        @click="onNext"
      >
        {{ nextLabel }}
      </button>
    </footer>
  </div>
</template>
