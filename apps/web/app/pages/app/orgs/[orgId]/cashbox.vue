<script setup lang="ts">
import { DEFAULT_TIMEZONE, formatDay, formatTime, zonedInputToDate } from '@volley-time/shared'

import {
  balanceAfterEntry,
  canSubmitDesktopLedgerAction,
  desktopLedgerFormTime,
  DESKTOP_EXPENSE_CATEGORIES,
  DESKTOP_INCOME_CATEGORIES,
  monthPeriod,
  parseDesktopLedgerAmount,
  signedMoney,
  validateLedgerComment,
  type LedgerBalance,
} from '~/utils/desktop-cashbox'
import { desktopSignInPath } from '~/utils/desktop-org-ui'
import {
  LEDGER_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  displayName,
  formatMoneyRu,
  label,
} from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })
interface Person {
  name: string | null
  telegramUsername: string | null
}
interface Entry {
  id: number
  type: 'income' | 'expense'
  category: string
  amount: number
  currency: string
  description: string | null
  method: string | null
  occurredAt: string
  event: { id: number; title: string; startsAt: string } | null
  author: Person | null
  payer: Person | null
}
interface Awaiting {
  amount: number
  count: number
  currency: string
}
interface EventOption {
  id: number
  title: string
  startsAt: string
}
const PAGE = 50
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const formTimezone = ref<string | null>(null)
const request = useRequestFetch()
const balance = ref<LedgerBalance | null>(null)
const awaiting = ref<Awaiting | null>(null)
const period = ref<{ income: number; expense: number; currency: string } | null>(null)
const entries = ref<Entry[]>([])
const hasMore = ref(false)
const filter = ref<'all' | 'income' | 'expense'>('all')
const category = ref('')
const month = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const accessStatus = ref<number>()
const kind = ref<'income' | 'expense' | null>(null)
const events = ref<EventOption[]>([])
const eventsLoading = ref(false)
const eventsError = ref('')
const eventFilter = ref<'upcoming' | 'past'>('upcoming')
const eventsOffset = ref(0)
const eventsHaveMore = ref(false)
const saving = ref(false)
const formError = ref('')
const amountError = ref('')
const commentError = ref('')
const announcement = ref('')
const amountInput = ref<HTMLInputElement | null>(null)
const commentInput = ref<HTMLTextAreaElement | null>(null)
const form = reactive({
  category: 'rent',
  amount: '',
  occurredAt: '',
  description: '',
  eventId: '',
})
const typeOptions = [
  { value: 'all', label: 'Все' },
  { value: 'income', label: 'Поступления' },
  { value: 'expense', label: 'Расходы' },
]
const kindOptions = [
  { value: 'income', label: 'Поступление' },
  { value: 'expense', label: 'Расход' },
]
const kindModel = computed({
  get: () => kind.value ?? 'expense',
  set: (next: string) => switchKind(next as 'income' | 'expense'),
})
const categories = computed(() =>
  kind.value === 'income' ? DESKTOP_INCOME_CATEGORIES : DESKTOP_EXPENSE_CATEGORIES,
)
const allCategories = Object.keys(LEDGER_CATEGORY_LABELS)
const currency = computed(() => balance.value?.currency ?? 'BYN')
const enteredAmount = computed(() => parseDesktopLedgerAmount(form.amount))
const afterBalance = computed(() =>
  balance.value && kind.value && enteredAmount.value !== null
    ? balanceAfterEntry(balance.value.balance, kind.value, enteredAmount.value)
    : null,
)
let active = true,
  generation = 0,
  loadToken = 0,
  eventToken = 0
