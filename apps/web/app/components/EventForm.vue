<script setup lang="ts">
import type { Event, Venue } from '@volley-time/db'
import {
  dateToZonedInput,
  isoWeekday,
  toMajor,
  toMinor,
  zonedInputToDate,
  type PricingPermissions,
  type SeriesFreq,
} from '@volley-time/shared'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'

import EventSeriesBlock from '~/components/EventSeriesBlock.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtSegment from '~/components/vt/Segment.vue'
import VtSelect from '~/components/vt/Select.vue'
import VtToggle from '~/components/vt/Toggle.vue'
import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { fullRosterForecast } from '~/utils/event-form-price'
import {
  buildSeriesRule,
  eventsWord,
  newIdempotencyKey,
  seriesBalanceNote,
  type SeriesEndMode,
  type SeriesPreviewView,
  type SeriesSpan,
} from '~/utils/event-series'
import { formatMoneyRu } from '~/utils/labels'

/**
 * Форма события и серии (W-04, 20.5.5). Время — в TZ организации. Создание: одно событие или
 * серия (блок повтора с предпросмотром и последствиями для баланса); правка: одно событие.
 */
interface SeriesCreated {
  series: { id: number }
  events: { id: number }[]
  total: number
  published: number
  drafts: number
  venueConflicts: number | null
  balanceAfter: number
  replayed: boolean
}
interface GroupSettingsView {
  cancellationAllowed: boolean
  cancellationDeadlineHours: number | null
  maxSeatsPerBooking?: number
  defaultPriceMode?: 'fixed' | 'split'
  defaultJoinMode?: 'open' | 'invite'
  levels?: string[]
}
interface LevelView {
  code: string
  title: string
}

const props = defineProps<{
  orgId: number
  tz: string
  initial?: Event | null
  submitLabel: string
  subscriptionsEnabled?: boolean
  canSubmit?: () => boolean
  currency?: string
  splitPricingEnabled?: boolean
  /** Запись «по приглашению» включена возможностью окружения (EVENT_INVITE_MODE_ENABLED, 20.1.3). */
  inviteModeEnabled?: boolean
  /** Блок повтора: только при создании и только там, где хост умеет показать итог серии. */
  allowSeries?: boolean
  pricingPermissions?: PricingPermissions
}>()
const emit = defineEmits<{ saved: [event: Event]; seriesCreated: [result: SeriesCreated] }>()

const uid = useId()
const i = props.initial

const venues = ref<Venue[]>([])
const groupSettings = ref<GroupSettingsView | null>(null)
const levelCatalog = ref<LevelView[]>([])
// Площадки, настройки группы (умолчания P-02) и справочник уровней читаются параллельно; сбой любого
// не мешает форме: умолчания тогда общие.
await Promise.all([
  $fetch<{ venues: Venue[] }>(`/api/organizations/${props.orgId}/venues`).then(
    (res) => (venues.value = res.venues),
    () => (venues.value = []),
  ),
  $fetch<{ settings: GroupSettingsView }>(`/api/organizations/${props.orgId}/settings`).then(
    (res) => (groupSettings.value = res?.settings ?? null),
    () => (groupSettings.value = null),
  ),
  $fetch<{ levels: LevelView[] }>('/api/levels').then(
    (res) => (levelCatalog.value = Array.isArray(res?.levels) ? res.levels : []),
    () => (levelCatalog.value = []),
  ),
])

const defaultStart = () => {
  const d = new Date(Date.now() + 86400_000)
  d.setMinutes(0, 0, 0)
  return dateToZonedInput(d, props.tz).replace(/T\d{2}:/, 'T19:')
}
// Политика отмены принадлежит группе (D-02): форма её только показывает.
// Для существующего события — снимок события, для нового — настройки группы.
const cancellationPolicyText = computed(() => {
  const policy = i ?? groupSettings.value
  if (!policy) return 'Политика отмены задаётся в настройках группы'
  if (!policy.cancellationAllowed) return 'Отмена записи запрещена · меняется в настройках группы'
  return policy.cancellationDeadlineHours == null
    ? 'Отмена: до начала · меняется в настройках группы'
    : `Отмена: до ${policy.cancellationDeadlineHours} ч до начала · меняется в настройках группы`
})

const groupJoinMode = groupSettings.value?.defaultJoinMode ?? 'open'
const groupPriceMode =
  !i && groupSettings.value?.defaultPriceMode === 'split' && props.splitPricingEnabled === true
    ? 'split'
    : 'fixed'

