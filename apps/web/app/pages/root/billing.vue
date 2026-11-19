<script setup lang="ts">
import type {
  PlatformEventBalancePackage,
  PlatformEventBalancePackages,
  PlatformGrantsPage,
  PlatformPackageHistoryPage,
} from '@volley-time/shared'

import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { grantRowView } from '~/utils/root-grants'
import { rootOverviewFailure } from '~/utils/root-overview'
import {
  EMPTY_PACKAGE_FORM,
  PACKAGE_BADGE_OPTIONS,
  type PackageForm,
  type PackageFormErrors,
  historyEntryView,
  packageCreateBody,
  packageDuplicateBody,
  packageErrorMessage,
  packageFormErrors,
  packagePatchBody,
  packagePreview,
  packageRowView,
  packageToForm,
  unattributedView,
} from '~/utils/root-packages'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Баланс и тарифы — Root Admin' })

const API = '/api/platform/event-balance/packages'
const toast = useToast()
const route = useRoute()
const router = useRouter()

const view = computed(() =>
  route.query.view === 'history'
    ? 'history'
    : route.query.view === 'grants'
      ? 'grants'
      : 'packages',
)
const archived = ref(false)

const { data, pending, error, refresh } = await useFetch<PlatformEventBalancePackages>(API, {
  key: 'root-event-balance-packages',
  query: computed(() => ({ archived: archived.value ? 'true' : 'false' })),
})

/** Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход. */
function reactToStatus(status: number | undefined): boolean {
  const reaction = rootOverviewFailure(status)
  if (reaction === 'forbidden') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Раздел доступен только администратору платформы',
      fatal: true,
    })
  }
  if (reaction === 'login') {
    void navigateTo('/auth/login')
    return true
  }
  return false
}
reactToStatus(apiErrorStatus(error.value))

const rows = computed(() => (data.value?.packages ?? []).map(packageRowView))
const unattributed = computed(() => unattributedView(data.value?.unattributed ?? []))
const byId = (id: number) => data.value?.packages.find((p) => p.id === id)

// Форма «Новый пакет» / «Дублировать» / «Изменить»
type FormMode = 'create' | 'duplicate' | 'edit'
const formMode = ref<FormMode | null>(null)
const target = ref<PlatformEventBalancePackage | null>(null)
const form = reactive<PackageForm>({ ...EMPTY_PACKAGE_FORM })
const errors = ref<PackageFormErrors>({})
const failure = ref('')
const submitting = ref(false)
const unitsInput = ref<HTMLInputElement | null>(null)
const priceInput = ref<HTMLInputElement | null>(null)

const preview = computed(() => packagePreview(form))
const formTitle = computed(
  () =>
    ({
      create: 'Новый пакет',
      duplicate: 'Копия пакета',
      edit: 'Изменить пакет',
    })[formMode.value ?? 'create'],
)
const submitLabel = computed(
  () =>
    ({ create: 'Создать пакет', duplicate: 'Создать копию', edit: 'Сохранить' })[formMode.value!],
)

async function openForm(mode: FormMode, pkg?: PlatformEventBalancePackage) {
  formMode.value = mode
  target.value = pkg ?? null
  errors.value = {}
  failure.value = ''
  if (mode === 'create' || !pkg) Object.assign(form, EMPTY_PACKAGE_FORM)
  else {
    Object.assign(form, packageToForm(pkg))
    // копия — всегда черновик с другим количеством: поле очищено, чтобы не получить 409
    if (mode === 'duplicate') Object.assign(form, { units: '', visible: false })
  }
  await nextTick()
  if (mode === 'edit') priceInput.value?.focus()
  else unitsInput.value?.focus()
}

function closeForm() {
  formMode.value = null
  target.value = null
  failure.value = ''
}

/** Общая обработка ошибки мутации: вход, 403, устаревшая версия (список перечитывается). */
async function handleFailure(e: unknown): Promise<string> {
  const status = apiErrorStatus(e)
  if (reactToStatus(status)) return ''
  const code = apiErrorCode(e)
  if (code === 'event_balance_package.stale' || code === 'event_balance_package.not_found') {
    await refresh()
  }
  return packageErrorMessage(code)
}