function live(org: number, path: string, epoch: number) {
  return active && orgId.value === org && route.path === path && generation === epoch
}
function message(error: unknown, fallback: string) {
  const status = apiErrorStatus(error)
  if (status === 401 || status === 403 || status === 404) {
    accessStatus.value = status
    balance.value = null
    awaiting.value = null
    period.value = null
    entries.value = []
    kind.value = null
    events.value = []
  }
  return apiErrorMessage(error, fallback)
}
const {
  timezone,
  loading: timezoneLoading,
  error: timezoneError,
  load: fetchTimezone,
} = useDesktopFinanceTimezone(orgId, (error) => message(error, ''))
const tz = computed(() => timezone.value ?? DEFAULT_TIMEZONE)

/** Фильтры журнала — общие для списка и выгрузки CSV. Период — по часовому поясу группы. */
function filterQuery(): Record<string, string> {
  const query: Record<string, string> = {}
  if (filter.value !== 'all') query.type = filter.value
  if (category.value) query.category = category.value
  const period = timezone.value ? monthPeriod(month.value, timezone.value) : null
  if (period) Object.assign(query, period)
  return query
}
const exportHref = computed(() => {
  const qs = new URLSearchParams(filterQuery()).toString()
  return `/api/organizations/${orgId.value}/ledger/export${qs ? `?${qs}` : ''}`
})
const monthTitle = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(month.value)
  if (!m) return 'за всё время'
  const name = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)),
  )
  return `${name} ${m[1]}`
})