const form = reactive({
  title: i?.title ?? 'Тренировка',
  type: (i?.type ?? 'training') as string,
  startsAt: i ? dateToZonedInput(i.startsAt, props.tz) : defaultStart(),
  durationMin: i
    ? Math.round((new Date(i.endsAt).getTime() - new Date(i.startsAt).getTime()) / 60000)
    : 120,
  venueId: (i?.venueId ?? '') as number | '',
  newVenueName: '',
  newVenueAddress: '',
  locationText: i?.locationText ?? '',
  capacity: i?.capacity ?? 12,
  priceMajor: i ? String(toMajor(i.price)) : '0',
  priceMode: (i?.priceMode ?? groupPriceMode) as string,
  targetMajor: i?.targetAmount ? String(toMajor(i.targetAmount)) : '',
  joinMode: (i?.joinMode ?? groupJoinMode) as string,
  level: (i?.level ?? '') as string,
  closeBefore: String(i?.closeBeforeMinutes ?? 120),
  description: i?.description ?? '',
  publish: i ? i.status === 'published' : true,
})
const addingVenue = ref(false)
const saving = ref(false)
const error = ref('')
type FieldKey = 'title' | 'start' | 'venue' | 'capacity' | 'price' | 'target' | 'count'
const fieldErrors = reactive<Partial<Record<FieldKey, string>>>({})
const currency = computed(() => i?.currency ?? props.currency ?? 'BYN')
const modeLocked = computed(() => !!i && props.pricingPermissions?.canChangePriceMode !== true)
const targetLocked = computed(
  () => !!i && i.priceMode === 'split' && props.pricingPermissions?.canChangeTargetAmount !== true,
)
const splitUnavailable = computed(
  () => i?.priceMode !== 'split' && props.splitPricingEnabled !== true,
)
function amountMinor(value: string | number): number | null {
  const text = String(value).trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const amount = toMinor(Number(text))
  return Number.isSafeInteger(amount) && amount <= 2147483647 ? amount : null
}
const capacityValid = computed(
  () => Number.isInteger(form.capacity) && form.capacity >= 1 && form.capacity <= 500,
)
const forecast = computed(() => {
  const target = amountMinor(form.targetMajor)
  if (!target || !capacityValid.value) return null
  return fullRosterForecast(target, form.capacity)
})
const fixedTotal = computed(() => {
  const price = amountMinor(form.priceMajor)
  return price && capacityValid.value ? price * form.capacity : null
})

// --- выбор из справочников --------------------------------------------------------------------
const typeOptions = [
  { value: 'training', label: 'Тренировка' },
  { value: 'open_game', label: 'Открытая игра' },
  { value: 'custom', label: 'Другое' },
]
const priceModeOptions = computed(() => [
  { value: 'fixed', label: 'Фикс. цена', disabled: modeLocked.value },
  { value: 'split', label: 'Делим сумму', disabled: modeLocked.value || splitUnavailable.value },
])
const joinModeOptions = computed(() => [
  { value: 'open', label: 'Свободная' },
  { value: 'invite', label: 'По приглашению', disabled: props.inviteModeEnabled !== true },
])
const closeBeforeOptions = [
  { value: '60', label: 'за 1 ч' },
  { value: '120', label: 'за 2 ч' },
  { value: '360', label: 'за 6 ч' },
  { value: '1440', label: 'за 24 ч' },
]
// правка опубликованного события: момент закрытия уже прошёл — сервер оставит запись на ручное закрытие
const closeMomentPassed = computed(() => {
  if (!i || !form.publish || !isDate(form.startsAt)) return false
  const start = zonedInputToDate(form.startsAt, props.tz).getTime()
  return start - Number(form.closeBefore) * 60_000 < Date.now()
})
const joinOverridden = computed(() => form.joinMode !== groupJoinMode)
const durationOptions = computed(() => {
  const base = [60, 90, 120, 150, 180]
  const minutes = base.includes(form.durationMin)
    ? base
    : [...base, form.durationMin].sort((a, b) => a - b)
  const label = (m: number) =>
    m % 60 === 0 ? `${m / 60} ${m === 60 ? 'час' : m < 300 ? 'часа' : 'часов'}` : `${m} мин`
  return minutes.map((m) => ({
    value: String(m),
    label: m === 90 ? '1,5 часа' : m === 150 ? '2,5 часа' : label(m),
  }))
})
const durationValue = computed({
  get: () => String(form.durationMin),
  set: (v: string) => (form.durationMin = Number(v)),
})
const venueOptions = computed(() => [
  { value: '', label: 'Не указана' },
  ...venues.value.map((v) => ({ value: String(v.id), label: v.name })),
])
const venueValue = computed({
  get: () => String(form.venueId),
  set: (v: string) => (form.venueId = v === '' ? '' : Number(v)),
})
const levelOptions = computed(() => {
  const allowed = groupSettings.value?.levels ?? []
  const codes = levelCatalog.value
    .filter((l) => allowed.length === 0 || allowed.includes(l.code) || l.code === form.level)
    .map((l) => ({ value: l.code, label: l.title }))
  return [{ value: '', label: 'Для любого уровня' }, ...codes]
})

