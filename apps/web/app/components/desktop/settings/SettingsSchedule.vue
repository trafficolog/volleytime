<script setup lang="ts">
import { computed, onMounted, reactive, ref, useId } from 'vue'

import SettingsField from './SettingsField.vue'

import VtAlert from '~/components/vt/Alert.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtPopover, { type VtPopoverItem } from '~/components/vt/Popover.vue'
import VtSegment from '~/components/vt/Segment.vue'
import VtSelect from '~/components/vt/Select.vue'
import { apiErrorMessage } from '~/utils/api-error'
import { WEEKDAYS } from '~/utils/event-series'
import {
  SLOT_DEFAULTS,
  SLOT_TYPE_OPTIONS,
  slotRequestBody,
  validateSlotForm,
  weekdayShort,
  type ScheduleSlotView,
  type SlotFormErrors,
  type SlotFormValues,
} from '~/utils/schedule-slots'

/**
 * Расписание по умолчанию (W-11, 21.2.12): регулярные слоты группы — день недели, время, формат,
 * зал, места. Слот только подставляется в форму создания события и серии; события по расписанию
 * не создаются и баланс не списывается. Доступно владельцу и организатору.
 */
interface VenueOption {
  id: number
  name: string
}

const props = defineProps<{ orgId: number; canManage: boolean }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const uid = useId()
const slots = ref<ScheduleSlotView[]>([])
const venues = ref<VenueOption[]>([])
const loading = ref(true)
const loadError = ref('')
/** `null` — форма закрыта, `'new'` — добавление, число — правка слота с этим id. */
const formFor = ref<'new' | number | null>(null)
const form = reactive<SlotFormValues>(emptyForm())
const errors = ref<SlotFormErrors>({})
const formError = ref('')
const saving = ref(false)
const menuOpenId = ref<number | null>(null)
const deleting = ref<ScheduleSlotView | null>(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)

const base = computed(() => `/api/organizations/${props.orgId}/schedule-slots`)

function emptyForm(): SlotFormValues {
  return {
    weekday: 1,
    startTime: '20:00',
    title: '',
    type: SLOT_DEFAULTS.type,
    durationMinutes: SLOT_DEFAULTS.durationMinutes,
    capacity: String(SLOT_DEFAULTS.capacity),
    venueId: '',
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [slotData, venueData] = await Promise.all([
      $fetch<{ slots: ScheduleSlotView[] }>(base.value),
      // сбой списка залов не мешает слотам: зал в форме тогда просто не выбрать
      $fetch<{ venues: VenueOption[] }>(`/api/organizations/${props.orgId}/venues`).catch(() => ({
        venues: [] as VenueOption[],
      })),
    ])
    slots.value = slotData.slots
    venues.value = venueData.venues
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить расписание')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function closeForm() {
  formFor.value = null
  Object.assign(form, emptyForm())
  errors.value = {}
  formError.value = ''
}

function startNew() {
  closeForm()
  formFor.value = 'new'
}

function startEdit(slot: ScheduleSlotView) {
  closeForm()
  formFor.value = slot.id
  Object.assign(form, {
    weekday: slot.weekday,
    startTime: slot.startTime,
    title: slot.title,
    type: slot.type,
    durationMinutes: slot.durationMinutes,
    capacity: String(slot.capacity),
    venueId: slot.venueId === null ? '' : String(slot.venueId),
  } satisfies SlotFormValues)
}

const weekdayOptions = WEEKDAYS.map((d) => ({ value: String(d.value), label: d.short }))
const weekdayValue = computed({
  get: () => String(form.weekday),
  set: (v: string) => (form.weekday = Number(v)),
})
function durationLabel(m: number): string {
  if (m < 60) return `${m} мин`
  return m % 60 === 0 ? `${m / 60} ч` : `${Math.floor(m / 60)} ч ${m % 60} мин`
}
const durationOptions = computed(() => {
  const base = [60, 90, 120, 150, 180]
  const minutes = base.includes(form.durationMinutes)
    ? base
    : [...base, form.durationMinutes].sort((a, b) => a - b)
  return minutes.map((m) => ({
    value: String(m),
    label: durationLabel(m),
  }))
})
const durationValue = computed({
  get: () => String(form.durationMinutes),
  set: (v: string) => (form.durationMinutes = Number(v)),
})
/** Архивный зал редактируемого слота остаётся в списке, пока его не заменят. */
const venueOptions = computed(() => {
  const editing = slots.value.find((s) => s.id === formFor.value)
  const options = [
    { value: '', label: 'Не указан' },
    ...venues.value.map((v) => ({ value: String(v.id), label: v.name })),
  ]
  if (editing?.venueId && !venues.value.some((v) => v.id === editing.venueId)) {
    options.push({
      value: String(editing.venueId),
      label: `${editing.venueName ?? 'Зал'} (архив)`,
    })
  }
  return options
})
const typeValue = computed({
  get: () => form.type,
  set: (v: string) => (form.type = v as SlotFormValues['type']),
})

async function submit() {
  if (saving.value || formFor.value === null) return
  errors.value = validateSlotForm(form)
  formError.value = ''
  if (Object.keys(errors.value).length > 0) return
  saving.value = true
  const editingId = formFor.value === 'new' ? null : formFor.value
  try {
    const body = slotRequestBody(form)
    if (editingId === null) {
      const data = await $fetch<{ slot: ScheduleSlotView }>(base.value, { method: 'POST', body })
      slots.value = sortSlots([...slots.value, data.slot])
      emit('toast', 'Слот добавлен', 'ok')
    } else {
      const data = await $fetch<{ slot: ScheduleSlotView }>(`${base.value}/${editingId}`, {
        method: 'PATCH',
        body,
      })
      slots.value = sortSlots(slots.value.map((s) => (s.id === editingId ? data.slot : s)))
      emit('toast', 'Расписание сохранено', 'ok')
    }
    closeForm()
  } catch (cause) {
    formError.value = apiErrorMessage(
      cause,
      editingId === null ? 'Не удалось добавить слот' : 'Не удалось сохранить слот',
    )
  } finally {
    saving.value = false
  }
}

function sortSlots(list: ScheduleSlotView[]): ScheduleSlotView[] {
  return [...list].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.id - b.id,
  )
}