async function load(more = false) {
  if (more && (loadingMore.value || !hasMore.value)) return
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    token = ++loadToken,
    offset = more ? entries.value.length : 0
  if (more) loadingMore.value = true
  else {
    loading.value = true
    entries.value = []
  }
  loadError.value = ''
  try {
    const result = await request<{
      balance: LedgerBalance
      awaiting: Awaiting
      period: { income: number; expense: number; currency: string }
      entries: Entry[]
    }>(`/api/organizations/${org}/ledger`, { query: { limit: PAGE, offset, ...filterQuery() } })
    if (live(org, path, epoch) && token === loadToken) {
      balance.value = result.balance
      awaiting.value = result.awaiting
      period.value = result.period
      entries.value = more ? [...entries.value, ...result.entries] : result.entries
      hasMore.value = result.entries.length === PAGE
    }
  } catch (error) {
    if (live(org, path, epoch) && token === loadToken)
      loadError.value = message(error, 'Не удалось загрузить кассу. Повторите попытку.')
  } finally {
    if (live(org, path, epoch) && token === loadToken) {
      loading.value = false
      loadingMore.value = false
    }
  }
}
async function loadEvents(more = false) {
  if (!kind.value || (more && (eventsLoading.value || !eventsHaveMore.value))) return
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    token = ++eventToken,
    selectedFilter = eventFilter.value,
    offset = more ? eventsOffset.value : 0
  if (!more) {
    events.value = []
    eventsOffset.value = 0
    eventsHaveMore.value = false
  }
  eventsLoading.value = true
  eventsError.value = ''
  try {
    const result = await request<{ events: EventOption[] }>(`/api/organizations/${org}/events`, {
      query: { filter: selectedFilter, limit: 30, offset },
    })
    if (live(org, path, epoch) && token === eventToken && kind.value) {
      events.value = more ? [...events.value, ...result.events] : result.events
      eventsOffset.value = offset + result.events.length
      eventsHaveMore.value = result.events.length === 30
    }
  } catch (error) {
    if (live(org, path, epoch) && token === eventToken)
      eventsError.value = message(
        error,
        'Не удалось загрузить события. Повторите попытку или сохраните без события.',
      )
  } finally {
    if (live(org, path, epoch) && token === eventToken) eventsLoading.value = false
  }
}
async function loadTimezone() {
  kind.value = null
  formTimezone.value = null
  await fetchTimezone()
}
function defaultCategory(next: 'income' | 'expense') {
  return next === 'income' ? 'contribution' : 'rent'
}
function openForm(next: 'income' | 'expense') {
  if (saving.value || timezoneLoading.value) return
  const time = desktopLedgerFormTime(new Date(), timezone.value)
  if (!time) return
  formTimezone.value = time.timezone
  kind.value = next
  formError.value = ''
  amountError.value = ''
  commentError.value = ''
  Object.assign(form, {
    category: defaultCategory(next),
    amount: '',
    occurredAt: time.occurredAt,
    description: '',
    eventId: '',
  })
  if (eventFilter.value !== 'upcoming') eventFilter.value = 'upcoming'
  else void loadEvents()
}
function switchKind(next: 'income' | 'expense') {
  if (saving.value || !kind.value || kind.value === next) return
  kind.value = next
  form.category = defaultCategory(next)
}
async function save() {
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    action = kind.value
  if (
    !active ||
    !action ||
    !formTimezone.value ||
    formTimezone.value !== timezone.value ||
    timezoneLoading.value ||
    accessStatus.value ||
    !canSubmitDesktopLedgerAction(
      route.path,
      `/app/orgs/${org}/cashbox`,
      org,
      orgId.value,
      saving.value,
    )
  )
    return
  formError.value = ''
  amountError.value = ''
  commentError.value = ''
  announcement.value = ''
  const amount = parseDesktopLedgerAmount(form.amount)
  if (amount === null) {
    amountError.value = 'Введите сумму от 0,01 до 100 000 с двумя знаками после запятой или меньше.'
    amountInput.value?.focus()
    return
  }
  commentError.value = validateLedgerComment(form.description)
  if (commentError.value) {
    commentInput.value?.focus()
    return
  }
  saving.value = true
  try {
    await request(`/api/organizations/${org}/ledger/${action}`, {
      method: 'POST',
      body: {
        category: form.category,
        amount,
        description: form.description.trim(),
        occurredAt: form.occurredAt
          ? zonedInputToDate(form.occurredAt, formTimezone.value).toISOString()
          : undefined,
        eventId: form.eventId ? Number(form.eventId) : undefined,
      },
    })
    if (!live(org, path, epoch)) return
    kind.value = null
    announcement.value = 'Операция записана.'
    await load()
  } catch (error) {
    if (live(org, path, epoch))
      formError.value = message(error, 'Не удалось сохранить операцию. Повторите попытку.')
  } finally {
    if (live(org, path, epoch)) saving.value = false
  }
}
function entryDate(entry: Entry) {
  return `${formatDay(entry.occurredAt, tz.value)}, ${formatTime(entry.occurredAt, tz.value)}`
}
function entryTitle(entry: Entry) {
  const parts: string[] = []
  if (entry.payer) parts.push(displayName(entry.payer))
  if (entry.event) parts.push(entry.event.title)
  if (entry.description) parts.push(entry.description)
  return parts.join(' · ') || label(LEDGER_CATEGORY_LABELS, entry.category)
}
watch([filter, category, month], () => {
  void load()
})
watch(eventFilter, () => {
  form.eventId = ''
  if (kind.value) void loadEvents()
})
watch(
  () => route.path,
  () => {
    generation++
    timezone.value = null
    formTimezone.value = null
    timezoneError.value = ''
    timezoneLoading.value = true
    balance.value = null
    awaiting.value = null
    period.value = null
    entries.value = []
    hasMore.value = false
    events.value = []
    eventsOffset.value = 0
    eventsHaveMore.value = false
    eventFilter.value = 'upcoming'
    kind.value = null
    saving.value = false
    loading.value = false
    loadingMore.value = false
    eventsLoading.value = false
    accessStatus.value = undefined
    loadError.value = ''
    formError.value = ''
    eventsError.value = ''
    amountError.value = ''
    commentError.value = ''
    announcement.value = ''
    Object.assign(form, {
      category: 'rent',
      amount: '',
      occurredAt: '',
      description: '',
      eventId: '',
    })
    category.value = ''
    month.value = ''
    if (filter.value !== 'all') filter.value = 'all'
    if (route.path === `/app/orgs/${orgId.value}/cashbox`) {
      void load()
      void loadTimezone()
    }
  },
)
onBeforeUnmount(() => {
  active = false
  generation++
  timezone.value = null
  formTimezone.value = null
  balance.value = null
  entries.value = []
  events.value = []
  kind.value = null
})
onMounted(() => {
  void loadTimezone()
})
await load()
</script>