// --- повтор и предпросмотр --------------------------------------------------------------------
const seriesAllowed = computed(() => props.allowSeries === true && !i)
const recurrence = reactive({
  freq: 'once' as string,
  weekdays: [] as number[],
  endMode: 'span' as SeriesEndMode,
  span: 'quarter' as string,
  count: '8',
  exceptions: [] as string[],
})
let weekdaysTouched = false
function markWeekdaysTouched() {
  weekdaysTouched = true
}
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)
const startDate = computed(() => form.startsAt.slice(0, 10))
const startTime = computed(() => form.startsAt.slice(11, 16))
watch(
  startDate,
  (date) => {
    if (!weekdaysTouched && isDate(form.startsAt)) {
      try {
        recurrence.weekdays = [isoWeekday(date)]
      } catch {
        /* дата ещё не введена полностью */
      }
    }
  },
  { immediate: true },
)
const isSeries = computed(() => seriesAllowed.value && recurrence.freq !== 'once')
const countValue = computed(() => {
  const text = recurrence.count.trim()
  return /^\d+$/.test(text) ? Number(text) : NaN
})
const countValid = computed(
  () => Number.isInteger(countValue.value) && countValue.value >= 1 && countValue.value <= 366,
)

const venueIdForRequest = () => (form.venueId === '' ? undefined : form.venueId)

/**
 * Тело для предпросмотра. Баланс и даты не зависят от цены, режимов и уровня, поэтому предпросмотр
 * всегда «фиксированная цена 0» без режима записи: черновая форма с неполными данными тоже получает
 * расчёт, а выключенные возможности окружения не отвечают 409.
 */
const previewBody = computed(() => {
  if (!seriesAllowed.value || !isDate(form.startsAt) || !capacityValid.value) return null
  if (isSeries.value && recurrence.endMode === 'count' && !countValid.value) return null
  const rule = buildSeriesRule({
    freq: recurrence.freq as SeriesFreq,
    weekdays: recurrence.weekdays,
    startDate: startDate.value,
    endMode: recurrence.endMode,
    span: recurrence.span as SeriesSpan,
    count: countValid.value ? countValue.value : 1,
  })
  return {
    rule,
    exceptions: isSeries.value ? recurrence.exceptions : [],
    template: {
      type: form.type,
      // название не влияет на даты и баланс: в предпросмотр не отправляем введённый текст
      title: 'Событие',
      startTime: startTime.value,
      durationMinutes: Number(form.durationMin),
      capacity: Number(form.capacity),
      venueId: venueIdForRequest(),
      priceMode: 'fixed',
      price: 0,
    },
  }
})
const previewKey = computed(() => JSON.stringify(previewBody.value))
const preview = ref<SeriesPreviewView | null>(null)
const previewLoadedKey = ref('')
const previewLoading = ref(false)
const previewError = ref('')
let previewSeq = 0
let previewTimer: ReturnType<typeof setTimeout> | undefined

