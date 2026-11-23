<script setup lang="ts">
import {
  checkGroupPageMeta,
  defaultMetaDescription,
  defaultMetaTitle,
  GROUP_PAGE_META_RECOMMENDED,
  type GroupPageView,
} from '@volley-time/shared'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import SettingsField from '../settings/SettingsField.vue'
import SettingsRow from '../settings/SettingsRow.vue'

import GroupPageModerationBanner from './GroupPageModerationBanner.vue'
import GroupPagePreview from './GroupPagePreview.vue'

import GroupLogo from '~/components/GroupLogo.vue'
import VtAlert from '~/components/vt/Alert.vue'
import VtToggle from '~/components/vt/Toggle.vue'
import { apiErrorCode, apiErrorMessage } from '~/utils/api-error'
import {
  contentToForm,
  formToPayload,
  isFormDirty,
  issuesToErrors,
  LIMITS,
  META_WARNING_TEXT,
  moveItem,
  nextUid,
  SECTION_TITLES,
  validateForm,
  type PageForm,
} from '~/utils/group-page-builder'
import { SETTING_IMPACT } from '~/utils/group-settings'

/**
 * Конструктор страницы группы (24.1.1, W-13, D-24): секции, порядок, мета-теги, предпросмотр и
 * переключатель индексации. Правит владелец; организатор видит те же данные без правки.
 */
const props = defineProps<{
  view: GroupPageView
  canEdit: boolean
  levelTitles?: Record<string, string>
  base: string
  request: <T>(url: string, init: { method: 'PUT' | 'PATCH'; body: unknown }) => Promise<T>
  toast: (message: string, tone: 'ok' | 'danger') => void
}>()
const emit = defineEmits<{
  dirty: [value: boolean]
  saved: [view: GroupPageView]
  /** Решение администрации появилось или снялось: страницу нужно перечитать. */
  stale: []
}>()

const current = ref<GroupPageView>(props.view)
const ctx = computed(() => ({
  venueIds: current.value.venues.map((v) => v.id),
  joinText: current.value.resolved.joinText,
}))
const form = reactive<PageForm>(contentToForm(current.value.content, ctx.value))
const errors = ref<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)
const announce = ref('')
const device = ref<'desktop' | 'phone'>('desktop')

function resetForm() {
  const next = contentToForm(current.value.content, ctx.value)
  form.sections = next.sections
  form.metaTitle = next.metaTitle
  form.metaDescription = next.metaDescription
  errors.value = {}
  formError.value = ''
}
const dirty = computed(() => isFormDirty(form, current.value.content, ctx.value))
watch(dirty, (value) => emit('dirty', value))
watch(
  () => props.view,
  (value) => {
    if (dirty.value) return
    current.value = value
    resetForm()
  },
)

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const group = computed(() => current.value.group)
const payload = computed(() => formToPayload(form, current.value.resolved.joinText))
const defaults = computed(() => ({
  metaTitle: defaultMetaTitle(group.value.name, group.value.city),
  metaDescription: defaultMetaDescription(group.value.name, group.value.city),
  joinText: current.value.resolved.joinText,
}))
const effectiveTitle = computed(() => form.metaTitle.trim() || defaults.value.metaTitle)
const effectiveDescription = computed(
  () => form.metaDescription.trim() || defaults.value.metaDescription,
)
const warnings = computed(() =>
  checkGroupPageMeta({
    title: effectiveTitle.value,
    description: effectiveDescription.value,
    city: group.value.city,
  }),
)
const levels = computed(() => group.value.levels.map((c) => props.levelTitles?.[c] ?? c))

const err = (key: string) => errors.value[key]
const readOnly = computed(() => !props.canEdit)