<template>
  <div class="vt-desktop-cashbox space-y-6">
    <header class="vt-desktop-page-heading">
      <div>
        <p class="vt-desktop-eyebrow">Финансы группы</p>
        <h1 tabindex="-1">Касса</h1>
        <p class="text-sm text-vt-mute">{{ monthTitle }} · полный журнал движений</p>
      </div>
      <div v-if="balance && !accessStatus" class="vt-desktop-cashbox__actions">
        <a
          v-if="!kind"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :href="exportHref"
          download
          data-testid="cashbox-export"
        >
          <VtIcon name="arrow-r" :size="14" /> Экспорт CSV
        </a>
        <template v-if="kind">
          <button
            class="vt-btn vt-btn--ghost vt-btn--sm"
            type="button"
            :disabled="saving"
            @click="kind = null"
          >
            Отмена
          </button>
          <button
            class="vt-btn vt-btn--primary vt-btn--sm"
            type="submit"
            form="ledger-form"
            :disabled="saving"
          >
            <VtIcon name="check" :size="14" /> {{ saving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </template>
        <button
          v-else
          class="vt-btn vt-btn--primary vt-btn--sm"
          type="button"
          :disabled="saving || !timezone || timezoneLoading"
          @click="openForm('income')"
        >
          <VtIcon name="plus" :size="14" /> Запись
        </button>
      </div>
    </header>
    <p role="status">{{ announcement }}</p>
    <section v-if="accessStatus" class="vt-card p-6 space-y-3" role="alert">
      <h2>{{ accessStatus === 401 ? 'Нужно войти' : 'Нет доступа к кассе' }}</h2>
      <NuxtLink
        v-if="accessStatus === 401"
        :to="desktopSignInPath(route.fullPath)"
        class="vt-btn vt-btn--primary"
        >Войти по email</NuxtLink
      ><NuxtLink v-else to="/app?choose=1" class="vt-btn vt-btn--ghost">К моим группам</NuxtLink>
    </section>
    <template v-else>
      <p v-if="loading" role="status">Загружаем кассу…</p>
      <p v-if="timezoneLoading" role="status">
        Загружаем часовой пояс группы перед добавлением операций…
      </p>
      <ErrorState v-if="timezoneError" :message="timezoneError" @retry="loadTimezone" />
      <ErrorState v-if="loadError" :message="loadError" @retry="load()" />
      <template v-if="balance">
        <section v-if="!kind" class="vt-desktop-cashbox__stats" aria-label="Баланс основной валюты">
          <div class="vt-card vt-card--hero p-6">
            <p class="vt-cap">Баланс кассы · {{ balance.currency }}</p>
            <strong class="vt-mono" data-testid="cashbox-balance">{{
              signedMoney(balance.balance, balance.currency)
            }}</strong>
            <p class="text-sm">по всем операциям группы</p>
          </div>
          <div class="vt-card p-6">
            <p class="vt-cap">Поступило · {{ monthTitle }}</p>
            <strong class="vt-mono text-vt-grass-ink" data-testid="cashbox-income">{{
              signedMoney(period?.income ?? 0, balance.currency)
            }}</strong>
          </div>
          <div class="vt-card p-6">
            <p class="vt-cap">Списано · {{ monthTitle }}</p>
            <strong class="vt-mono text-vt-rose-ink" data-testid="cashbox-expense">{{
              signedMoney(-(period?.expense ?? 0), balance.currency)
            }}</strong>
          </div>
          <div class="vt-card p-6">
            <p class="vt-cap">Долги</p>
            <strong class="vt-mono text-vt-amber-ink" data-testid="cashbox-awaiting">{{
              formatMoneyRu(awaiting?.amount ?? 0, awaiting?.currency ?? balance.currency)
            }}</strong>
            <p class="text-sm text-vt-mute">
              ждут оплаты{{ awaiting?.count ? `: ${awaiting.count}` : '' }}
            </p>
          </div>
        </section>
        <ul
          v-if="!kind && Object.keys(balance.byCurrency).some((c) => c !== balance!.currency)"
          class="space-y-2"
          aria-label="Другие валюты"
        >
          <li
            v-for="(row, code) in balance.byCurrency"
            v-show="code !== balance.currency"
            :key="code"
            class="vt-card p-4"
          >
            {{ code }}: баланс {{ formatMoneyRu(row.balance, String(code)) }} · доходы
            {{ formatMoneyRu(row.income, String(code)) }} · расходы
            {{ formatMoneyRu(row.expense, String(code)) }}
          </li>
        </ul>
      </template>
      <section v-if="kind" class="vt-cashbox-form space-y-4" aria-labelledby="ledger-form-heading">
        <div>
          <h2 id="ledger-form-heading">
            {{ kind === 'income' ? 'Новое поступление' : 'Новый расход' }}
          </h2>
          <p class="text-sm text-vt-mute">
            Ручная запись в кассу организации · дата и время: {{ tz }}. Запись нельзя изменить или
            удалить.
          </p>
        </div>
        <VtSegment v-model="kindModel" label="Тип записи" :options="kindOptions" />
        <form id="ledger-form" class="vt-card space-y-4 p-6" novalidate @submit.prevent="save">
          <fieldset :disabled="saving" class="vt-desktop-cashbox__fields">
            <label class="vt-desktop-cashbox__description"
              >Сумма, {{ currency
              }}<input
                ref="amountInput"
                v-model="form.amount"
                class="vt-field vt-mono"
                inputmode="decimal"
                autocomplete="off"
                :aria-invalid="!!amountError"
                aria-describedby="ledger-amount-error"
                placeholder="0,00"
              /><span id="ledger-amount-error" class="text-sm text-vt-rose-ink">{{
                amountError
              }}</span></label
            ><label
              >Категория<select v-model="form.category" class="vt-field">
                <option v-for="item in categories" :key="item" :value="item">
                  {{ label(LEDGER_CATEGORY_LABELS, item) }}
                </option>
              </select></label
            ><label
              >Дата и время<input
                v-model="form.occurredAt"
                type="datetime-local"
                class="vt-field" /></label
            ><label
              >Период событий<select v-model="eventFilter" class="vt-field">
                <option value="upcoming">Предстоящие</option>
                <option value="past">Прошедшие</option>
              </select></label
            ><label
              >Событие (необязательно)<select
                v-model="form.eventId"
                class="vt-field"
                :disabled="eventsLoading"
              >
                <option value="">Без события</option>
                <option v-for="event in events" :key="event.id" :value="String(event.id)">
                  {{ event.title }} · {{ formatDay(event.startsAt, tz) }}
                </option>
              </select></label
            ><label class="vt-desktop-cashbox__description"
              >Комментарий<textarea
                ref="commentInput"
                v-model="form.description"
                class="vt-field"
                maxlength="500"
                rows="2"
                required
                :aria-invalid="!!commentError"
                aria-describedby="ledger-comment-error"
                :placeholder="
                  kind === 'income' ? 'Например: доплата за гостя' : 'Например: аренда зала, 2 часа'
                "
              /><span id="ledger-comment-error" class="text-sm text-vt-rose-ink">{{
                commentError
              }}</span></label
            >
          </fieldset>
          <p v-if="eventsLoading" role="status">Загружаем события…</p>
          <ErrorState
            v-if="eventsError"
            :message="eventsError"
            @retry="loadEvents(events.length > 0)"
          />
          <button
            v-if="eventsHaveMore"
            type="button"
            class="vt-btn vt-btn--ghost"
            :disabled="eventsLoading || saving"
            @click="loadEvents(true)"
          >
            {{ eventsLoading ? 'Загружаем…' : 'Показать ещё события' }}
          </button>
          <p v-if="formError" role="alert" class="text-vt-rose-ink">{{ formError }}</p>
        </form>
        <div class="vt-card vt-cashbox-form__after">
          <span class="text-sm text-vt-mute">Баланс кассы после записи</span>
          <strong class="vt-mono" data-testid="cashbox-after">{{
            afterBalance === null ? '—' : signedMoney(afterBalance, currency)
          }}</strong>
        </div>
      </section>
      <section v-if="!kind" class="space-y-4" aria-labelledby="ledger-heading" :aria-busy="loading">
        <h2 id="ledger-heading" class="sr-only">Журнал операций</h2>
        <div class="vt-cashbox-filters">
          <label class="vt-desktop-payment-filter"
            ><VtIcon name="calendar" :size="14" /> Месяц<input
              v-model="month"
              type="month"
              class="vt-field"
              :disabled="!timezone"
          /></label>
          <button
            v-if="month"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            @click="month = ''"
          >
            Весь период
          </button>
          <VtSegment v-model="filter" label="Тип операций" variant="chips" :options="typeOptions" />
          <label class="vt-desktop-payment-filter"
            >Категория<select v-model="category" class="vt-field">
              <option value="">Все</option>
              <option v-for="item in allCategories" :key="item" :value="item">
                {{ label(LEDGER_CATEGORY_LABELS, item) }}
              </option>
            </select></label
          >
          <span class="vt-cashbox-filters__sort text-sm text-vt-mute"
            >Сортировка: <b>новые сверху</b></span
          >
        </div>
        <EmptyState
          v-if="!loading && !loadError && !entries.length"
          icon="wallet"
          title="Операций пока нет"
          description="Подтверждённые оплаты и ручные операции появятся здесь. Попробуйте другой период или фильтр либо добавьте запись."
        />
        <div v-if="entries.length && timezone" class="vt-card vt-cashbox-journal">
          <div class="vt-cashbox-journal__row vt-cashbox-journal__head" aria-hidden="true">
            <span class="vt-cap">Дата</span><span class="vt-cap">Описание</span
            ><span class="vt-cap">Категория</span><span class="vt-cap">Способ</span
            ><span class="vt-cap vt-cashbox-journal__amount">Сумма</span>
          </div>
          <ul>
            <li v-for="entry in entries" :key="entry.id" class="vt-cashbox-journal__row">
              <time :datetime="entry.occurredAt" class="vt-mono text-sm text-vt-mute">{{
                entryDate(entry)
              }}</time>
              <div class="vt-cashbox-journal__what">
                <p>{{ entryTitle(entry) }}</p>
                <p v-if="entry.author" class="text-sm text-vt-mute">
                  Внёс {{ displayName(entry.author) }}
                </p>
              </div>
              <span class="vt-chip">{{ label(LEDGER_CATEGORY_LABELS, entry.category) }}</span>
              <span class="text-sm text-vt-mute">{{
                entry.method ? label(PAYMENT_METHOD_LABELS, entry.method) : '—'
              }}</span>
              <strong
                :class="[
                  'vt-mono vt-cashbox-journal__amount',
                  entry.type === 'income' ? 'text-vt-grass-ink' : 'text-vt-rose-ink',
                ]"
                ><span class="sr-only">{{
                  entry.type === 'income' ? 'Поступление' : 'Расход'
                }}</span
                >{{
                  signedMoney(
                    entry.type === 'income' ? entry.amount : -entry.amount,
                    entry.currency,
                  )
                }}</strong
              >
            </li>
          </ul>
        </div>
        <button
          v-if="hasMore"
          type="button"
          class="vt-btn vt-btn--ghost"
          :disabled="loadingMore"
          @click="load(true)"
        >
          {{ loadingMore ? 'Загружаем…' : 'Показать ещё' }}
        </button>
      </section>
    </template>
  </div>
</template>