async function loadPreview() {
  const body = previewBody.value
  const key = previewKey.value
  const seq = ++previewSeq
  if (!body) {
    previewLoading.value = false
    return
  }
  previewLoading.value = true
  previewError.value = ''
  try {
    const result = await $fetch<SeriesPreviewView>(
      `/api/organizations/${props.orgId}/series/preview`,
      { method: 'POST', body },
    )
    if (seq !== previewSeq) return
    if (!result || !Array.isArray(result.dates)) throw new Error('bad preview')
    preview.value = result
    previewLoadedKey.value = key
  } catch (e) {
    if (seq !== previewSeq) return
    preview.value = null
    previewLoadedKey.value = ''
    previewError.value = apiErrorMessage(e, 'Не удалось рассчитать даты и баланс')
  } finally {
    if (seq === previewSeq) previewLoading.value = false
  }
}
watch(
  previewKey,
  () => {
    clearTimeout(previewTimer)
    if (!previewBody.value) {
      previewSeq++
      previewLoading.value = false
      preview.value = null
      previewLoadedKey.value = ''
      previewError.value = ''
      return
    }
    previewLoading.value = true
    previewTimer = setTimeout(loadPreview, 250)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  clearTimeout(previewTimer)
  previewSeq++
})
const previewCurrent = computed(
  () => preview.value !== null && previewLoadedKey.value === previewKey.value,
)
function retryPreview() {
  clearTimeout(previewTimer)
  void loadPreview()
}

// --- баланс событий ---------------------------------------------------------------------------
const balanceNote = computed<{ tone: 'neutral' | 'warning'; text: string } | null>(() => {
  if (i || !seriesAllowed.value) return null
  if (isSeries.value)
    return preview.value && previewCurrent.value ? seriesBalanceNote(preview.value) : null
  if (!form.publish) {
    return {
      tone: 'neutral',
      text: 'Черновик: баланс событий не списывается, спишется при публикации.',
    }
  }
  const p = preview.value
  if (!p) return null
  if (!p.balanceEnforced) {
    return { tone: 'neutral', text: 'Баланс событий пока не списывается.' }
  }
  if (p.balanceBefore < 1) {
    return {
      tone: 'warning',
      text: `Не хватает баланса событий: на балансе ${p.balanceBefore}. Пополните баланс или сохраните событие как черновик.`,
    }
  }
  return {
    tone: 'neutral',
    text: `Будет списано 1 ${eventsWord(1)} из баланса событий. На балансе ${p.balanceBefore}, останется ${p.balanceBefore - 1}.`,
  }
})
const publishBlocked = computed(
  () =>
    !i &&
    !isSeries.value &&
    form.publish &&
    preview.value !== null &&
    preview.value.balanceEnforced &&
    preview.value.balanceBefore < 1,
)
const submitDisabled = computed(
  () => saving.value || publishBlocked.value || (isSeries.value && !previewCurrent.value),
)
const submitText = computed(() => {
  if (saving.value) return 'Сохраняем…'
  if (!isSeries.value) return props.submitLabel
  return preview.value && previewCurrent.value
    ? `Создать ${preview.value.total} ${eventsWord(preview.value.total)}`
    : 'Создать серию'
})

// --- отправка ---------------------------------------------------------------------------------
const FOCUS_ID: Record<FieldKey, string> = {
  title: 'ev-title',
  start: 'ev-start',
  venue: 'ev-new-venue-name',
  capacity: 'ev-cap',
  price: 'ev-price',
  target: 'ev-target',
  count: 'ev-series-count',
}
const FIELD_ORDER: FieldKey[] = ['title', 'start', 'venue', 'capacity', 'price', 'target', 'count']

function validate(split: boolean): number | null {
  for (const key of FIELD_ORDER) delete fieldErrors[key]
  const title = form.title.trim()
  if (title.length < 2 || title.length > 200) fieldErrors.title = 'Название: от 2 до 200 символов'
  if (!isDate(form.startsAt)) fieldErrors.start = 'Укажите дату и время начала'
  if (addingVenue.value && !form.newVenueName.trim()) {
    fieldErrors.venue = 'Укажите название новой площадки'
  }
  if (!capacityValid.value) fieldErrors.capacity = 'Мест должно быть от 1 до 500'
  const amount = amountMinor(split ? form.targetMajor : form.priceMajor)
  if (amount === null || (split && amount < 1)) {
    const message = split
      ? 'Введите общую сумму от 0,01 до 21 474 836,47 с двумя знаками после запятой'
      : 'Введите корректную цену: от 0 до 21 474 836,47 с двумя знаками после запятой'
    if (split) fieldErrors.target = message
    else fieldErrors.price = message
  }
  if (isSeries.value && recurrence.endMode === 'count' && !countValid.value) {
    fieldErrors.count = COUNT_MESSAGE
  }
  const first = FIELD_ORDER.find((key) => fieldErrors[key])
  if (first) {
    void nextTick(() => document.getElementById(FOCUS_ID[first])?.focus())
    return null
  }
  return amount
}