async function submit() {
  if (submitting.value || !formMode.value) return
  failure.value = ''
  errors.value = packageFormErrors(form, formMode.value === 'edit')
  if (Object.keys(errors.value).length) return
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      await $fetch(API, { method: 'POST', body: packageCreateBody(form) })
      toast.show('Пакет создан как черновик')
    } else if (formMode.value === 'duplicate' && target.value) {
      await $fetch(`${API}/${target.value.id}/duplicate`, {
        method: 'POST',
        body: packageDuplicateBody(form),
      })
      toast.show('Копия создана как черновик')
    } else if (target.value) {
      await $fetch(`${API}/${target.value.id}`, {
        method: 'PATCH',
        body: packagePatchBody(form, target.value),
      })
      toast.show('Пакет сохранён')
    }
    closeForm()
    await refresh()
  } catch (e) {
    const message = await handleFailure(e)
    if (message) failure.value = message
  } finally {
    submitting.value = false
  }
}

// Видимость и архив
const busyId = ref<number | null>(null)
const pageError = ref('')
const confirmId = ref<number | null>(null)

async function toggleVisible(id: number) {
  const pkg = byId(id)
  if (!pkg || busyId.value !== null) return
  busyId.value = id
  pageError.value = ''
  try {
    await $fetch(`${API}/${id}`, {
      method: 'PATCH',
      body: { version: pkg.version, visible: !pkg.visible },
    })
    toast.show(pkg.visible ? 'Пакет скрыт из витрины' : 'Пакет показан в витрине')
    await refresh()
  } catch (e) {
    pageError.value = await handleFailure(e)
  } finally {
    busyId.value = null
  }
}

async function askDelete(id: number) {
  confirmId.value = id
  pageError.value = ''
  await nextTick()
  document.querySelector<HTMLButtonElement>('[data-delete-cancel]')?.focus()
}

async function archivePackage(id: number) {
  const pkg = byId(id)
  if (!pkg || busyId.value !== null) return
  busyId.value = id
  pageError.value = ''
  try {
    await $fetch(`${API}/${id}/archive`, { method: 'POST', body: { version: pkg.version } })
    confirmId.value = null
    toast.show('Пакет перенесён в архив')
    await refresh()
  } catch (e) {
    pageError.value = await handleFailure(e)
    confirmId.value = null
  } finally {
    busyId.value = null
  }
}

// История изменений
const history = ref<PlatformPackageHistoryPage['entries']>([])
const historyCursor = ref<number | null>(null)
const historyPending = ref(false)
const historyFailed = ref(false)
const historyLoaded = ref(false)

async function loadHistory(more = false) {
  historyPending.value = true
  historyFailed.value = false
  try {
    const page = await $fetch<PlatformPackageHistoryPage>(`${API}/history`, {
      query: { limit: 50, ...(more && historyCursor.value ? { cursor: historyCursor.value } : {}) },
    })
    history.value = more ? [...history.value, ...page.entries] : page.entries
    historyCursor.value = page.nextCursor
    historyLoaded.value = true
  } catch (e) {
    if (!reactToStatus(apiErrorStatus(e))) historyFailed.value = true
  } finally {
    historyPending.value = false
  }
}

watch(
  view,
  (v) => {
    if (v === 'history' && !historyLoaded.value) void loadHistory()
  },
  { immediate: true },
)

function showView(next: 'packages' | 'history' | 'grants') {
  void router.push({ query: next === 'packages' ? {} : { view: next } })
}
const historyRows = computed(() => history.value.map((e) => historyEntryView(e)))

// Ручные начисления (22.2.2): последние записи журнала `grant`
const GRANTS_API = '/api/platform/event-balance/grants'
const grants = ref<PlatformGrantsPage['entries']>([])
const grantsCursor = ref<number | null>(null)
const grantsPending = ref(false)
const grantsFailed = ref(false)

