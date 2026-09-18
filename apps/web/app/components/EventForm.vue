<script setup lang="ts">
import type { Event, Venue } from '@volley-time/db'
import { dateToZonedInput, toMajor, toMinor, zonedInputToDate } from '@volley-time/shared'

/** Форма «Новая тренировка» / редактирование (Task 5.13.19). Время — в TZ организации. */
const props = defineProps<{
  orgId: number
  tz: string
  initial?: Event | null
  submitLabel: string
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
  cancellationDeadlineHours: (i?.cancellationDeadlineHours ?? 6) as number | '',
  description: i?.description ?? '',
  publish: i ? i.status !== 'draft' : true,
})
const addingVenue = ref(false)
const saving = ref(false)
const error = ref('')

async function submit() {
  saving.value = true
  error.value = ''
  try {
    let venueId = form.venueId || undefined
    if (addingVenue.value && form.newVenueName.trim()) {
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
      price: toMinor(Number(String(form.priceMajor).replace(',', '.')) || 0),
      cancellationDeadlineHours:
        form.cancellationDeadlineHours === '' ? null : Number(form.cancellationDeadlineHours),
      description: form.description.trim() || (props.initial ? null : undefined),
      status: form.publish ? 'published' : 'draft',
    }
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
    emit('saved', res.event)
  } catch (e) {
    error.value = apiErrorMessage(e, 'Не удалось сохранить событие')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
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
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="vt-label" for="ev-start">Начало</label>
        <input
          id="ev-start"
          v-model="form.startsAt"
          type="datetime-local"
          class="vt-field"
          required
        />
      </div>
      <div>
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
    <p class="text-[11px] text-vt-mute-2 -mt-2">Время в часовом поясе группы: {{ tz }}</p>

    <div>
      <label class="vt-label" for="ev-venue">Площадка</label>
      <select v-if="!addingVenue" id="ev-venue" v-model="form.venueId" class="vt-field">
        <option value="">Не указана</option>
        <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
      </select>
      <div v-else class="space-y-2">
        <input v-model="form.newVenueName" class="vt-field" placeholder="Название зала" />
        <input
          v-model="form.newVenueAddress"
          class="vt-field"
          placeholder="Адрес (необязательно)"
        />
      </div>
      <button
        type="button"
        class="text-xs font-semibold text-vt-flame mt-1.5"
        @click="addingVenue = !addingVenue"
      >
        {{ addingVenue ? 'Выбрать из списка' : '+ Новая площадка' }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="vt-label" for="ev-cap">Мест</label>
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
      <div>
        <label class="vt-label" for="ev-price">Цена, BYN</label>
        <input
          id="ev-price"
          v-model="form.priceMajor"
          inputmode="decimal"
          class="vt-field"
          placeholder="0 — бесплатно"
        />
      </div>
    </div>
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
    <label class="flex items-center gap-2 text-sm">
      <input v-model="form.publish" type="checkbox" class="w-4 h-4" />
      Опубликовать сразу (иначе черновик виден только организаторам)
    </label>
    <p v-if="error" class="text-sm text-vt-rose-ink" role="alert">{{ error }}</p>
    <button type="submit" class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" :disabled="saving">
      {{ saving ? 'Сохраняем…' : submitLabel }}
    </button>
  </form>
</template>