const COUNT_MESSAGE = 'Число повторений: целое от 1 до 366'
const countError = computed(
  () =>
    fieldErrors.count ??
    (isSeries.value && recurrence.endMode === 'count' && !countValid.value ? COUNT_MESSAGE : ''),
)

const errorId = (key: FieldKey) => `ev-${key}-error`
const invalid = (key: FieldKey) => (fieldErrors[key] ? 'true' : undefined)
const describedBy = (key: FieldKey, hint?: string) => (fieldErrors[key] ? errorId(key) : hint)

// Один ключ на попытку создания серии: повтор того же запроса отправляет тот же ключ (сервер вернёт
// уже созданную серию), изменённый запрос получает новый (тот же ключ с другим телом — 409).
let attempt: { key: string; fingerprint: string } | null = null
function idempotencyKeyFor(body: unknown): string {
  const fingerprint = JSON.stringify(body)
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = { key: newIdempotencyKey(), fingerprint }
  }
  return attempt.key
}

async function submit() {
  if (saving.value || (props.canSubmit && !props.canSubmit())) return
  error.value = ''
  const split = form.priceMode === 'split'
  if ((modeLocked.value && form.priceMode !== i?.priceMode) || (split && splitUnavailable.value))
    return
  const amount = validate(split)
  if (amount === null) return
  if (submitDisabled.value) return
  saving.value = true
  try {
    let venueId = form.venueId || undefined
    if (addingVenue.value && form.newVenueName.trim()) {
      if (props.canSubmit && !props.canSubmit()) return
      const res = await $fetch<{ venue: Venue }>(`/api/organizations/${props.orgId}/venues`, {
        method: 'POST',
        body: { name: form.newVenueName.trim(), address: form.newVenueAddress.trim() || undefined },
      })
      venueId = res.venue.id
      // площадка создана: при повторе отправки используем её, а не заводим вторую
      venues.value = [...venues.value, res.venue]
      form.venueId = res.venue.id
      addingVenue.value = false
    }
    const startsAt = zonedInputToDate(form.startsAt, props.tz)
    const endsAt = new Date(startsAt.getTime() + Number(form.durationMin) * 60000)
    const common = {
      title: form.title.trim(),
      capacity: Number(form.capacity),
      priceMode: form.priceMode,
      price: split ? 0 : amount,
      targetAmount: split ? amount : null,
      venueId: venueId ?? (props.initial ? null : undefined),
      locationText: form.locationText.trim() || (props.initial ? null : undefined),
      description: form.description.trim() || (props.initial ? null : undefined),
    }
    if (props.canSubmit && !props.canSubmit()) return

    if (isSeries.value) {
      const template = {
        type: form.type,
        title: common.title,
        description: common.description ?? undefined,
        venueId: venueId ?? undefined,
        locationText: common.locationText ?? undefined,
        startTime: startTime.value,
        durationMinutes: Number(form.durationMin),
        capacity: common.capacity,
        priceMode: common.priceMode,
        price: common.price,
        targetAmount: common.targetAmount,
        closeBeforeMinutes: Number(form.closeBefore),
        ...(form.level ? { level: form.level } : {}),
        ...(joinOverridden.value ? { joinMode: form.joinMode } : {}),
      }
      const body = {
        rule: previewBody.value!.rule,
        exceptions: recurrence.exceptions,
        template,
      }
      const result = await $fetch<SeriesCreated>(`/api/organizations/${props.orgId}/series`, {
        method: 'POST',
        body: { ...body, idempotencyKey: idempotencyKeyFor(body) },
      })
      attempt = null
      if (!props.canSubmit || props.canSubmit()) emit('seriesCreated', result)
      return
    }

    const body: Record<string, unknown> = {
      ...common,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: form.publish ? 'published' : i?.status === 'closed' ? 'closed' : 'draft',
    }
    if (!i) {
      body.type = form.type
      if (form.level) body.level = form.level
      body.closeBeforeMinutes = Number(form.closeBefore)
      if (joinOverridden.value) body.joinMode = form.joinMode
    } else {
      if (form.joinMode !== i.joinMode) body.joinMode = form.joinMode
      if (Number(form.closeBefore) !== i.closeBeforeMinutes) {
        body.closeBeforeMinutes = Number(form.closeBefore)
      }
      if ((form.level || null) !== (i.level ?? null)) body.level = form.level || null
    }
    const res = props.initial
      ? await $fetch<{ event: Event }>(
          `/api/organizations/${props.orgId}/events/${props.initial.id}`,
          { method: 'PATCH', body },
        )
      : await $fetch<{ event: Event }>(`/api/organizations/${props.orgId}/events`, {
          method: 'POST',
          body,
        })
    if (!props.canSubmit || props.canSubmit()) emit('saved', res.event)
  } catch (e) {
    const code = apiErrorCode(e)
    // тот же ключ с другим запросом: следующая отправка должна получить новый ключ
    if (code === 'series.idempotency_conflict') attempt = null
    const message = apiErrorMessage(
      e,
      i ? 'Не удалось сохранить событие' : 'Не удалось создать событие',
    )
    // исход неизвестен (сеть, 5xx): запрос мог дойти до сервера
    const ambiguous = !code && !(apiErrorStatus(e) && (apiErrorStatus(e) as number) < 500)
    error.value = !i && ambiguous ? `${message}. Проверьте список событий перед повтором.` : message
  } finally {
    saving.value = false
  }
}

