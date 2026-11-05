<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import SettingsField from './SettingsField.vue'

import VtAlert from '~/components/vt/Alert.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtPopover, { type VtPopoverItem } from '~/components/vt/Popover.vue'
import { apiErrorMessage } from '~/utils/api-error'

/**
 * Залы группы (W-11, 21.2.13): список, добавление, правка, «На карте», удаление. Зал с событиями
 * при «Удалить» уходит в архив (прошлые события сохраняют зал), без событий удаляется.
 * Доступно владельцу и организатору.
 */
interface VenueRow {
  id: number
  name: string
  address: string | null
  status?: 'active' | 'archived'
}

const props = defineProps<{ orgId: number; canManage: boolean }>()
const emit = defineEmits<{ toast: [message: string, tone: 'ok' | 'danger'] }>()

const venues = ref<VenueRow[]>([])
const loading = ref(true)
const loadError = ref('')
/** `null` — форма закрыта, `'new'` — добавление, число — правка зала с этим id. */
const formFor = ref<'new' | number | null>(null)
const name = ref('')
const address = ref('')
const nameError = ref('')
const formError = ref('')
const saving = ref(false)
const menuOpenId = ref<number | null>(null)
const deleting = ref<VenueRow | null>(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)

const base = computed(() => `/api/organizations/${props.orgId}/venues`)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const url = props.canManage ? `${base.value}?includeArchived=true` : base.value
    const data = await $fetch<{ venues: VenueRow[] }>(url)
    venues.value = data.venues
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить залы')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function closeForm() {
  formFor.value = null
  name.value = ''
  address.value = ''
  nameError.value = ''
  formError.value = ''
}

function startEdit(venue: VenueRow) {
  closeForm()
  formFor.value = venue.id
  name.value = venue.name
  address.value = venue.address ?? ''
}

async function submit() {
  if (saving.value || formFor.value === null) return
  nameError.value = name.value.trim() ? '' : 'Укажите название зала'
  formError.value = ''
  if (nameError.value) return
  saving.value = true
  const editingId = formFor.value === 'new' ? null : formFor.value
  try {
    if (editingId === null) {
      const body: { name: string; address?: string } = { name: name.value.trim() }
      if (address.value.trim()) body.address = address.value.trim()
      const data = await $fetch<{ venue: VenueRow }>(base.value, { method: 'POST', body })
      venues.value = [...venues.value, data.venue]
      emit('toast', 'Зал добавлен', 'ok')
    } else {
      const data = await $fetch<{ venue: VenueRow }>(`${base.value}/${editingId}`, {
        method: 'PATCH',
        body: { name: name.value.trim(), address: address.value.trim() || null },
      })
      venues.value = venues.value.map((v) => (v.id === editingId ? data.venue : v))
      emit('toast', 'Зал сохранён', 'ok')
    }
    closeForm()
  } catch (cause) {
    formError.value = apiErrorMessage(
      cause,
      editingId === null ? 'Не удалось добавить зал' : 'Не удалось сохранить зал',
    )
  } finally {
    saving.value = false
  }
}

function menuItems(venue: VenueRow): VtPopoverItem[] {
  const items: VtPopoverItem[] = [
    { key: 'edit', label: 'Редактировать' },
    {
      key: 'map',
      label: 'На карте',
      disabled: !venue.address,
      hint: venue.address ? undefined : 'Адрес не указан',
    },
  ]
  if (venue.status !== 'archived') {
    items.push({ key: 'delete', label: 'Удалить', tone: 'danger', separator: true })
  }
  return items
}