const menuItems: VtPopoverItem[] = [
  { key: 'edit', label: 'Изменить' },
  { key: 'delete', label: 'Удалить слот', tone: 'danger', separator: true },
]

function onSelect(slot: ScheduleSlotView, item: VtPopoverItem) {
  if (item.key === 'edit') startEdit(slot)
  else if (item.key === 'delete') {
    deleting.value = slot
    deleteOpen.value = true
  }
}

async function confirmDelete() {
  const slot = deleting.value
  if (!slot || deleteBusy.value) return
  deleteBusy.value = true
  try {
    await $fetch(`${base.value}/${slot.id}`, { method: 'DELETE' })
    slots.value = slots.value.filter((s) => s.id !== slot.id)
    if (formFor.value === slot.id) closeForm()
    emit('toast', 'Слот удалён', 'ok')
  } catch (cause) {
    emit('toast', apiErrorMessage(cause, 'Не удалось удалить слот'), 'danger')
  } finally {
    deleteBusy.value = false
    deleting.value = null
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card">
    <div class="vt-settings-card__head">
      <h2 class="vt-settings-card__title">Шаблоны расписания</h2>
      <button
        v-if="canManage && formFor === null"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        @click="startNew"
      >
        <VtIcon name="plus" :size="13" /> Добавить слот
      </button>
    </div>
    <p class="vt-settings-hint">
      Регулярные слоты группы. При создании события или серии выберите слот: день, время, формат,
      зал и места подставятся в форму. События сами не создаются и баланс не списывается.
    </p>

    <form
      v-if="formFor !== null"
      class="vt-settings-venue-form"
      novalidate
      @submit.prevent="submit"
    >
      <div class="vt-settings-field">
        <span class="vt-label">День недели</span>
        <VtSegment
          v-model="weekdayValue"
          variant="chips"
          label="День недели"
          :options="weekdayOptions"
        />
        <p class="vt-settings-hint">
          В какой день проходит тренировка. В форме события подставится ближайший такой день.
        </p>
      </div>
      <div class="vt-settings-grid">
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Время начала"
          hint="По часам группы. Подставляется как время начала события."
          :error="errors.startTime"
        >
          <input
            :id="id"
            v-model="form.startTime"
            class="vt-field vt-mono"
            type="time"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="saving"
          />
        </SettingsField>
        <div class="vt-settings-field">
          <span :id="`${uid}-duration`" class="vt-label">Длительность</span>
          <VtSelect
            v-model="durationValue"
            :labelledby="`${uid}-duration`"
            :options="durationOptions"
            :disabled="saving"
          />
          <p class="vt-settings-hint">От начала до конца события.</p>
          <p class="vt-settings-error" role="alert">{{ errors.durationMinutes }}</p>
        </div>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Название"
          hint="Например, «Основа» или «Открытая игра». Станет названием события."
          :error="errors.title"
        >
          <input
            :id="id"
            v-model="form.title"
            class="vt-field"
            maxlength="200"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="saving"
          />
        </SettingsField>
        <div class="vt-settings-field">
          <span :id="`${uid}-type`" class="vt-label">Формат</span>
          <VtSelect
            v-model="typeValue"
            :labelledby="`${uid}-type`"
            :options="SLOT_TYPE_OPTIONS"
            :disabled="saving"
          />
          <p class="vt-settings-hint">Тип события в списке и в карточке игрока.</p>
        </div>
        <div class="vt-settings-field">
          <span :id="`${uid}-venue`" class="vt-label">Зал</span>
          <VtSelect
            v-model="form.venueId"
            :labelledby="`${uid}-venue`"
            :options="venueOptions"
            :disabled="saving"
          />
          <p class="vt-settings-hint">
            Только активные залы из раздела «Залы и площадки». Архивный зал выбрать нельзя.
          </p>
        </div>
        <SettingsField
          v-slot="{ id, describedby, invalid }"
          label="Мест"
          hint="Вместимость события, от 1 до 500."
          :error="errors.capacity"
        >
          <input
            :id="id"
            v-model="form.capacity"
            class="vt-field vt-mono"
            inputmode="numeric"
            :aria-describedby="describedby"
            :aria-invalid="invalid"
            :disabled="saving"
          />
        </SettingsField>
      </div>
      <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
        {{ formError }}
      </p>
      <div class="vt-settings-actions">
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="closeForm">
          Отмена
        </button>
        <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="saving">
          {{ saving ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </div>
    </form>

    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем расписание…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <p v-else-if="slots.length === 0" class="vt-settings-hint">
      Слотов пока нет. Добавьте первый, чтобы создавать события по расписанию в один шаг.
    </p>
    <ul v-else class="vt-settings-list">
      <li v-for="slot in slots" :key="slot.id" class="vt-settings-list__item vt-settings-slot">
        <span class="vt-chip vt-chip--solid">{{ weekdayShort(slot.weekday) }}</span>
        <span class="vt-mono vt-settings-slot__time">{{ slot.startTime }}</span>
        <span class="vt-settings-slot__text">
          <span class="vt-settings-row__title">{{ slot.title }}</span>
          <span class="vt-settings-hint">
            Мест: {{ slot.capacity }}
            <template v-if="slot.venueName">
              ·
              {{ slot.venueName }}
              <span v-if="slot.venueArchived" class="vt-chip vt-chip--amber">В архиве</span>
            </template>
          </span>
        </span>
        <VtPopover
          v-if="canManage"
          :model-value="menuOpenId === slot.id"
          align="right"
          :label="`Действия: ${slot.title}`"
          :items="menuItems"
          @update:model-value="(v: boolean) => (menuOpenId = v ? slot.id : null)"
          @select="(item) => onSelect(slot, item)"
        >
          <template #trigger="{ toggle, attrs }">
            <button
              type="button"
              v-bind="attrs"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :aria-label="`Действия со слотом «${slot.title}», ${weekdayShort(slot.weekday)} ${slot.startTime}`"
              @click="toggle"
            >
              <VtIcon name="more" :size="16" />
            </button>
          </template>
        </VtPopover>
      </li>
    </ul>

    <VtAlert
      v-model="deleteOpen"
      :title="`Удалить слот «${deleting?.title ?? ''}»?`"
      body="Удаляется только шаблон. События и серии, уже созданные по нему, останутся."
      confirm-label="Удалить"
      danger
      @confirm="confirmDelete"
    />
  </section>
</template>