function resetJoinMode() {
  form.joinMode = groupJoinMode
}
const seatsText = computed(() => {
  const max = groupSettings.value?.maxSeatsPerBooking
  return max ? `Мест на игрока: до ${max} · меняется в настройках группы` : null
})
</script>

<template>
  <form class="vt-event-form space-y-4" novalidate @submit.prevent="submit">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div class="vt-card space-y-4 p-5">
        <h2 class="text-base font-bold text-vt-ink">Основное</h2>
        <div>
          <label class="vt-label" for="ev-title">Название</label>
          <input
            id="ev-title"
            v-model="form.title"
            class="vt-field"
            maxlength="200"
            :aria-invalid="invalid('title')"
            :aria-describedby="describedBy('title')"
          />
          <p
            v-if="fieldErrors.title"
            id="ev-title-error"
            class="mt-1 text-xs text-vt-rose-ink"
            role="alert"
          >
            {{ fieldErrors.title }}
          </p>
        </div>

        <div v-if="!initial">
          <span class="vt-label">Тип события</span>
          <VtSegment v-model="form.type" :options="typeOptions" label="Тип события" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="min-w-0">
            <label class="vt-label" for="ev-start">
              {{ isSeries ? 'Дата первого события и время начала' : 'Дата и время начала' }}
            </label>
            <input
              id="ev-start"
              v-model="form.startsAt"
              type="datetime-local"
              class="vt-field"
              :aria-invalid="invalid('start')"
              :aria-describedby="describedBy('start', `${uid}-tz`)"
            />
            <p
              v-if="fieldErrors.start"
              id="ev-start-error"
              class="mt-1 text-xs text-vt-rose-ink"
              role="alert"
            >
              {{ fieldErrors.start }}
            </p>
          </div>
          <div class="min-w-0">
            <span :id="`${uid}-dur`" class="vt-label">Длительность</span>
            <VtSelect
              v-model="durationValue"
              :options="durationOptions"
              :labelledby="`${uid}-dur`"
            />
          </div>
        </div>
        <p :id="`${uid}-tz`" class="-mt-2 text-xs text-vt-mute-2">
          Время в часовом поясе группы: {{ tz }}
        </p>

        <div>
          <template v-if="!addingVenue">
            <span :id="`${uid}-venue`" class="vt-label">Зал / площадка</span>
            <VtSelect v-model="venueValue" :options="venueOptions" :labelledby="`${uid}-venue`" />
          </template>
          <div v-else class="space-y-3">
            <div>
              <label class="vt-label" for="ev-new-venue-name">Название новой площадки</label>
              <input
                id="ev-new-venue-name"
                v-model="form.newVenueName"
                class="vt-field"
                :aria-invalid="invalid('venue')"
                :aria-describedby="describedBy('venue')"
              />
              <p
                v-if="fieldErrors.venue"
                id="ev-venue-error"
                class="mt-1 text-xs text-vt-rose-ink"
                role="alert"
              >
                {{ fieldErrors.venue }}
              </p>
            </div>
            <div>
              <label class="vt-label" for="ev-new-venue-address">Адрес новой площадки</label>
              <input id="ev-new-venue-address" v-model="form.newVenueAddress" class="vt-field" />
            </div>
          </div>
          <button
            type="button"
            class="mt-2 min-h-11 rounded-xl px-3 text-sm font-semibold text-vt-link focus-visible:outline-2 focus-visible:outline-offset-2"
            data-testid="toggle-venue"
            @click="addingVenue = !addingVenue"
          >
            {{ addingVenue ? 'Выбрать из списка' : '+ Новая площадка' }}
          </button>
        </div>

        <EventSeriesBlock
          v-if="seriesAllowed"
          v-model:freq="recurrence.freq"
          v-model:weekdays="recurrence.weekdays"
          v-model:end-mode="recurrence.endMode"
          v-model:span="recurrence.span"
          v-model:count="recurrence.count"
          v-model:exceptions="recurrence.exceptions"
          :preview="previewCurrent ? preview : null"
          :loading="previewLoading"
          :error="previewError"
          :count-error="countError"
          @update:weekdays="markWeekdaysTouched"
          @retry="retryPreview"
        />

        <div>
          <label class="vt-label" for="ev-desc">Описание</label>
          <textarea
            id="ev-desc"
            v-model="form.description"
            class="vt-field"
            rows="3"
            maxlength="2000"
          />
        </div>
      </div>

      <div class="space-y-4">
        <div class="vt-card space-y-4 p-5">
          <h2 class="text-base font-bold text-vt-ink">Состав и запись</h2>
          <div>
            <label class="vt-label" for="ev-cap">Основной состав — мест</label>
            <input
              id="ev-cap"
              v-model.number="form.capacity"
              type="number"
              min="1"
              max="500"
              class="vt-field vt-mono max-w-32"
              :aria-invalid="invalid('capacity')"
              :aria-describedby="describedBy('capacity', `${uid}-cap-hint`)"
            />
            <p
              v-if="fieldErrors.capacity"
              id="ev-capacity-error"
              class="mt-1 text-xs text-vt-rose-ink"
              role="alert"
            >
              {{ fieldErrors.capacity }}
            </p>
            <p :id="`${uid}-cap-hint`" class="mt-1 text-xs text-vt-mute-2">
              Сверх лимита — лист ожидания.
              <template v-if="seatsText">{{ seatsText }}</template>
            </p>
          </div>

          <div>
            <span class="vt-label">Тип оплаты</span>
            <VtSegment v-model="form.priceMode" :options="priceModeOptions" label="Тип оплаты" />
            <p v-if="modeLocked" class="mt-1 text-xs text-vt-mute-2">
              Тип оплаты зафиксирован: у события есть история записей или оно закрыто для изменений.
            </p>
            <p v-else-if="splitUnavailable" class="mt-1 text-xs text-vt-mute-2">
              Деление суммы пока недоступно для новых событий.
            </p>
          </div>

          <div v-if="form.priceMode === 'fixed'">
            <label class="vt-label" for="ev-price">Фиксированная цена, {{ currency }}</label>
            <input
              id="ev-price"
              v-model="form.priceMajor"
              inputmode="decimal"
              class="vt-field vt-mono"
              placeholder="0 — бесплатно"
              :aria-invalid="invalid('price')"
              :aria-describedby="describedBy('price', `${uid}-price-hint`)"
            />
            <p
              v-if="fieldErrors.price"
              id="ev-price-error"
              class="mt-1 text-xs text-vt-rose-ink"
              role="alert"
            >
              {{ fieldErrors.price }}
            </p>
            <p :id="`${uid}-price-hint`" class="mt-1 text-xs text-vt-mute-2">
              Цена за одно место. 0 — бесплатное событие.
              <template v-if="fixedTotal">
                При полном составе соберётся
                <b class="vt-mono text-vt-ink">{{ formatMoneyRu(fixedTotal, currency) }}</b
                >.
              </template>
            </p>
          </div>
          <div v-else>
            <label class="vt-label" for="ev-target">Общая сумма к сбору, {{ currency }}</label>
            <input
              id="ev-target"
              v-model="form.targetMajor"
              inputmode="decimal"
              class="vt-field vt-mono"
              placeholder="Например, 180,00"
              :disabled="targetLocked"
              :aria-invalid="invalid('target')"
              :aria-describedby="describedBy('target', 'ev-split-hint')"
            />
            <p
              v-if="fieldErrors.target"
              id="ev-target-error"
              class="mt-1 text-xs text-vt-rose-ink"
              role="alert"
            >
              {{ fieldErrors.target }}
            </p>
            <div id="ev-split-hint" class="mt-3 space-y-2 rounded-xl bg-vt-amber-soft p-3 text-sm">
              <p v-if="forecast" class="font-semibold tabular-nums">
                Прогноз за место при полном составе: ≈
                {{ formatMoneyRu(forecast.min, currency)
                }}<template v-if="forecast.max !== forecast.min">
                  – {{ formatMoneyRu(forecast.max, currency) }}</template
                >
              </p>
              <p class="text-vt-mute-2">
                Точная сумма распределится после ручного закрытия записи. Оплата наличными или
                переводом. Абонементы в этом режиме недоступны. Из-за округления доли могут
                отличаться на одну копейку.
              </p>
              <p v-if="targetLocked" class="text-vt-mute-2">
                Общая сумма зафиксирована и больше не меняется.
              </p>
            </div>
          </div>
          <p v-if="subscriptionsEnabled !== undefined" class="text-xs text-vt-mute-2">
            {{
              subscriptionsEnabled
                ? 'Абонементы включены в настройках группы'
                : 'Абонементы отключены в настройках группы'
            }}. У события нет отдельной настройки абонементов.
          </p>

          <div>
            <span class="vt-label">Запись</span>
            <VtSegment
              v-model="form.joinMode"
              :options="joinModeOptions"
              label="Запись на событие"
            />
            <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-vt-mute-2">
              <template v-if="joinOverridden">
                <span class="vt-chip vt-chip--amber">только для этого события</span>
                <button
                  type="button"
                  class="min-h-11 rounded-xl px-2 font-semibold text-vt-link focus-visible:outline-2 focus-visible:outline-offset-2"
                  @click="resetJoinMode"
                >
                  Вернуть как в группе
                </button>
              </template>
              <template v-else-if="groupSettings">
                Как в настройках группы:
                {{ groupJoinMode === 'invite' ? 'по приглашению' : 'свободная запись' }}.
              </template>
            </p>
          </div>

          <div v-if="levelOptions.length > 1">
            <span class="vt-label">Уровень игроков</span>
            <VtSelect v-model="form.level" :options="levelOptions" label="Уровень игроков" />
          </div>

          <div>
            <span class="vt-label">Запись закрывается</span>
            <VtSegment
              v-model="form.closeBefore"
              :options="closeBeforeOptions"
              label="Запись закрывается"
              variant="chips"
              :aria-describedby="`${uid}-close-hint`"
            />
            <p :id="`${uid}-close-hint`" class="mt-1 text-xs text-vt-mute-2">
              Автоматически, за выбранное время до начала события.
            </p>
            <p
              v-if="closeMomentPassed"
              class="mt-1 text-xs font-semibold text-vt-ink"
              role="status"
              data-testid="close-passed-note"
            >
              Момент закрытия уже прошёл — запись закроете вручную
            </p>
          </div>

          <p id="ev-cancellation-policy" class="text-xs text-vt-mute-2">
            {{ cancellationPolicyText }}
          </p>
        </div>

        <div
          v-if="balanceNote"
          :id="`${uid}-balance`"
          data-testid="balance-note"
          class="flex gap-3 rounded-2xl p-4 text-sm"
          :class="balanceNote.tone === 'warning' ? 'bg-vt-amber-soft' : 'bg-vt-bone'"
          role="status"
        >
          <VtIcon name="ticket" :size="16" />
          <p>{{ balanceNote.text }}</p>
        </div>

        <div v-if="!isSeries" class="vt-card flex items-start gap-3 p-4 text-sm">
          <VtToggle v-model="form.publish" :labelledby="`${uid}-publish`" />
          <span :id="`${uid}-publish`">
            <template v-if="initial?.status === 'closed'">
              Опубликовать снова
              <span class="text-vt-mute-2">(иначе событие останется закрытым)</span>
            </template>
            <template v-else>
              Опубликовать сразу
              <span class="text-vt-mute-2">(иначе черновик виден только организаторам)</span>
            </template>
          </span>
        </div>
      </div>
    </div>

    <p v-if="error" id="ev-form-error" class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
    <button
      type="submit"
      class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
      :disabled="submitDisabled"
    >
      {{ submitText }}
    </button>
  </form>
</template>