async function loadGrants(more = false) {
  grantsPending.value = true
  grantsFailed.value = false
  try {
    const page = await $fetch<PlatformGrantsPage>(GRANTS_API, {
      query: { limit: 10, ...(more && grantsCursor.value ? { cursor: grantsCursor.value } : {}) },
    })
    grants.value = more ? [...grants.value, ...page.entries] : page.entries
    grantsCursor.value = page.nextCursor
  } catch (e) {
    if (!reactToStatus(apiErrorStatus(e))) grantsFailed.value = true
  } finally {
    grantsPending.value = false
  }
}
const grantsLoaded = ref(false)
watch(
  view,
  (v) => {
    if (v === 'grants' && !grantsLoaded.value) {
      grantsLoaded.value = true
      void loadGrants()
    }
  },
  { immediate: true },
)
const grantRows = computed(() => grants.value.map((g) => grantRowView(g)))
</script>

<template>
  <div class="vt-root-billing">
    <header class="vt-root-overview__heading vt-root-billing__head">
      <div>
        <h1 tabindex="-1">
          Баланс и тарифы <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p class="text-vt-mute-2">
          Пакеты событий платформы · цены, видимость и история изменений. Смена цены не затрагивает
          купленные пакеты и заявки, уже поданные организаторами.
        </p>
      </div>
      <div class="vt-root-billing__actions">
        <button
          v-if="view === 'packages'"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          @click="showView('history')"
        >
          <VtIcon name="clock" :size="13" /> История изменений
        </button>
        <button
          v-if="view === 'packages'"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          @click="showView('grants')"
        >
          <VtIcon name="gift" :size="13" /> Начисления
        </button>
        <button
          v-else
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          @click="showView('packages')"
        >
          <VtIcon name="chevron-l" :size="13" /> К пакетам
        </button>
        <NuxtLink
          v-if="view === 'packages'"
          to="/root/billing-grant"
          class="vt-btn vt-btn--ink vt-btn--sm"
        >
          <VtIcon name="plus" :size="13" /> Выдать баланс
        </NuxtLink>
        <button
          v-if="view === 'packages'"
          type="button"
          class="vt-btn vt-btn--primary vt-btn--sm"
          @click="openForm('create')"
        >
          <VtIcon name="plus" :size="13" /> Новый пакет
        </button>
      </div>
    </header>

    <template v-if="view === 'packages'">
      <section
        v-if="formMode"
        class="vt-card vt-root-billing__form-card"
        aria-labelledby="package-form-title"
      >
        <form class="vt-root-billing__form" novalidate @submit.prevent="submit">
          <div class="vt-root-billing__form-fields">
            <h2 id="package-form-title">{{ formTitle }}</h2>
            <p v-if="formMode === 'edit' && target" class="vt-root-billing__hint">
              {{ target.units }} событий · код <span class="vt-mono">{{ target.code }}</span
              >. Количество событий после создания не меняется: чтобы выпустить другое количество,
              создайте копию и перенесите старый пакет в архив.
            </p>
            <p v-else-if="formMode === 'duplicate' && target" class="vt-root-billing__hint">
              Копия пакета <span class="vt-mono">{{ target.code }}</span> появится черновиком:
              укажите другое количество событий.
            </p>

            <div class="vt-root-billing__grid">
              <label class="vt-root-billing__field">
                <span class="vt-label">Количество событий</span>
                <input
                  ref="unitsInput"
                  v-model="form.units"
                  class="vt-field vt-mono"
                  name="units"
                  inputmode="numeric"
                  autocomplete="off"
                  :readonly="formMode === 'edit'"
                  :aria-invalid="errors.units ? 'true' : undefined"
                  :aria-describedby="errors.units ? 'package-units-error' : undefined"
                />
                <span v-if="errors.units" id="package-units-error" class="vt-root-billing__error">
                  {{ errors.units }}
                </span>
              </label>
              <label class="vt-root-billing__field">
                <span class="vt-label">Цена, Br</span>
                <input
                  ref="priceInput"
                  v-model="form.price"
                  class="vt-field vt-mono"
                  name="price"
                  inputmode="decimal"
                  autocomplete="off"
                  :aria-invalid="errors.price ? 'true' : undefined"
                  :aria-describedby="errors.price ? 'package-price-error' : undefined"
                />
                <span v-if="errors.price" id="package-price-error" class="vt-root-billing__error">
                  {{ errors.price }}
                </span>
              </label>
            </div>

            <fieldset class="vt-root-billing__badges">
              <legend class="vt-label">Бейдж (необязательно)</legend>
              <div class="vt-root-billing__badge-row">
                <button
                  v-for="option in PACKAGE_BADGE_OPTIONS"
                  :key="option.label"
                  type="button"
                  class="vt-btn vt-btn--sm"
                  :class="form.badge === option.value ? 'vt-btn--ink' : 'vt-btn--ghost'"
                  :aria-pressed="form.badge === option.value"
                  @click="form.badge = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </fieldset>

            <div class="vt-root-billing__visible">
              <div>
                <p id="package-visible-label" class="vt-root-billing__visible-title">
                  Показывать в витрине
                </p>
                <p class="vt-root-billing__hint">
                  Организаторы увидят пакет при покупке баланса событий.
                </p>
              </div>
              <VtToggle v-model="form.visible" labelledby="package-visible-label" />
            </div>

            <p v-if="failure" role="alert" class="vt-root-billing__error">{{ failure }}</p>
            <div class="vt-root-billing__form-actions">
              <button
                type="submit"
                class="vt-btn vt-btn--primary vt-btn--sm"
                :disabled="submitting"
              >
                <VtIcon name="check" :size="14" /> {{ submitting ? 'Сохраняем…' : submitLabel }}
              </button>
              <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="closeForm">
                Отмена
              </button>
            </div>
          </div>

          <aside class="vt-root-billing__preview" aria-label="Превью пакета">
            <p class="vt-label">Превью</p>
            <div class="vt-card vt-root-billing__preview-card">
              <p class="vt-root-billing__preview-units vt-mono">{{ preview.units }}</p>
              <p class="vt-root-billing__hint">{{ preview.caption }}</p>
              <hr class="vt-divider" />
              <p class="vt-root-billing__preview-price vt-mono">{{ preview.price }}</p>
              <p class="vt-root-billing__hint">{{ preview.perEvent }}</p>
            </div>
          </aside>
        </form>
      </section>

      <section class="vt-card vt-root-billing__card" aria-labelledby="packages-title">
        <div class="vt-root-billing__card-head">
          <div>
            <h2 id="packages-title">Пакеты событий</h2>
            <p class="vt-root-billing__hint">
              Изменения применяются к следующим заявкам. Подтверждённые продажи считаются по снимку
              цены заявки.
            </p>
          </div>
          <div class="vt-root-billing__filter" role="group" aria-label="Какие пакеты показывать">
            <button
              type="button"
              class="vt-btn vt-btn--sm"
              :class="archived ? 'vt-btn--ghost' : 'vt-btn--ink'"
              :aria-pressed="!archived"
              @click="archived = false"
            >
              Действующие
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--sm"
              :class="archived ? 'vt-btn--ink' : 'vt-btn--ghost'"
              :aria-pressed="archived"
              @click="archived = true"
            >
              Архив
            </button>
          </div>
        </div>

        <p v-if="pageError" role="alert" class="vt-root-billing__error">{{ pageError }}</p>

        <SkeletonList v-if="pending && !data" :count="4" />
        <ErrorState
          v-else-if="error && !data"
          message="Не удалось загрузить пакеты"
          @retry="refresh()"
        />
        <template v-else>
          <EmptyState
            v-if="!rows.length"
            icon="card"
            :title="archived ? 'Архив пуст' : 'Пакетов нет'"
            :description="archived ? '' : 'Создайте первый пакет кнопкой «Новый пакет»'"
          />
          <div v-else class="vt-root-billing__table-wrap" :aria-busy="pending">
            <table class="vt-root-billing__table">
              <caption class="sr-only">
                Пакеты баланса событий
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="vt-cap">События</th>
                  <th scope="col" class="vt-cap">Цена</th>
                  <th scope="col" class="vt-cap">За событие</th>
                  <th scope="col" class="vt-cap">Бейдж</th>
                  <th scope="col" class="vt-cap">Витрина</th>
                  <th scope="col" class="vt-cap">Продаж</th>
                  <th scope="col" class="vt-cap">Доход</th>
                  <th scope="col" class="vt-cap">Действия</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="row in rows" :key="row.id">
                  <tr :data-testid="`package-row-${row.code}`" :data-draft="row.draft || undefined">
                    <td>
                      <span class="vt-root-billing__units vt-mono">{{ row.units }}</span>
                      <span class="vt-root-billing__code vt-mono">{{ row.code }}</span>
                    </td>
                    <td class="vt-mono vt-root-billing__price">{{ row.price }}</td>
                    <td class="vt-mono vt-root-billing__muted">{{ row.perEvent }}</td>
                    <td>
                      <span v-if="row.badge" class="vt-chip vt-chip--solid">{{ row.badge }}</span>
                    </td>
                    <td>
                      <span v-if="row.archived" class="vt-chip">в архиве</span>
                      <span v-else-if="row.draft" class="vt-chip vt-chip--amber">черновик</span>
                      <span v-else class="vt-chip vt-chip--grass">показан</span>
                    </td>
                    <td class="vt-mono">{{ row.sold }}</td>
                    <td
                      class="vt-mono"
                      :class="row.hasRevenue ? 'vt-root-billing__income' : 'vt-root-billing__muted'"
                    >
                      {{ row.revenue }}
                    </td>
                    <td>
                      <div class="vt-root-billing__row-actions">
                        <button
                          v-if="!row.archived"
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busyId === row.id"
                          :aria-label="`Изменить пакет ${row.units} ${row.unitsCaption}`"
                          @click="openForm('edit', byId(row.id))"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busyId === row.id"
                          :aria-label="`Дублировать пакет ${row.units} ${row.unitsCaption}`"
                          @click="openForm('duplicate', byId(row.id))"
                        >
                          Дублировать
                        </button>
                        <button
                          v-if="!row.archived"
                          type="button"
                          class="vt-btn vt-btn--ghost vt-btn--sm"
                          :disabled="busyId === row.id"
                          :aria-label="`${row.visible ? 'Скрыть из витрины' : 'Показать в витрине'}: пакет ${row.units} ${row.unitsCaption}`"
                          @click="toggleVisible(row.id)"
                        >
                          {{ row.visible ? 'Скрыть' : 'Показать' }}
                        </button>
                        <button
                          v-if="!row.archived"
                          type="button"
                          class="vt-btn vt-btn--danger vt-btn--sm"
                          :disabled="busyId === row.id"
                          :aria-label="`Удалить пакет ${row.units} ${row.unitsCaption}`"
                          @click="askDelete(row.id)"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="confirmId === row.id" class="vt-root-billing__confirm-row">
                    <td colspan="8">
                      <div
                        role="alertdialog"
                        aria-labelledby="delete-title"
                        class="vt-root-billing__confirm"
                      >
                        <p id="delete-title">
                          Удалить пакет «{{ row.units }} {{ row.unitsCaption }}»? Он уйдёт в архив
                          без возможности вернуть; поданные заявки и продажи не изменятся.
                        </p>
                        <div class="vt-root-billing__form-actions">
                          <button
                            data-delete-cancel
                            type="button"
                            class="vt-btn vt-btn--ghost vt-btn--sm"
                            @click="confirmId = null"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            class="vt-btn vt-btn--danger vt-btn--sm"
                            :disabled="busyId === row.id"
                            @click="archivePackage(row.id)"
                          >
                            Удалить пакет
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
                <tr v-if="unattributed.any" data-testid="package-row-unattributed">
                  <td colspan="5">
                    <span class="vt-root-billing__muted">Без пакета (до каталога)</span>
                  </td>
                  <td class="vt-mono">{{ unattributed.sold }}</td>
                  <td class="vt-mono vt-root-billing__income">{{ unattributed.revenue }}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </template>

    <section
      v-else-if="view === 'grants'"
      class="vt-card vt-root-billing__card vt-root-billing__grants"
      aria-labelledby="grants-title"
    >
      <div class="vt-root-billing__card-head">
        <div>
          <h2 id="grants-title">Ручные начисления</h2>
          <p class="vt-root-billing__hint">
            Промо, компенсации и исправления. Причина обязательна и попадает в аудит.
          </p>
        </div>
        <NuxtLink to="/root/billing-grant" class="vt-btn vt-btn--ink vt-btn--sm">
          <VtIcon name="plus" :size="13" /> Выдать баланс
        </NuxtLink>
      </div>
      <SkeletonList v-if="grantsPending && !grants.length" :count="3" />
      <ErrorState
        v-else-if="grantsFailed && !grants.length"
        message="Не удалось загрузить начисления"
        @retry="loadGrants()"
      />
      <EmptyState
        v-else-if="!grantRows.length"
        icon="clock"
        title="Начислений пока нет"
        description="Здесь появятся ручные начисления баланса организациям"
      />
      <div v-else class="vt-root-billing__table-wrap">
        <table class="vt-root-billing__table">
          <caption class="sr-only">
            Ручные начисления баланса событий, новые записи сверху
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Дата</th>
              <th scope="col" class="vt-cap">Организация</th>
              <th scope="col" class="vt-cap">Кол-во</th>
              <th scope="col" class="vt-cap">Причина</th>
              <th scope="col" class="vt-cap">Кем</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in grantRows" :key="row.id" data-grant-row>
              <td class="vt-mono vt-root-billing__muted">
                <time :datetime="row.isoTime">{{ row.time }}</time>
              </td>
              <td>
                <NuxtLink :to="`/root/organizations/${row.organizationId}`">
                  {{ row.organization }}
                </NuxtLink>
              </td>
              <td class="vt-mono vt-root-billing__income">{{ row.amount }}</td>
              <td>{{ row.reason }}</td>
              <td class="vt-mono vt-root-billing__muted">{{ row.actor }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="grantsCursor !== null" class="vt-root-billing__foot">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="grantsPending"
          @click="loadGrants(true)"
        >
          {{ grantsPending ? 'Загрузка…' : 'Загрузить ещё' }}
        </button>
      </footer>
    </section>

    <section v-else class="vt-card vt-root-billing__card" aria-labelledby="history-title">
      <div class="vt-root-billing__card-head">
        <div>
          <h2 id="history-title">История изменений</h2>
          <p class="vt-root-billing__hint">Создание, правки цены, видимость и архив пакетов.</p>
        </div>
      </div>
      <SkeletonList v-if="historyPending && !history.length" :count="4" />
      <ErrorState
        v-else-if="historyFailed && !history.length"
        message="Не удалось загрузить историю"
        @retry="loadHistory()"
      />
      <EmptyState
        v-else-if="!historyRows.length"
        icon="clock"
        title="Изменений пока нет"
        description="Здесь появятся правки каталога пакетов"
      />
      <div v-else class="vt-root-billing__table-wrap">
        <table class="vt-root-billing__table">
          <caption class="sr-only">
            История изменений пакетов, новые записи сверху
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Дата</th>
              <th scope="col" class="vt-cap">Событие</th>
              <th scope="col" class="vt-cap">Пакет</th>
              <th scope="col" class="vt-cap">Изменение</th>
              <th scope="col" class="vt-cap">Кто</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in historyRows" :key="row.id" data-history-row>
              <td class="vt-mono vt-root-billing__muted">
                <time :datetime="row.isoTime">{{ row.time }}</time>
              </td>
              <td>{{ row.title }}</td>
              <td class="vt-mono">{{ row.pkg }}</td>
              <td>{{ row.details }}</td>
              <td class="vt-mono vt-root-billing__muted">{{ row.actor }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="historyCursor !== null" class="vt-root-billing__foot">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="historyPending"
          @click="loadHistory(true)"
        >
          {{ historyPending ? 'Загрузка…' : 'Загрузить ещё' }}
        </button>
      </footer>
    </section>

    <VtToast />
  </div>
</template>
