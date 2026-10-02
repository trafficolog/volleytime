<script setup lang="ts">
import type { Event, Venue } from '@volley-time/db'
import {
  dateToZonedInput,
  previewSplitAmount,
  toMajor,
  toMinor,
  zonedInputToDate,
  type PricingPermissions,
} from '@volley-time/shared'

import { formatMoneyRu } from '~/utils/labels'

/** Форма «Новая тренировка» / редактирование (Task 5.13.19). Время — в TZ организации. */
const props = defineProps<{
  orgId: number
  tz: string
  initial?: Event | null
  submitLabel: string
  subscriptionsEnabled?: boolean
  canSubmit?: () => boolean
  currency?: string
  splitPricingEnabled?: boolean
  pricingPermissions?: PricingPermissions
}>()
const emit = defineEmits<{ saved: [event: Event] }>()

const venues = ref<Venue[]>([])
try {
  venues.value = (
    await $fetch<{ venues: Venue[] }>(`/api/organizations/${props.orgId}/venues`)
  ).venues
} catch {
  venues.value = []
}

const defaultStart = () => {
  const d = new Date(Date.now() + 86400_000)
  d.setMinutes(0, 0, 0)
  return dateToZonedInput(d, props.tz).replace(/T\d{2}:/, 'T19:')
}
const i = props.initial
const form = reactive({
  title: i?.title ?? 'Тренировка',
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
  priceMode: i?.priceMode ?? 'fixed',
  targetMajor: i?.targetAmount ? String(toMajor(i.targetAmount)) : '',
  cancellationDeadlineHours: (i?.cancellationDeadlineHours ?? 6) as number | '',
  description: i?.description ?? '',
  publish: i ? i.status === 'published' : true,
})
const addingVenue = ref(false)
const saving = ref(false)
const error = ref('')
const priceInput = ref<HTMLInputElement | null>(null)
const targetInput = ref<HTMLInputElement | null>(null)
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
const forecast = computed(() => {
  const target = amountMinor(form.targetMajor)
  if (!target || !Number.isInteger(form.capacity) || form.capacity < 1 || form.capacity > 500)
    return null
  return previewSplitAmount(target, 0, form.capacity)
})