// порядок секций ---------------------------------------------------------------------------
async function moveSection(index: number, delta: -1 | 1) {
  if (readOnly.value) return
  const kind = form.sections[index]!.kind
  form.sections = moveItem(form.sections, index, delta)
  const position = form.sections.findIndex((s) => s.kind === kind) + 1
  announce.value = `«${SECTION_TITLES[kind]}»: позиция ${position} из ${form.sections.length}`
  await nextTick()
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-gp-move^="${kind}:"]`)
  const preferred = [...buttons].find(
    (b) => b.dataset.gpMove === `${kind}:${delta < 0 ? 'up' : 'down'}`,
  )
  ;(preferred && !preferred.disabled ? preferred : [...buttons].find((b) => !b.disabled))?.focus()
}

// залы --------------------------------------------------------------------------------------
function toggleVenue(index: number, id: number, checked: boolean) {
  const section = form.sections[index]
  if (section?.kind !== 'venues' || readOnly.value) return
  const set = new Set(section.venueIds)
  if (checked) set.add(id)
  else set.delete(id)
  section.venueIds = current.value.venues.filter((v) => set.has(v.id)).map((v) => v.id)
}

// FAQ ---------------------------------------------------------------------------------------
async function addFaq(index: number) {
  const section = form.sections[index]
  if (section?.kind !== 'faq' || section.items.length >= LIMITS.faqItems || readOnly.value) return
  section.items.push({ uid: nextUid(), question: '', answer: '' })
  await nextTick()
  document
    .querySelector<HTMLElement>(
      `[data-gp-field="sections.${index}.items.${section.items.length - 1}.question"]`,
    )
    ?.focus()
}
function removeFaq(index: number, item: number) {
  const section = form.sections[index]
  if (section?.kind !== 'faq' || readOnly.value) return
  section.items.splice(item, 1)
}
function moveFaq(index: number, item: number, delta: -1 | 1) {
  const section = form.sections[index]
  if (section?.kind !== 'faq' || readOnly.value) return
  section.items = moveItem(section.items, item, delta)
}

// сохранение --------------------------------------------------------------------------------
function focusFirstError() {
  const first = Object.keys(errors.value)[0]
  if (first) document.querySelector<HTMLElement>(`[data-gp-field="${first}"]`)?.focus()
}

async function save() {
  if (readOnly.value || saving.value || !dirty.value) return
  formError.value = ''
  errors.value = validateForm(form)
  if (Object.keys(errors.value).length > 0) {
    formError.value = 'Проверьте заполнение полей'
    focusFirstError()
    return
  }
  saving.value = true
  try {
    const response = await props.request<{ page: GroupPageView }>(
      `/api/organizations/${group.value.id}/group-page`,
      { method: 'PUT', body: payload.value },
    )
    current.value = response.page
    resetForm()
    props.toast('Страница группы сохранена', 'ok')
    emit('saved', response.page)
  } catch (cause) {
    errors.value = issuesToErrors(cause, form)
    formError.value = apiErrorMessage(cause, 'Не удалось сохранить страницу группы')
    await nextTick()
    focusFirstError()
  } finally {
    saving.value = false
  }
}

// публикация (24.1.2): страница `/g/<slug>` открыта, только когда владелец её включил --------
const publicPage = ref(current.value.publicPageEnabled)
watch(
  () => props.view.publicPageEnabled,
  (value) => (publicPage.value = value),
)
const publicPending = ref(false)
const publicPath = computed(() => `/g/${group.value.slug}`)
async function setPublicPage(value: boolean) {
  if (readOnly.value || publicPending.value) return
  publicPending.value = true
  try {
    const response = await props.request<{ settings: { publicPageEnabled: boolean } }>(
      `/api/organizations/${group.value.id}/settings`,
      { method: 'PATCH', body: { publicPageEnabled: value } },
    )
    publicPage.value = response.settings.publicPageEnabled
    props.toast(publicPage.value ? 'Страница группы опубликована' : 'Страница группы скрыта', 'ok')
  } catch (cause) {
    props.toast(apiErrorMessage(cause, 'Не удалось изменить публикацию'), 'danger')
  } finally {
    publicPending.value = false
  }
}

// индексация --------------------------------------------------------------------------------
const seoIndex = ref(current.value.seoIndex)
watch(
  () => props.view.seoIndex,
  (value) => (seoIndex.value = value),
)
// решение администрации (24.1.3): пока оно действует, переключатель индексации не меняется
const moderation = computed(() => props.view.moderation)
const seoLocked = computed(() => moderation.value !== null)
const SEO_LOCK_HINT = 'Пока действует решение администрации, переключатель не работает'
const seoTarget = ref(false)
const seoConfirm = ref(false)
const seoPending = ref(false)

function askSeo(value: boolean) {
  if (readOnly.value || seoLocked.value || seoPending.value) return
  seoTarget.value = value
  seoConfirm.value = true
}
async function applySeo() {
  const value = seoTarget.value
  seoPending.value = true
  try {
    const response = await props.request<{ settings: { seoIndex: boolean } }>(
      `/api/organizations/${group.value.id}/settings`,
      { method: 'PATCH', body: { seoIndex: value } },
    )
    seoIndex.value = response.settings.seoIndex
    props.toast(
      seoIndex.value ? 'Страница группы доступна поиску' : 'Страница группы скрыта от поиска',
      'ok',
    )
  } catch (cause) {
    props.toast(apiErrorMessage(cause, 'Не удалось изменить индексацию'), 'danger')
    // 409: решение появилось, пока страница была открыта — перечитываем, чтобы показать причину
    if (apiErrorCode(cause) === 'group_page.moderation_locked') emit('stale')
  } finally {
    seoPending.value = false
  }
}
</script>

<template>
  <div class="vt-gp">
    <p v-if="readOnly" class="vt-settings-note" role="note" data-gp-readonly>
      Страницу группы редактирует только владелец группы. Вы видите текущие значения и предпросмотр.
    </p>

    <GroupPageModerationBanner
      v-if="moderation"
      :moderation="moderation"
      :seo-index="seoIndex"
      :city="group.city"
    />

    <section class="vt-card vt-settings-card" aria-labelledby="gp-seo-title">
      <h2 id="gp-seo-title" class="vt-settings-card__title">Публикация и поиск</h2>
      <SettingsRow
        label="Показывать страницу группы в поиске"
        :hint="
          seoLocked
            ? SEO_LOCK_HINT
            : `${SETTING_IMPACT.seoIndex} Режим записи в группу от этого не меняется.`
        "
        :model-value="seoIndex"
        :disabled="seoPending"
        :readonly="readOnly || seoLocked"
        @update:model-value="askSeo"
      />
      <div data-gp-public>
        <SettingsRow
          label="Опубликовать страницу группы"
          hint="Выключено: страница по адресу группы не открывается. Сохранённое содержимое не теряется."
          :model-value="publicPage"
          :disabled="publicPending"
          :readonly="readOnly"
          @update:model-value="setPublicPage"
        />
      </div>
      <p v-if="publicPage" class="vt-settings-hint" data-gp-public-link>
        Страница открыта:
        <NuxtLink :to="publicPath" target="_blank" class="vt-settings-link">{{
          publicPath
        }}</NuxtLink>
      </p>
    </section>

    <div class="vt-gp__layout">
      <form class="vt-gp__form" novalidate @submit.prevent="save">
        <p class="vt-gp__sr" role="status" aria-live="polite">{{ announce }}</p>
        <ol class="vt-gp-sections" aria-label="Секции страницы">
          <li
            v-for="(section, index) in form.sections"
            :key="section.kind"
            class="vt-card vt-settings-card vt-gp-section"
            :data-gp-section="section.kind"
            :data-enabled="section.enabled"
          >
            <div class="vt-settings-card__head">
              <h3 class="vt-settings-card__title">{{ SECTION_TITLES[section.kind] }}</h3>
              <div class="vt-gp-section__controls">
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  :data-gp-move="`${section.kind}:up`"
                  :aria-label="`Поднять секцию «${SECTION_TITLES[section.kind]}» выше`"
                  :disabled="readOnly || index === 0"
                  @click="moveSection(index, -1)"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  :data-gp-move="`${section.kind}:down`"
                  :aria-label="`Опустить секцию «${SECTION_TITLES[section.kind]}» ниже`"
                  :disabled="readOnly || index === form.sections.length - 1"
                  @click="moveSection(index, 1)"
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <VtToggle
                  v-model="section.enabled"
                  :label="`Показывать секцию «${SECTION_TITLES[section.kind]}»`"
                  :readonly="readOnly"
                />
              </div>
            </div>
            <p v-if="!section.enabled" class="vt-settings-hint">
              Секция выключена и не показывается на странице.
            </p>

            <template v-if="section.kind === 'cover'">
              <div class="vt-gp-cover">
                <GroupLogo
                  :org-id="group.id"
                  :name="group.name"
                  :logo-updated-at="group.logoUpdatedAt"
                  size-class="h-14 w-14 text-xl"
                />
                <p class="vt-settings-hint">
                  Логотип берётся из профиля группы.
                  <NuxtLink :to="`${base}/settings?section=profile`" class="vt-settings-link">
                    Сменить логотип
                  </NuxtLink>
                </p>
              </div>
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="Заголовок"
                :hint="`Пусто — название группы («${group.name}»).`"
                :error="err(`sections.${index}.headline`)"
              >
                <input
                  :id="id"
                  v-model="section.headline"
                  class="vt-field"
                  :maxlength="LIMITS.headline"
                  :data-gp-field="`sections.${index}.headline`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.headline.length }} / {{ LIMITS.headline }}
                </p>
              </SettingsField>
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="Подзаголовок"
                hint="Одна строка под заголовком. Пусто — подзаголовка не будет."
                :error="err(`sections.${index}.subtitle`)"
              >
                <input
                  :id="id"
                  v-model="section.subtitle"
                  class="vt-field"
                  :maxlength="LIMITS.subtitle"
                  :data-gp-field="`sections.${index}.subtitle`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.subtitle.length }} / {{ LIMITS.subtitle }}
                </p>
              </SettingsField>
            </template>

            <template v-else-if="section.kind === 'about'">
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="Текст"
                :hint="`Свободный текст о группе. Город и район подставляются из настроек: ${[group.city, group.district].filter(Boolean).join(', ') || 'не заданы'}.`"
                :error="err(`sections.${index}.text`)"
              >
                <textarea
                  :id="id"
                  v-model="section.text"
                  class="vt-field vt-settings-textarea"
                  rows="4"
                  :maxlength="LIMITS.about"
                  :data-gp-field="`sections.${index}.text`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.text.length }} / {{ LIMITS.about }}
                </p>
              </SettingsField>
              <NuxtLink :to="`${base}/settings?section=profile`" class="vt-settings-link">
                Изменить город и район
              </NuxtLink>
            </template>

            <template v-else-if="section.kind === 'schedule'">
              <p class="vt-settings-hint">
                Заполняется автоматически: ближайшие события группы (до 5), править нечего.
              </p>
              <ul v-if="current.upcomingEvents.length" class="vt-gp-readonly-list">
                <li v-for="event in current.upcomingEvents" :key="event.id">
                  {{ event.title }}
                </li>
              </ul>
              <p v-else class="vt-settings-hint">Ближайших событий пока нет.</p>
            </template>

            <template v-else-if="section.kind === 'formats'">
              <p class="vt-settings-hint">
                Уровни берутся из настроек группы:
                <strong>{{ levels.length ? levels.join(', ') : 'не выбраны' }}</strong
                >.
                <NuxtLink :to="`${base}/settings?section=bookings`" class="vt-settings-link">
                  Изменить уровни
                </NuxtLink>
              </p>
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="О форматах игры"
                hint="Например: «Свободная игра 6×6, по средам»."
                :error="err(`sections.${index}.text`)"
              >
                <textarea
                  :id="id"
                  v-model="section.text"
                  class="vt-field vt-settings-textarea"
                  rows="3"
                  :maxlength="LIMITS.formats"
                  :data-gp-field="`sections.${index}.text`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.text.length }} / {{ LIMITS.formats }}
                </p>
              </SettingsField>
            </template>

            <template v-else-if="section.kind === 'prices'">
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="Цены"
                hint="Свободный текст: разовая игра, абонемент, скидки."
                :error="err(`sections.${index}.text`)"
              >
                <textarea
                  :id="id"
                  v-model="section.text"
                  class="vt-field vt-settings-textarea"
                  rows="3"
                  :maxlength="LIMITS.prices"
                  :data-gp-field="`sections.${index}.text`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.text.length }} / {{ LIMITS.prices }}
                </p>
              </SettingsField>
            </template>

            <template v-else-if="section.kind === 'venues'">
              <fieldset
                class="vt-gp-venues"
                :data-gp-field="`sections.${index}.venueIds`"
                tabindex="-1"
                :aria-describedby="`gp-venues-${index}-note`"
              >
                <legend class="vt-label">Залы группы</legend>
                <p v-if="current.venues.length === 0" class="vt-settings-hint">
                  В группе пока нет активных залов.
                  <NuxtLink :to="`${base}/settings?section=venues`" class="vt-settings-link">
                    Добавить зал
                  </NuxtLink>
                </p>
                <label v-for="venue in current.venues" :key="venue.id" class="vt-gp-venue">
                  <input
                    type="checkbox"
                    :checked="section.venueIds.includes(venue.id)"
                    :disabled="
                      readOnly ||
                      (!section.venueIds.includes(venue.id) &&
                        section.venueIds.length >= LIMITS.venues)
                    "
                    @change="
                      toggleVenue(index, venue.id, ($event.target as HTMLInputElement).checked)
                    "
                  />
                  <span>
                    {{ venue.name }}
                    <small v-if="venue.address" class="vt-settings-hint">{{ venue.address }}</small>
                  </span>
                </label>
              </fieldset>
              <p :id="`gp-venues-${index}-note`" class="vt-settings-hint">
                Можно выбрать до {{ LIMITS.venues }} залов. Показываются в порядке списка.
              </p>
              <p
                v-if="section.enabled && section.venueIds.length === 0"
                class="vt-settings-note"
                role="status"
                data-gp-venues-warning
              >
                Секция «Зал» включена, но залы не выбраны: на странице она будет пустой. Выберите
                зал или выключите секцию.
              </p>
              <p class="vt-settings-error" role="alert">{{ err(`sections.${index}.venueIds`) }}</p>
            </template>

            <template v-else-if="section.kind === 'join'">
              <SettingsField
                v-slot="{ id, describedby, invalid }"
                label="Текст «Как записаться»"
                hint="По умолчанию текст берётся из режима записи группы. Можно переписать; пустое поле вернёт текст по умолчанию."
                :error="err(`sections.${index}.text`)"
              >
                <textarea
                  :id="id"
                  v-model="section.text"
                  class="vt-field vt-settings-textarea"
                  rows="3"
                  :maxlength="LIMITS.join"
                  :data-gp-field="`sections.${index}.text`"
                  :aria-describedby="describedby"
                  :aria-invalid="invalid"
                  :readonly="readOnly"
                />
                <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                  {{ section.text.length }} / {{ LIMITS.join }}
                </p>
              </SettingsField>
              <div
                v-if="!readOnly && section.text.trim() !== current.resolved.joinText"
                class="vt-settings-actions vt-settings-actions--start"
              >
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  data-gp-join-reset
                  @click="section.text = current.resolved.joinText"
                >
                  Вернуть текст по умолчанию
                </button>
              </div>
            </template>

            <template v-else-if="section.kind === 'faq'">
              <p class="vt-settings-hint" data-gp-faq-count>
                Вопросов: {{ section.items.length }} / {{ LIMITS.faqItems }}
              </p>
              <ol class="vt-gp-faq-list">
                <li
                  v-for="(item, j) in section.items"
                  :key="item.uid"
                  class="vt-gp-faq-item"
                  data-gp-faq-item
                >
                  <SettingsField
                    v-slot="{ id, describedby, invalid }"
                    :label="`Вопрос ${j + 1}`"
                    hint=""
                    :error="err(`sections.${index}.items.${j}.question`)"
                  >
                    <input
                      :id="id"
                      v-model="item.question"
                      class="vt-field"
                      :maxlength="LIMITS.faqQuestion"
                      :data-gp-field="`sections.${index}.items.${j}.question`"
                      :aria-describedby="describedby"
                      :aria-invalid="invalid"
                      :readonly="readOnly"
                    />
                    <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                      {{ item.question.length }} / {{ LIMITS.faqQuestion }}
                    </p>
                  </SettingsField>
                  <SettingsField
                    v-slot="{ id, describedby, invalid }"
                    :label="`Ответ ${j + 1}`"
                    hint=""
                    :error="err(`sections.${index}.items.${j}.answer`)"
                  >
                    <textarea
                      :id="id"
                      v-model="item.answer"
                      class="vt-field vt-settings-textarea"
                      rows="2"
                      :maxlength="LIMITS.faqAnswer"
                      :data-gp-field="`sections.${index}.items.${j}.answer`"
                      :aria-describedby="describedby"
                      :aria-invalid="invalid"
                      :readonly="readOnly"
                    />
                    <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
                      {{ item.answer.length }} / {{ LIMITS.faqAnswer }}
                    </p>
                  </SettingsField>
                  <div v-if="!readOnly" class="vt-gp-section__controls">
                    <button
                      type="button"
                      class="vt-btn vt-btn--ghost vt-btn--sm"
                      :aria-label="`Поднять вопрос ${j + 1} выше`"
                      :disabled="j === 0"
                      @click="moveFaq(index, j, -1)"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      class="vt-btn vt-btn--ghost vt-btn--sm"
                      :aria-label="`Опустить вопрос ${j + 1} ниже`"
                      :disabled="j === section.items.length - 1"
                      @click="moveFaq(index, j, 1)"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button
                      type="button"
                      class="vt-btn vt-btn--ghost vt-btn--sm"
                      :aria-label="`Удалить вопрос ${j + 1}`"
                      @click="removeFaq(index, j)"
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              </ol>
              <div v-if="!readOnly" class="vt-settings-actions vt-settings-actions--start">
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  data-gp-faq-add
                  :disabled="section.items.length >= LIMITS.faqItems"
                  @click="addFaq(index)"
                >
                  Добавить вопрос
                </button>
              </div>
            </template>
          </li>
        </ol>

        <section class="vt-card vt-settings-card" aria-labelledby="gp-meta-title">
          <h2 id="gp-meta-title" class="vt-settings-card__title">
            Заголовок и описание для поиска
          </h2>
          <SettingsField
            v-slot="{ id, describedby, invalid }"
            label="Title"
            :hint="`Пусто — «${defaults.metaTitle}». Рекомендуется ${GROUP_PAGE_META_RECOMMENDED.titleMin}–${GROUP_PAGE_META_RECOMMENDED.titleMax} символов.`"
            :error="err('metaTitle')"
          >
            <input
              :id="id"
              v-model="form.metaTitle"
              class="vt-field"
              :placeholder="defaults.metaTitle"
              :maxlength="LIMITS.metaTitle"
              data-gp-field="metaTitle"
              :aria-describedby="describedby"
              :aria-invalid="invalid"
              :readonly="readOnly"
            />
            <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
              {{ effectiveTitle.length }} / {{ GROUP_PAGE_META_RECOMMENDED.titleMax }}
            </p>
          </SettingsField>
          <SettingsField
            v-slot="{ id, describedby, invalid }"
            label="Description"
            :hint="`Пусто — описание по умолчанию. Рекомендуется ${GROUP_PAGE_META_RECOMMENDED.descriptionMin}–${GROUP_PAGE_META_RECOMMENDED.descriptionMax} символов.`"
            :error="err('metaDescription')"
          >
            <textarea
              :id="id"
              v-model="form.metaDescription"
              class="vt-field vt-settings-textarea"
              rows="3"
              :placeholder="defaults.metaDescription"
              :maxlength="LIMITS.metaDescription"
              data-gp-field="metaDescription"
              :aria-describedby="describedby"
              :aria-invalid="invalid"
              :readonly="readOnly"
            />
            <p class="vt-settings-hint vt-settings-counter" aria-hidden="true">
              {{ effectiveDescription.length }} / {{ GROUP_PAGE_META_RECOMMENDED.descriptionMax }}
            </p>
          </SettingsField>
          <ul v-if="warnings.length" class="vt-gp-warnings" role="status" data-gp-warnings>
            <li
              v-for="code in warnings"
              :key="code"
              class="vt-settings-note"
              :data-gp-warning="code"
            >
              {{ META_WARNING_TEXT[code] }}
            </li>
          </ul>
          <p v-if="warnings.length" class="vt-settings-hint">
            Предупреждения не мешают сохранению.
          </p>
        </section>

        <p v-if="formError" class="vt-settings-error vt-settings-error--form" role="alert">
          {{ formError }}
        </p>
        <div v-if="canEdit" class="vt-settings-actions vt-gp__actions">
          <span v-if="dirty" class="vt-chip vt-chip--amber" data-gp-dirty role="status">
            Есть несохранённые изменения
          </span>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="!dirty || saving"
            @click="resetForm"
          >
            Отменить правки
          </button>
          <button type="submit" class="vt-btn vt-btn--ink vt-btn--sm" :disabled="!dirty || saving">
            {{ saving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </div>
      </form>

      <aside class="vt-gp__aside" aria-labelledby="gp-preview-title">
        <section class="vt-card vt-settings-card">
          <div class="vt-settings-card__head">
            <h2 id="gp-preview-title" class="vt-settings-card__title">Предпросмотр</h2>
            <div class="vt-gp-device" role="group" aria-label="Устройство предпросмотра">
              <button
                type="button"
                class="vt-btn vt-btn--sm"
                :class="device === 'desktop' ? 'vt-btn--ink' : 'vt-btn--ghost'"
                :aria-pressed="device === 'desktop'"
                data-gp-device="desktop"
                @click="device = 'desktop'"
              >
                Компьютер
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--sm"
                :class="device === 'phone' ? 'vt-btn--ink' : 'vt-btn--ghost'"
                :aria-pressed="device === 'phone'"
                data-gp-device="phone"
                @click="device = 'phone'"
              >
                Телефон
              </button>
            </div>
          </div>
          <GroupPagePreview
            :content="payload"
            :group="group"
            :venues="current.venues"
            :events="current.upcomingEvents"
            :defaults="defaults"
            :level-titles="levelTitles"
            :device="device"
          />
        </section>
      </aside>
    </div>

    <VtAlert
      v-model="seoConfirm"
      :title="seoTarget ? 'Показывать страницу в поиске?' : 'Скрыть страницу от поиска?'"
      :body="
        seoTarget
          ? 'Поисковики смогут находить страницу группы и публичные страницы её событий. Режим записи в группу не изменится.'
          : 'Страница группы и публичные страницы её событий перестанут индексироваться: со временем они исчезнут из поиска. Ссылки продолжат открываться, режим записи в группу не изменится.'
      "
      :confirm-label="seoTarget ? 'Показывать в поиске' : 'Скрыть от поиска'"
      @confirm="applySeo"
    />
  </div>
</template>
