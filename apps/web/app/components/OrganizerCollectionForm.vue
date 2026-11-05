<script setup lang="ts">
import {
  buildCollectionBody,
  COLLECTION_ICON_KEYS,
  COLLECTION_ICON_META,
} from '~/utils/desktop-collections'
import {
  buildCollectionPatch,
  deadlineInputValue,
  targetInputValue,
  type ManagedCollection,
} from '~/utils/organizer-collections'

/**
 * Форма сбора организатора (21.1.5, `OrgContribCreate`): создание и правка. Проверяет поля и отдаёт
 * готовое тело запроса; сам запрос и переход ведёт страница. Для правки уходят только изменённые
 * поля, «Кто видит сбор» есть только при создании (публикация черновика — отдельное действие).
 */
const props = defineProps<{
  mode: 'create' | 'edit'
  title: string
  back: string
  tz: string
  currency: string
  busy: boolean
  serverError: string
  collection?: ManagedCollection
}>()
const emit = defineEmits<{ submit: [body: Record<string, unknown>] }>()

const formId = 'organizer-collection-form'
const original = props.collection
const form = reactive({
  title: original?.title ?? '',
  description: original?.description ?? '',
  icon: original?.icon ?? 'ball',
  target: targetInputValue(original?.targetAmount ?? null),
  deadline: deadlineInputValue(original?.deadlineAt ?? null, props.tz),
  visibility: 'active' as 'active' | 'draft',
})
const errors = reactive({ title: '', target: '', deadline: '' })

const visibilityOptions = [
  { value: 'active', label: 'Вся группа', hint: 'Сразу виден игрокам' },
  { value: 'draft', label: 'Черновик', hint: 'Видят только организаторы' },
] as const

function submit() {
  if (props.busy) return
  const built =
    props.mode === 'create'
      ? buildCollectionBody(form, props.tz)
      : buildCollectionPatch(original!, form, props.tz)
  errors.title = built.ok ? '' : (built.errors.title ?? '')
  errors.target = built.ok ? '' : (built.errors.target ?? '')
  errors.deadline = built.ok ? '' : (built.errors.deadline ?? '')
  if (built.ok) emit('submit', built.body)
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader :title="title" :back="back">
      <template #right>
        <button
          type="submit"
          :form="formId"
          class="vt-hit-44 text-base font-semibold text-[var(--vt-flame-ink)]"
          :disabled="busy"
        >
          {{
            mode === 'create' ? (busy ? 'Создаём…' : 'Создать') : busy ? 'Сохраняем…' : 'Сохранить'
          }}
        </button>
      </template>
    </VtMiniHeader>
    <main class="px-4 pb-5 pt-3">
      <form :id="formId" class="flex flex-col gap-3.5" novalidate @submit.prevent="submit">
        <fieldset class="flex flex-col gap-1.5">
          <legend class="vt-label">Иконка</legend>
          <div role="radiogroup" aria-label="Иконка сбора" class="flex flex-wrap gap-2">
            <button
              v-for="key in COLLECTION_ICON_KEYS"
              :key="key"
              type="button"
              role="radio"
              :aria-checked="form.icon === key"
              :aria-label="COLLECTION_ICON_META[key].label"
              class="vt-hit-44 rounded-[14px] p-0.5"
              :class="form.icon === key ? 'outline outline-2 outline-vt-ink' : ''"
              :disabled="busy"
              @click="form.icon = key"
            >
              <VtCampaignIcon :name="key" :size="40" />
            </button>
          </div>
        </fieldset>

        <div>
          <label class="vt-label" for="mc-title">Название</label>
          <input
            id="mc-title"
            v-model="form.title"
            class="vt-field"
            maxlength="120"
            placeholder="Например, новый комплект мячей"
            :aria-invalid="errors.title ? 'true' : undefined"
            :aria-describedby="errors.title ? 'mc-title-error' : undefined"
            :disabled="busy"
          />
          <p v-if="errors.title" id="mc-title-error" class="mt-1 text-sm text-vt-rose-ink">
            {{ errors.title }}
          </p>
        </div>

        <div>
          <label class="vt-label" for="mc-description">Описание</label>
          <textarea
            id="mc-description"
            v-model="form.description"
            class="vt-field"
            rows="3"
            maxlength="2000"
            placeholder="Зачем собираем и на что пойдут деньги"
            :disabled="busy"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="vt-label" for="mc-target">Цель сбора</label>
            <div class="flex gap-1.5">
              <input
                id="mc-target"
                v-model="form.target"
                class="vt-field vt-mono min-w-0"
                inputmode="decimal"
                placeholder="Без цели"
                :aria-invalid="errors.target ? 'true' : undefined"
                :aria-describedby="errors.target ? 'mc-target-error' : undefined"
                :disabled="busy"
              />
              <span class="vt-field flex w-16 shrink-0 items-center justify-center">{{
                currency
              }}</span>
            </div>
            <p v-if="errors.target" id="mc-target-error" class="mt-1 text-sm text-vt-rose-ink">
              {{ errors.target }}
            </p>
          </div>
          <div>
            <label class="vt-label" for="mc-deadline">Дедлайн</label>
            <input
              id="mc-deadline"
              v-model="form.deadline"
              class="vt-field"
              type="date"
              :aria-invalid="errors.deadline ? 'true' : undefined"
              :aria-describedby="errors.deadline ? 'mc-deadline-error' : undefined"
              :disabled="busy"
            />
            <p v-if="errors.deadline" id="mc-deadline-error" class="mt-1 text-sm text-vt-rose-ink">
              {{ errors.deadline }}
            </p>
          </div>
        </div>
        <p class="-mt-2 px-1 text-[11px] text-vt-mute-2">
          Дедлайн — только напоминание в списке: сбор закрывается вручную.
        </p>

        <fieldset v-if="mode === 'create'" class="flex flex-col gap-1.5">
          <legend class="vt-label">Кто видит сбор</legend>
          <div class="flex gap-1.5">
            <label
              v-for="option in visibilityOptions"
              :key="option.value"
              class="vt-btn vt-btn--sm flex-1 cursor-pointer flex-col !items-start gap-0 border border-vt-stroke text-left"
              :class="
                form.visibility === option.value ? 'bg-vt-ink text-vt-paper' : 'bg-transparent'
              "
            >
              <input
                v-model="form.visibility"
                type="radio"
                name="mc-visibility"
                class="sr-only"
                :value="option.value"
                :disabled="busy"
              />
              <strong class="text-sm">{{ option.label }}</strong>
              <small class="text-[11px] font-normal opacity-80">{{ option.hint }}</small>
            </label>
          </div>
        </fieldset>

        <div
          class="flex gap-2 rounded-[var(--r-chip)] bg-vt-bone px-3 py-2.5 text-xs text-vt-mute-2"
        >
          <VtIcon name="wallet" :size="14" />
          <span>
            Подтверждённые взносы автоматически попадут в кассу группы с категорией
            <b class="text-vt-ink">contribution</b>.
          </span>
        </div>

        <p v-if="serverError" class="text-sm text-vt-rose-ink" role="alert">{{ serverError }}</p>
      </form>
    </main>
  </div>
</template>
