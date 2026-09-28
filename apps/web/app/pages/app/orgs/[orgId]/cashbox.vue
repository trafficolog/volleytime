<script setup lang="ts">
import { DEFAULT_TIMEZONE, formatDay, zonedInputToDate } from '@volley-time/shared'

import {
  canSubmitDesktopLedgerAction,
  desktopBalanceRows,
  desktopLedgerFormTime,
  DESKTOP_EXPENSE_CATEGORIES,
  DESKTOP_INCOME_CATEGORIES,
  parseDesktopLedgerAmount,
  type LedgerBalance,
} from '~/utils/desktop-cashbox'
import { desktopSignInPath } from '~/utils/desktop-org-ui'
import { LEDGER_CATEGORY_LABELS, displayName, formatMoneyRu, label } from '~/utils/labels'

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
  occurredAt: string
  event: { id: number; title: string; startsAt: string } | null
  author: Person | null
  payer: Person | null
}
interface EventOption {
  id: number
  title: string
  startsAt: string
}
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const formTimezone = ref<string | null>(null)
const request = useRequestFetch()
const balance = ref<LedgerBalance | null>(null)
const entries = ref<Entry[]>([])
const filter = ref<'all' | 'income' | 'expense'>('all')
const loading = ref(false)
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
const announcement = ref('')
const amountInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  category: 'rent',
  amount: '',
  occurredAt: '',
  description: '',
  eventId: '',
})
const rows = computed(() => (balance.value ? desktopBalanceRows(balance.value) : []))
const categories = computed(() =>
  kind.value === 'income' ? DESKTOP_INCOME_CATEGORIES : DESKTOP_EXPENSE_CATEGORIES,
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
async function load() {
  const org = orgId.value,
    path = route.path,
    epoch = generation,
    token = ++loadToken
  loading.value = true
  loadError.value = ''
  entries.value = []
  try {
    const result = await request<{ balance: LedgerBalance; entries: Entry[] }>(
      `/api/organizations/${org}/ledger`,
      { query: { limit: 50, ...(filter.value === 'all' ? {} : { type: filter.value }) } },
    )
    if (live(org, path, epoch) && token === loadToken) {
      balance.value = result.balance
      entries.value = result.entries
    }
  } catch (error) {
    if (live(org, path, epoch) && token === loadToken)
      loadError.value = message(error, 'Не удалось загрузить кассу. Повторите попытку.')
  } finally {
    if (live(org, path, epoch) && token === loadToken) loading.value = false
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
function openForm(next: 'income' | 'expense') {
  if (saving.value || timezoneLoading.value) return
  const time = desktopLedgerFormTime(new Date(), timezone.value)
  if (!time) return
  formTimezone.value = time.timezone
  kind.value = next
  formError.value = ''
  amountError.value = ''
  Object.assign(form, {
    category: next === 'income' ? 'contribution' : 'rent',
    amount: '',
    occurredAt: time.occurredAt,
    description: '',
    eventId: '',
  })
  if (eventFilter.value !== 'upcoming') eventFilter.value = 'upcoming'
  else void loadEvents()
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
  announcement.value = ''
  const amount = parseDesktopLedgerAmount(form.amount)
  if (amount === null) {
    amountError.value = 'Введите сумму от 0,01 до 100 000 с двумя знаками после запятой или меньше.'
    amountInput.value?.focus()
    return
  }
  saving.value = true
  try {
    await request(`/api/organizations/${org}/ledger/${action}`, {
      method: 'POST',
      body: {
        category: form.category,
        amount,
        description: form.description.trim() || undefined,
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
watch(filter, () => {
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
    entries.value = []
    events.value = []
    eventsOffset.value = 0
    eventsHaveMore.value = false
    eventFilter.value = 'upcoming'
    kind.value = null
    saving.value = false
    loading.value = false
    eventsLoading.value = false
    accessStatus.value = undefined
    loadError.value = ''
    formError.value = ''
    eventsError.value = ''
    amountError.value = ''
    announcement.value = ''
    Object.assign(form, {
      category: 'rent',
      amount: '',
      occurredAt: '',
      description: '',
      eventId: '',
    })
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
        <p class="text-sm text-vt-mute">Баланс и последние движения денег</p>
      </div>
      <div v-if="balance && !accessStatus" class="vt-desktop-cashbox__actions">
        <button
          class="vt-btn vt-btn--ghost"
          type="button"
          :disabled="saving || !timezone || timezoneLoading"
          @click="openForm('expense')"
        >
          Добавить расход</button
        ><button
          class="vt-btn vt-btn--primary"
          type="button"
          :disabled="saving || !timezone || timezoneLoading"
          @click="openForm('income')"
        >
          <VtIcon name="plus" :size="16" /> Добавить доход
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
      <ErrorState v-if="loadError" :message="loadError" @retry="load" />
      <template v-if="balance">
        <section class="vt-desktop-cashbox__stats" aria-label="Баланс основной валюты">
          <div class="vt-card vt-card--hero p-6">
            <p class="vt-cap">Баланс кассы · {{ balance.currency }}</p>
            <strong class="vt-mono">{{ formatMoneyRu(balance.balance, balance.currency) }}</strong>
          </div>
          <div class="vt-card p-6">
            <p class="vt-cap">Доходы</p>
            <strong class="vt-mono text-vt-grass-ink">{{
              formatMoneyRu(balance.income, balance.currency)
            }}</strong>
          </div>
          <div class="vt-card p-6">
            <p class="vt-cap">Расходы</p>
            <strong class="vt-mono text-vt-rose-ink">{{
              formatMoneyRu(balance.expense, balance.currency)
            }}</strong>
          </div>
        </section>
        <ul v-if="rows.length > 1" class="space-y-2" aria-label="Другие валюты">
          <li v-for="row in rows.slice(1)" :key="row.currency" class="vt-card p-4">
            {{ row.currency }}: баланс {{ formatMoneyRu(row.balance, row.currency) }} · доходы
            {{ formatMoneyRu(row.income, row.currency) }} · расходы
            {{ formatMoneyRu(row.expense, row.currency) }}
          </li>
        </ul>
      </template>
      <section
        v-if="kind"
        class="vt-card vt-desktop-cashbox__form space-y-4"
        aria-labelledby="ledger-form-heading"
      >
        <h2 id="ledger-form-heading">{{ kind === 'income' ? 'Новый доход' : 'Новый расход' }}</h2>
        <p class="text-sm text-vt-mute">
          Валюта: {{ balance?.currency }} · дата и время: {{ tz }}. Запись нельзя изменить или
          удалить.
        </p>
        <form class="space-y-4" @submit.prevent="save">
          <fieldset :disabled="saving" class="vt-desktop-cashbox__fields">
            <label
              >Категория<select v-model="form.category" class="vt-field">
                <option v-for="category in categories" :key="category" :value="category">
                  {{ label(LEDGER_CATEGORY_LABELS, category) }}
                </option>
              </select></label
            ><label
              >Сумма<input
                ref="amountInput"
                v-model="form.amount"
                class="vt-field"
                inputmode="decimal"
                autocomplete="off"
                :aria-invalid="!!amountError"
                aria-describedby="ledger-amount-error"
                placeholder="0,00"
              /><span id="ledger-amount-error" class="text-sm text-vt-rose-ink">{{
                amountError
              }}</span></label
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
              >Описание (необязательно)<textarea
                v-model="form.description"
                class="vt-field"
                maxlength="500"
                rows="3"
              />
            </label>
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
          <div class="vt-desktop-cashbox__actions">
            <button
              type="button"
              class="vt-btn vt-btn--ghost"
              :disabled="saving"
              @click="kind = null"
            >
              Отменить</button
            ><button type="submit" class="vt-btn vt-btn--primary" :disabled="saving">
              {{ saving ? 'Сохраняем…' : 'Записать операцию' }}
            </button>
          </div>
        </form>
      </section>
      <section class="space-y-4" aria-labelledby="ledger-heading" :aria-busy="loading">
        <div class="vt-desktop-section-heading">
          <div>
            <h2 id="ledger-heading">Последние операции</h2>
            <p class="text-sm text-vt-mute">До 50 записей · новые по дате операции сверху</p>
          </div>
          <label class="vt-desktop-payment-filter"
            >Тип<select v-model="filter" class="vt-input">
              <option value="all">Все</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select></label
          >
        </div>
        <EmptyState
          v-if="!loading && !loadError && !entries.length"
          icon="wallet"
          title="Операций пока нет"
          description="Подтверждённые оплаты и ручные операции появятся здесь. Попробуйте другой тип или добавьте операцию."
        />
        <ul v-if="entries.length && timezone" class="vt-desktop-cashbox__journal vt-card">
          <li v-for="entry in entries" :key="entry.id">
            <time :datetime="entry.occurredAt" class="text-sm text-vt-mute">{{
              formatDay(entry.occurredAt, tz)
            }}</time>
            <div>
              <h3>{{ label(LEDGER_CATEGORY_LABELS, entry.category) }}</h3>
              <p v-if="entry.description" class="text-sm">{{ entry.description }}</p>
              <p class="text-sm text-vt-mute">
                <template v-if="entry.event">{{ entry.event.title }} · </template
                ><template v-if="entry.payer">{{ displayName(entry.payer) }} · </template
                ><template v-if="entry.author">Внёс {{ displayName(entry.author) }}</template>
              </p>
            </div>
            <div class="vt-mono">
              <span>{{ entry.type === 'income' ? 'Доход' : 'Расход' }}</span
              ><strong :class="entry.type === 'income' ? 'text-vt-grass-ink' : 'text-vt-rose-ink'"
                >{{ entry.type === 'income' ? '+' : '−'
                }}{{ formatMoneyRu(entry.amount, entry.currency) }}</strong
              >
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