async function submit() {
  if (saving.value || (props.canSubmit && !props.canSubmit())) return
  error.value = ''
  const split = form.priceMode === 'split'
  if ((modeLocked.value && form.priceMode !== i?.priceMode) || (split && splitUnavailable.value))
    return
  const amount = amountMinor(split ? form.targetMajor : form.priceMajor)
  if (amount === null || (split && amount < 1)) {
    error.value = split
      ? 'Введите общую сумму от 0,01 до 21 474 836,47 с двумя знаками после запятой'
      : 'Введите корректную цену: от 0 до 21 474 836,47 с двумя знаками после запятой'
    ;(split ? targetInput.value : priceInput.value)?.focus()
    return
  }
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
    }
    const startsAt = zonedInputToDate(form.startsAt, props.tz)
    const endsAt = new Date(startsAt.getTime() + Number(form.durationMin) * 60000)
    const body = {
      title: form.title.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      venueId: venueId ?? (props.initial ? null : undefined),
      locationText: form.locationText.trim() || (props.initial ? null : undefined),
      capacity: Number(form.capacity),
      priceMode: form.priceMode,
      price: split ? 0 : amount,
      targetAmount: split ? amount : null,
      cancellationDeadlineHours:
        form.cancellationDeadlineHours === '' ? null : Number(form.cancellationDeadlineHours),
      description: form.description.trim() || (props.initial ? null : undefined),
      status: form.publish ? 'published' : i?.status === 'closed' ? 'closed' : 'draft',
    }
    if (props.canSubmit && !props.canSubmit()) return
    const res = props.initial
      ? await $fetch<{ event: Event }>(
          `/api/organizations/${props.orgId}/events/${props.initial.id}`,
          {
            method: 'PATCH',
            body,
          },
        )
      : await $fetch<{ event: Event }>(`/api/organizations/${props.orgId}/events`, {
          method: 'POST',
          body,
        })
    if (!props.canSubmit || props.canSubmit()) emit('saved', res.event)
  } catch (e) {
    error.value = apiErrorMessage(e, 'Не удалось сохранить событие')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <fieldset class="space-y-3">
      <legend class="mb-3 text-base font-bold text-vt-ink">Основное</legend>
      <div>
        <label class="vt-label" for="ev-title">Название</label>
        <input
          id="ev-title"
          v-model="form.title"
          class="vt-field"
          required
          minlength="2"
          maxlength="200"
        />
      </div>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-3 text-base font-bold text-vt-ink">Время и место</legend>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="min-w-0">
          <label class="vt-label" for="ev-start">Начало</label>
          <input
            id="ev-start"
            v-model="form.startsAt"
            type="datetime-local"
            class="vt-field"
            required
          />
        </div>
        <div class="min-w-0">
          <label class="vt-label" for="ev-dur">Длительность</label>
          <select id="ev-dur" v-model.number="form.durationMin" class="vt-field">
            <option :value="60">1 час</option>
            <option :value="90">1,5 часа</option>
            <option :value="120">2 часа</option>
            <option :value="150">2,5 часа</option>
            <option :value="180">3 часа</option>
          </select>
        </div>
      </div>
      <p class="text-xs text-vt-mute-2">Время в часовом поясе группы: {{ tz }}</p>
      <div>
        <label v-if="!addingVenue" class="vt-label" for="ev-venue">Площадка</label>
        <select v-if="!addingVenue" id="ev-venue" v-model="form.venueId" class="vt-field">
          <option value="">Не указана</option>
          <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
        <div v-else class="space-y-3">
          <div>
            <label class="vt-label" for="ev-new-venue-name">Название новой площадки</label>
            <input id="ev-new-venue-name" v-model="form.newVenueName" class="vt-field" required />
          </div>
          <div>
            <label class="vt-label" for="ev-new-venue-address">Адрес новой площадки</label>
            <input id="ev-new-venue-address" v-model="form.newVenueAddress" class="vt-field" />
          </div>
        </div>
        <button
          type="button"
          class="mt-2 min-h-11 rounded-xl px-3 text-sm font-semibold text-vt-link focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="addingVenue = !addingVenue"
        >
          {{ addingVenue ? 'Выбрать из списка' : '+ Новая площадка' }}
        </button>
      </div>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-3 text-base font-bold text-vt-ink">Места и оплата</legend>
      <fieldset class="space-y-2">
        <legend class="vt-label">Тип оплаты</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="vt-card flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
            <input
              v-model="form.priceMode"
              class="vt-radio"
              type="radio"
              name="priceMode"
              value="fixed"
              :disabled="modeLocked"
            />
            <span>Фиксированная цена</span>
          </label>
          <label class="vt-card flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
            <input
              v-model="form.priceMode"
              class="vt-radio"
              type="radio"
              name="priceMode"
              value="split"
              :disabled="modeLocked || splitUnavailable"
            />
            <span>Делим общую сумму</span>
          </label>
        </div>
        <p v-if="modeLocked" class="text-xs text-vt-mute-2">
          Тип оплаты зафиксирован: у события есть история записей или оно закрыто для изменений.
        </p>
        <p v-else-if="splitUnavailable" class="text-xs text-vt-mute-2">
          Деление суммы пока недоступно для новых событий.
        </p>
      </fieldset>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="min-w-0">
          <label class="vt-label" for="ev-cap">Количество мест</label>
          <input
            id="ev-cap"
            v-model.number="form.capacity"
            type="number"
            min="1"
            max="500"
            class="vt-field"
            required
          />
        </div>
        <div v-if="form.priceMode === 'fixed'" class="min-w-0">
          <label class="vt-label" for="ev-price">Фиксированная цена, {{ currency }}</label>
          <input
            id="ev-price"
            ref="priceInput"
            v-model="form.priceMajor"
            inputmode="decimal"
            class="vt-field"
            :aria-invalid="error.includes('цену') ? 'true' : undefined"
            :aria-describedby="error.includes('цену') ? 'ev-form-error' : undefined"
            placeholder="0 — бесплатно"
          />
        </div>
        <div v-else class="min-w-0">
          <label class="vt-label" for="ev-target">Общая сумма к сбору, {{ currency }}</label>
          <input
            id="ev-target"
            ref="targetInput"
            v-model="form.targetMajor"
            inputmode="decimal"
            class="vt-field"
            :disabled="targetLocked"
            :aria-invalid="error.includes('общую сумму') ? 'true' : undefined"
            :aria-describedby="error.includes('общую сумму') ? 'ev-form-error' : 'ev-split-hint'"
            placeholder="Например, 180,00"
          />
        </div>
      </div>
      <p v-if="form.priceMode === 'fixed'" class="text-xs text-vt-mute-2">
        Цена за одно место. 0 — бесплатное событие.
      </p>
      <div v-else id="ev-split-hint" class="vt-card space-y-2 p-3 text-sm">
        <p v-if="forecast" class="font-semibold tabular-nums">
          Прогноз за место при полном составе: {{ formatMoneyRu(forecast.minAmount, currency)
          }}<template v-if="forecast.maxAmount !== forecast.minAmount">
            – {{ formatMoneyRu(forecast.maxAmount, currency) }}</template
          >
        </p>
        <p class="text-vt-mute-2">
          Точная сумма распределится после ручного закрытия записи. Оплата наличными или переводом.
          Абонементы в этом режиме недоступны.
        </p>
        <p v-if="targetLocked" class="text-vt-mute-2">
          Общая сумма зафиксирована и больше не меняется.
        </p>
      </div>
      <div v-if="subscriptionsEnabled !== undefined" class="vt-card p-3 text-sm">
        <p class="font-semibold text-vt-ink">Абонементы группы</p>
        <p class="mt-1 text-vt-mute-2">
          {{
            subscriptionsEnabled
              ? 'Абонементы включены в настройках группы'
              : 'Абонементы отключены в настройках группы'
          }}. У события нет отдельной настройки абонементов.
        </p>
      </div>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-3 text-base font-bold text-vt-ink">Дополнительно</legend>
      <div>
        <label class="vt-label" for="ev-deadline">Отмена записи — не позднее, чем за (часов)</label>
        <input
          id="ev-deadline"
          v-model="form.cancellationDeadlineHours"
          type="number"
          min="0"
          max="720"
          class="vt-field"
          placeholder="без ограничения"
        />
      </div>
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
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-3 text-base font-bold text-vt-ink">Публикация</legend>
      <label class="vt-card flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
        <input v-model="form.publish" type="checkbox" class="h-5 w-5 shrink-0" />
        <span v-if="initial?.status === 'closed'">
          Опубликовать снова
          <span class="text-vt-mute-2">(иначе событие останется закрытым)</span>
        </span>
        <span v-else>
          Опубликовать сразу
          <span class="text-vt-mute-2">(иначе черновик виден только организаторам)</span>
        </span>
      </label>
    </fieldset>
    <p v-if="error" id="ev-form-error" class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
    <button type="submit" class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" :disabled="saving">
      {{ saving ? 'Сохраняем…' : submitLabel }}
    </button>
  </form>
</template>
