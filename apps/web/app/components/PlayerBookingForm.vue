<script setup lang="ts">
import { computed, useId } from 'vue'

import { seatsLabel, type BookingMethodOption, type SeatPlan } from '~/utils/booking-seats'

/**
 * Содержимое листа записи (M-06, 20.4.5): число мест, согласие на частичную очередь, способ
 * оплаты либо шаги очереди. Без состояния записи: числа, способ и согласие живут на странице,
 * сервер повторно проверяет всё (лимиты, свободные места, `allowWaitlist`).
 */
const seats = defineModel<number>('seats', { required: true })
const consent = defineModel<boolean>('consent', { default: false })
const method = defineModel<string>('method', { default: '' })
const props = withDefaults(
  defineProps<{
    plan: SeatPlan
    maxSeats: number
    priceText: string | null
    priceNote?: string
    /** «За все места»: сумма из `GET …/price` (20.1.1); `null` — не показывать. */
    total?: string | null
    methods: BookingMethodOption[]
    /** Мест в очереди сейчас (для пояснения ветки очереди). */
    queued?: number
    /** Бесплатное событие: способа оплаты нет. */
    free?: boolean
    note?: string
    error?: string
    submitLabel: string
    submitTag?: string
    canSubmit: boolean
    submitting?: boolean
    /** В Telegram действие живёт на MainButton — собственную кнопку не рисуем. */
    showSubmit?: boolean
  }>(),
  {
    priceNote: '',
    total: null,
    queued: 0,
    free: false,
    note: '',
    error: '',
    submitTag: '',
    submitting: false,
    showSubmit: true,
  },
)
const emit = defineEmits<{ submit: [] }>()
const uid = useId()
const seatsTitleId = `${uid}-seats`
const consentTitleId = `${uid}-consent`
const methodTitleId = `${uid}-method`
const queueSteps = computed(() => [
  {
    icon: 'users' as const,
    title: 'Вы встанете в очередь',
    text:
      props.queued > 0
        ? `Сейчас в очереди ${seatsLabel(props.queued)}.`
        : 'Очередь пока пуста — вы будете первым.',
  },
  {
    icon: 'bell' as const,
    title: 'Придёт уведомление',
    text: 'Как только место освободится, мы предложим его первому в очереди.',
  },
  {
    icon: 'clock' as const,
    title: 'Подтвердить за 30 минут',
    text: 'Не успеете — предложение сгорит, и вы покинете очередь. Встать можно заново.',
  },
  {
    icon: 'wallet' as const,
    title: props.free ? 'Оплата не нужна' : 'Оплата — потом',
    text: props.free
      ? 'Событие бесплатное — платить не придётся.'
      : 'Сейчас ничего не списываем. Способ, который вы выберете ниже, сработает, когда вы получите место.',
  },
])
</script>

<template>
  <div class="space-y-4">
    <div v-if="priceText" class="vt-card p-3.5">
      <div class="vt-mono text-base break-words">{{ priceText }}</div>
      <p v-if="priceNote" class="text-xs text-vt-mute-2 mt-1.5">{{ priceNote }}</p>
    </div>

    <section v-if="maxSeats > 1" :aria-labelledby="seatsTitleId">
      <h3 :id="seatsTitleId" class="vt-cap text-vt-mute-2 mb-2.5 px-1">
        {{ plan.kind === 'queue' ? 'Сколько мест резервируете' : 'Сколько мест' }}
      </h3>
      <div class="vt-card p-3.5">
        <BookingSeatsStepper v-model="seats" :max="maxSeats" :disabled="submitting" />
        <div
          v-if="total"
          class="mt-3 pt-3 flex items-baseline justify-between border-t border-vt-stroke"
        >
          <span class="text-sm text-vt-mute-2">
            {{
              plan.kind === 'queue'
                ? 'Если получите места'
                : plan.kind === 'partial'
                  ? `К оплате за ${seatsLabel(plan.mainSeats)}`
                  : 'За все места'
            }}
          </span>
          <span class="vt-mono text-[15px] font-bold">{{ total }}</span>
        </div>
      </div>
    </section>

    <section
      v-if="plan.needsConsent"
      class="vt-card vt-card--warm p-3.5"
      role="group"
      :aria-labelledby="consentTitleId"
    >
      <p :id="consentTitleId" class="text-sm font-semibold">
        Свободно {{ seatsLabel(plan.mainSeats) }} из {{ plan.seats }}
      </p>
      <p class="text-xs text-vt-mute-2 mt-1">
        {{ seatsLabel(plan.mainSeats) }} вы займёте сразу, ещё
        {{ seatsLabel(plan.queueSeats) }} встанут в лист ожидания и перейдут к вам, если кто-то
        откажется. Без вашего согласия запись не отправится.
      </p>
      <div class="mt-3 flex items-center gap-3">
        <span :id="`${consentTitleId}-label`" class="flex-1 text-sm">
          Согласен: {{ seatsLabel(plan.queueSeats) }} — в очередь
        </span>
        <VtToggle
          v-model="consent"
          :labelledby="`${consentTitleId}-label`"
          :disabled="submitting"
        />
      </div>
    </section>

    <section v-if="plan.kind === 'queue'" aria-label="Как работает лист ожидания">
      <h3 class="vt-cap text-vt-mute-2 mb-2.5 px-1">Как это работает</h3>
      <ul class="vt-card divide-y divide-vt-stroke overflow-hidden">
        <li v-for="step in queueSteps" :key="step.title" class="flex items-start gap-3 p-3.5">
          <VtIcon :name="step.icon" :size="16" class="shrink-0 mt-0.5" />
          <div class="min-w-0">
            <div class="text-sm font-semibold">{{ step.title }}</div>
            <div class="text-xs text-vt-mute-2 mt-0.5">{{ step.text }}</div>
          </div>
        </li>
      </ul>
    </section>

    <fieldset v-if="methods.length" class="space-y-2 min-w-0" :aria-labelledby="methodTitleId">
      <legend :id="methodTitleId" class="vt-cap text-vt-mute-2 mb-2.5 px-1">Как оплатите</legend>
      <label
        v-for="m in methods"
        :key="m.id"
        class="vt-card flex items-center gap-3 p-3.5 cursor-pointer"
        :class="{ 'opacity-60': m.disabled }"
      >
        <input
          v-model="method"
          type="radio"
          class="vt-radio"
          name="booking-method"
          :value="m.id"
          :disabled="m.disabled || submitting"
        />
        <span class="flex-1 min-w-0">
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm font-semibold">{{ m.label }}</span>
            <span v-if="m.tag" class="vt-mono text-xs text-vt-mute-2 shrink-0">{{ m.tag }}</span>
          </span>
          <span class="block text-xs text-vt-mute-2 mt-1">{{ m.hint }}</span>
        </span>
      </label>
    </fieldset>

    <p v-if="note" class="vt-card flex items-start gap-2 p-3 text-xs text-vt-mute-2">
      <VtIcon name="bell" :size="14" class="shrink-0 mt-0.5" />
      <span>{{ note }}</span>
    </p>
    <p v-if="error" class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>

    <button
      v-if="showSubmit"
      type="button"
      class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full justify-between"
      :disabled="!canSubmit || submitting"
      @click="emit('submit')"
    >
      <span>{{ submitLabel }}</span>
      <span v-if="submitTag" class="vt-mono opacity-85">{{ submitTag }}</span>
    </button>
  </div>
</template>
