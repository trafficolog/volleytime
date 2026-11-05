<script setup lang="ts">
import {
  buildCollectionPatch,
  collectionDeadlineDay,
  collectionTargetInput,
  COLLECTION_ICON_KEYS,
  COLLECTION_ICON_META,
  type DesktopCollection,
} from '~/utils/desktop-collections'

/**
 * Правка сбора (W-08, 21.2.23): название, описание, иконка, цель и дедлайн через
 * `PATCH …/collections/{id}`. Статус здесь не меняется («Опубликовать» — отдельное действие).
 */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{ orgId: number; collection: DesktopCollection | null; tz: string }>()
const emit = defineEmits<{ saved: [collection: DesktopCollection] }>()

const form = reactive({ title: '', description: '', icon: 'ball', target: '', deadline: '' })
const errors = reactive({ title: '', target: '', deadline: '' })
const formError = ref('')
const busy = ref(false)
let initialDay = ''
let alive = true
onBeforeUnmount(() => {
  alive = false
})

watch(
  () => [open.value, props.collection?.id] as const,
  ([isOpen]) => {
    const c = props.collection
    if (!isOpen || !c) return
    initialDay = collectionDeadlineDay(c.deadlineAt, props.tz)
    form.title = c.title
    form.description = c.description ?? ''
    form.icon = c.icon
    form.target = collectionTargetInput(c.targetAmount)
    form.deadline = initialDay
    errors.title = errors.target = errors.deadline = formError.value = ''
  },
  { immediate: true },
)

async function save() {
  const c = props.collection
  if (!c || busy.value) return
  const built = buildCollectionPatch(form, initialDay, props.tz)
  errors.title = built.ok ? '' : (built.errors.title ?? '')
  errors.target = built.ok ? '' : (built.errors.target ?? '')
  errors.deadline = built.ok ? '' : (built.errors.deadline ?? '')
  formError.value = ''
  if (!built.ok) return
  busy.value = true
  try {
    const result = await $fetch<{ collection: DesktopCollection }>(
      `/api/organizations/${props.orgId}/collections/${c.id}`,
      { method: 'PATCH', body: built.body },
    )
    if (!alive) return
    open.value = false
    emit('saved', result.collection)
  } catch (cause) {
    if (alive) formError.value = apiErrorMessage(cause, 'Не удалось сохранить сбор')
  } finally {
    if (alive) busy.value = false
  }
}
</script>

<template>
  <VtSheet id="vt-collection-edit" v-model="open" title="Изменить сбор">
    <form class="vt-desktop-collections-edit space-y-4" novalidate @submit.prevent="save">
      <fieldset>
        <legend class="vt-label">Иконка</legend>
        <div role="radiogroup" aria-label="Иконка сбора" class="flex gap-2">
          <button
            v-for="key in COLLECTION_ICON_KEYS"
            :key="key"
            type="button"
            role="radio"
            :aria-checked="form.icon === key"
            :aria-label="COLLECTION_ICON_META[key].label"
            :title="COLLECTION_ICON_META[key].label"
            class="vt-desktop-collections-form__icon"
            :class="{ 'is-selected': form.icon === key }"
            :disabled="busy"
            @click="form.icon = key"
          >
            <DesktopCollectionIcon :name="key" :size="40" />
          </button>
        </div>
      </fieldset>
      <div>
        <label class="vt-label" for="collection-edit-title">Название</label>
        <input
          id="collection-edit-title"
          v-model="form.title"
          class="vt-field"
          maxlength="120"
          :aria-invalid="errors.title ? 'true' : undefined"
          :disabled="busy"
        />
        <p v-if="errors.title" class="text-vt-rose-ink" role="alert">{{ errors.title }}</p>
      </div>
      <div>
        <label class="vt-label" for="collection-edit-description">Описание</label>
        <textarea
          id="collection-edit-description"
          v-model="form.description"
          class="vt-field"
          rows="3"
          maxlength="2000"
          :disabled="busy"
        />
      </div>
      <div>
        <label class="vt-label" for="collection-edit-target"
          >Целевая сумма, {{ collection?.currency }}</label
        >
        <input
          id="collection-edit-target"
          v-model="form.target"
          class="vt-field vt-mono"
          inputmode="decimal"
          placeholder="Без цели"
          :aria-invalid="errors.target ? 'true' : undefined"
          :disabled="busy"
        />
        <p v-if="errors.target" class="text-vt-rose-ink" role="alert">{{ errors.target }}</p>
      </div>
      <div>
        <label class="vt-label" for="collection-edit-deadline">Дедлайн</label>
        <input
          id="collection-edit-deadline"
          v-model="form.deadline"
          class="vt-field"
          type="date"
          :aria-invalid="errors.deadline ? 'true' : undefined"
          :disabled="busy"
        />
        <p v-if="errors.deadline" class="text-vt-rose-ink" role="alert">{{ errors.deadline }}</p>
      </div>
      <p v-if="formError" class="text-vt-rose-ink" role="alert">{{ formError }}</p>
      <div class="vt-desktop-members__actions">
        <button type="button" class="vt-btn vt-btn--ghost" :disabled="busy" @click="open = false">
          Отмена
        </button>
        <button type="submit" class="vt-btn vt-btn--primary" :disabled="busy">
          {{ busy ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </div>
    </form>
  </VtSheet>
</template>
