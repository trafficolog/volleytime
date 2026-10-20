<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  CABINET_SEARCH_DEBOUNCE_MS,
  CABINET_SEARCH_MIN,
  buildSearchSections,
  shouldSearch,
  type CabinetSearchResponse,
} from '~/utils/cabinet-search'

/** Поиск топбара кабинета (20.5.2, P-13): игроки, события и платежи группы одним запросом. */
const props = defineProps<{ orgId: number; timeZone: string }>()

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const open = ref(false)
const loading = ref(false)
const error = ref('')
const data = ref<CabinetSearchResponse | null>(null)
let generation = 0
let controller: AbortController | undefined
let skipOpenOnFocus = false
let timer: ReturnType<typeof setTimeout> | undefined

const sections = computed(() =>
  data.value ? buildSearchSections(props.orgId, data.value, props.timeZone) : [],
)
const tooShort = computed(() => query.value.trim().length > 0 && !shouldSearch(query.value))
const found = computed(() => sections.value.reduce((n, sec) => n + sec.rows.length, 0))
const empty = computed(
  () => !loading.value && !error.value && data.value?.searched === true && found.value === 0,
)
/** Одна постоянная live-область: меняется только текст, скринридер озвучивает итог. */
const liveText = computed(() => {
  if (!open.value) return ''
  if (tooShort.value) return `Введите минимум ${CABINET_SEARCH_MIN} символа`
  if (loading.value) return 'Ищем…'
  if (error.value) return ''
  if (empty.value) return 'Ничего не найдено'
  return data.value?.searched ? `Найдено: ${found.value}` : ''
})

function abortInFlight() {
  controller?.abort()
  controller = undefined
}

async function run() {
  const token = ++generation
  const orgId = props.orgId
  const q = query.value
  if (!shouldSearch(q)) {
    data.value = null
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  abortInFlight()
  const ctl = new AbortController()
  controller = ctl
  try {
    const result = await $fetch<CabinetSearchResponse>(`/api/organizations/${orgId}/search`, {
      query: { q },
      signal: ctl.signal,
    })
    // устаревший ответ (новый ввод или другая группа) не должен перетереть актуальный
    if (token !== generation || orgId !== props.orgId) return
    data.value = result
  } catch (e) {
    if (token !== generation) return
    data.value = null
    error.value = apiErrorMessage(e, 'Не удалось выполнить поиск')
  } finally {
    if (token === generation) loading.value = false
  }
}

function schedule() {
  clearTimeout(timer)
  abortInFlight()
  open.value = query.value.trim().length > 0
  if (!shouldSearch(query.value)) {
    generation++
    data.value = null
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  timer = setTimeout(run, CABINET_SEARCH_DEBOUNCE_MS)
}

function close() {
  open.value = false
}

/** Esc при открытой выдаче: закрыть, вернуть фокус в поле и не пускать событие к обработчикам кабинета. */
function onEsc(e: KeyboardEvent) {
  if (!open.value) return
  e.stopPropagation()
  close()
  skipOpenOnFocus = true
  input.value?.focus()
  skipOpenOnFocus = false
}

/** Фокус ушёл за пределы поиска (Tab, клик по фокусируемому элементу): закрыть выдачу. */
function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && root.value && !root.value.contains(next)) close()
}

function onFocus() {
  if (!skipOpenOnFocus) open.value = query.value.trim().length > 0
}

function clear() {
  clearTimeout(timer)
  abortInFlight()
  generation++
  query.value = ''
  data.value = null
  loading.value = false
  error.value = ''
  open.value = false
}

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    // в другом поле ввода (форма, заметка) Ctrl+K не наш: фокус не забираем
    if (isEditable(e.target) && e.target !== input.value) return
    e.preventDefault()
    input.value?.focus()
    input.value?.select()
    open.value = query.value.trim().length > 0
  }
}

function onOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

watch(
  () => props.orgId,
  () => clear(),
)

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  document.addEventListener('mousedown', onOutside)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  abortInFlight()
  generation++
  window.removeEventListener('keydown', onGlobalKey)
  document.removeEventListener('mousedown', onOutside)
})
</script>

<template>
  <div
    ref="root"
    class="vt-cabinet-search"
    role="search"
    @keydown.esc="onEsc"
    @focusout="onFocusOut"
  >
    <label class="vt-cabinet-search__field">
      <VtIcon name="search" :size="16" />
      <span class="sr-only">Поиск по игрокам, событиям и платежам</span>
      <input
        ref="input"
        v-model="query"
        type="search"
        class="vt-cabinet-search__input"
        placeholder="Поиск или Ctrl K"
        autocomplete="off"
        maxlength="64"
        aria-controls="cabinet-search-panel"
        @input="schedule"
        @focus="onFocus"
      />
    </label>
    <p class="sr-only" role="status">{{ liveText }}</p>
    <div v-if="open" id="cabinet-search-panel" class="vt-cabinet-search__panel">
      <p v-if="tooShort" class="vt-cabinet-search__note">
        Введите минимум {{ CABINET_SEARCH_MIN }} символа
      </p>
      <p v-else-if="loading" class="vt-cabinet-search__note">Ищем…</p>
      <p v-else-if="error" class="vt-cabinet-search__note" role="alert">{{ error }}</p>
      <p v-else-if="empty" class="vt-cabinet-search__note">Ничего не найдено</p>
      <template v-else>
        <div
          v-for="section in sections"
          :key="section.key"
          role="group"
          :aria-labelledby="`cabinet-search-${section.key}`"
          class="vt-cabinet-search__group"
        >
          <p :id="`cabinet-search-${section.key}`" class="vt-cabinet-search__heading">
            {{ section.heading }}
          </p>
          <ul>
            <li v-for="row in section.rows" :key="row.key">
              <NuxtLink :to="row.to" class="vt-cabinet-search__row" @click="clear">
                <span class="vt-cabinet-search__title">{{ row.title }}</span>
                <span class="vt-cabinet-search__subtitle">{{ row.subtitle }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-if="section.more" class="vt-cabinet-search__more">Есть ещё — уточните запрос</p>
        </div>
      </template>
    </div>
  </div>
</template>