/** Адрес открывается во внешней карте: геокодирования и карты в приложении нет. */
function mapUrl(venue: VenueRow): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(venue.address ?? venue.name)}`
}

function onSelect(venue: VenueRow, item: VtPopoverItem) {
  if (item.key === 'edit') startEdit(venue)
  else if (item.key === 'map') window.open(mapUrl(venue), '_blank', 'noopener,noreferrer')
  else if (item.key === 'delete') {
    deleting.value = venue
    deleteOpen.value = true
  }
}

async function confirmDelete() {
  const venue = deleting.value
  if (!venue || deleteBusy.value) return
  deleteBusy.value = true
  try {
    const res = await $fetch<{ outcome: 'deleted' | 'archived'; venue: VenueRow }>(
      `${base.value}/${venue.id}`,
      { method: 'DELETE' },
    )
    venues.value =
      res.outcome === 'deleted'
        ? venues.value.filter((v) => v.id !== venue.id)
        : venues.value.map((v) => (v.id === venue.id ? res.venue : v))
    emit(
      'toast',
      res.outcome === 'deleted' ? 'Зал удалён' : 'Зал в архиве: прошлые события сохранены',
      'ok',
    )
  } catch (cause) {
    emit('toast', apiErrorMessage(cause, 'Не удалось удалить зал'), 'danger')
  } finally {
    deleteBusy.value = false
    deleting.value = null
  }
}
</script>

<template>
  <section class="vt-card vt-settings-card">
    <div class="vt-settings-card__head">
      <h2 class="vt-settings-card__title">Залы и площадки</h2>
      <button
        v-if="canManage && formFor === null"
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        @click="formFor = 'new'"
      >
        Добавить зал
      </button>
    </div>
    <p class="vt-settings-hint">
      Залы выбираются при создании события и показываются игрокам в карточке события.
    </p>

    <form
      v-if="formFor !== null"
      class="vt-settings-venue-form"
      novalidate
      @submit.prevent="submit"
    >
      <SettingsField
        v-slot="{ id, describedby, invalid }"
        label="Название зала"
        hint="Например, «Школа №24, малый зал»."
        :error="nameError"
      >
        <input
          :id="id"
          v-model="name"
          class="vt-field"
          maxlength="200"
          :aria-describedby="describedby"
          :aria-invalid="invalid"
          :disabled="saving"
        />
      </SettingsField>
      <SettingsField
        v-slot="{ id, describedby }"
        label="Адрес"
        hint="Показывается игрокам рядом с названием зала."
      >
        <input
          :id="id"
          v-model="address"
          class="vt-field"
          maxlength="500"
          :aria-describedby="describedby"
          :disabled="saving"
        />
      </SettingsField>
      <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
        {{ formError }}
      </p>
      <div class="vt-settings-actions">
        <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="closeForm">
          Отмена
        </button>
        <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="saving">
          {{
            formFor === 'new'
              ? saving
                ? 'Добавляем…'
                : 'Добавить'
              : saving
                ? 'Сохраняем…'
                : 'Сохранить'
          }}
        </button>
      </div>
    </form>

    <p v-if="loading" role="status" class="vt-settings-hint">Загружаем залы…</p>
    <div v-else-if="loadError" class="vt-settings-load-error">
      <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="load">Повторить</button>
    </div>
    <p v-else-if="venues.length === 0" class="vt-settings-hint">
      Залов пока нет. Добавьте первый, чтобы выбирать его в событиях.
    </p>
    <ul v-else class="vt-settings-list">
      <li
        v-for="venue in venues"
        :key="venue.id"
        class="vt-settings-list__item vt-settings-venue"
        :data-archived="venue.status === 'archived' ? 'true' : undefined"
      >
        <span class="vt-settings-venue__pin" aria-hidden="true"
          ><VtIcon name="pin" :size="18"
        /></span>
        <span class="vt-settings-venue__text">
          <span class="vt-settings-row__title">
            {{ venue.name }}
            <span v-if="venue.status === 'archived'" class="vt-chip vt-chip--amber">В архиве</span>
          </span>
          <span v-if="venue.address" class="vt-settings-hint">{{ venue.address }}</span>
        </span>
        <VtPopover
          v-if="canManage"
          :model-value="menuOpenId === venue.id"
          align="right"
          :label="`Действия: ${venue.name}`"
          :items="menuItems(venue)"
          @update:model-value="(v: boolean) => (menuOpenId = v ? venue.id : null)"
          @select="(item) => onSelect(venue, item)"
        >
          <template #trigger="{ toggle, attrs }">
            <button
              type="button"
              v-bind="attrs"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :aria-label="`Действия с залом «${venue.name}»`"
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
      :title="`Удалить зал «${deleting?.name ?? ''}»?`"
      body="Если в зале проходили или запланированы события, он уйдёт в архив: исчезнет из выбора при создании события, а прошлые события сохранят его название. Зал без событий будет удалён."
      confirm-label="Удалить"
      danger
      @confirm="confirmDelete"
    />
  </section>
</template>
