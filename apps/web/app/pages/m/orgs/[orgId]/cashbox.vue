<script setup lang="ts">
import {
  dateToZonedInput,
  formatDay,
  formatShortDate,
  toMinor,
  zonedInputToDate,
} from '@volley-time/shared'

import { LEDGER_CATEGORY_LABELS, displayName, formatMoneyRu, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

interface Balance {
  currency: string
  income: number
  expense: number
  balance: number
  byCurrency: Record<string, { income: number; expense: number; balance: number }>
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
  author: { name: string | null; telegramUsername: string | null } | null
  payer: { name: string | null; telegramUsername: string | null } | null
}
interface EventOption {
  id: number
  title: string
  startsAt: string
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { haptic } = useTelegram()

const balance = ref<Balance | null>(null)
const entries = ref<Entry[]>([])
const loading = ref(false)
const loadError = ref('')
const forbidden = ref(false)
const filter = ref<'all' | 'income' | 'expense'>('all')
const loadedOrgId = ref<number | null>(null)
let loadVersion = 0

async function load() {
  const requestedOrgId = orgId.value
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  forbidden.value = false
  loadedOrgId.value = null
  balance.value = null
  entries.value = []
  try {
    const data = await $fetch<{ balance: Balance; entries: Entry[] }>(
      `/api/organizations/${requestedOrgId}/ledger`,
      { query: filter.value === 'all' ? { limit: 200 } : { type: filter.value, limit: 200 } },
    )
    if (version !== loadVersion || requestedOrgId !== orgId.value) return
    balance.value = data.balance
    entries.value = data.entries
    loadedOrgId.value = requestedOrgId
  } catch (e) {
    if (version !== loadVersion || requestedOrgId !== orgId.value) return
    if (apiErrorStatus(e) === 403) forbidden.value = true
    else loadError.value = apiErrorMessage(e, 'Не удалось загрузить кассу')
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
await load()
watch(filter, load)
watch(orgId, () => {
  sheetKind.value = null
  events.value = []
  formError.value = ''
  void load()
})

/** Группировка по дню операции в TZ организации. */
const groups = computed(() => {
  const map = new Map<
    string,
    { day: string; items: Entry[]; netByCurrency: Record<string, number> }
  >()
  for (const e of entries.value) {
    const key = formatShortDate(e.occurredAt, tz.value)
    if (!map.has(key))
      map.set(key, { day: formatDay(e.occurredAt, tz.value), items: [], netByCurrency: {} })
    const g = map.get(key)!
    g.items.push(e)
    g.netByCurrency[e.currency] =
      (g.netByCurrency[e.currency] ?? 0) + (e.type === 'income' ? e.amount : -e.amount)
  }
  return [...map.values()]
})
const otherCurrencies = computed(() =>
  Object.entries(balance.value?.byCurrency ?? {}).filter(([c]) => c !== balance.value?.currency),
)

// операция
type Kind = 'expense' | 'income'
const sheetKind = ref<Kind | null>(null)
const sheetOrgId = ref<number | null>(null)
const sheetOpen = computed({
  get: () => sheetKind.value !== null,
  set: (v) => {
    if (!v) {
      sheetKind.value = null
      sheetOrgId.value = null
    }
  },
})
const events = ref<EventOption[]>([])
const form = reactive({
  category: 'rent',
  amountMajor: '',
  description: '',
  occurredAt: '',
  eventId: '' as number | '',
})
const saving = ref(false)
const formError = ref('')

async function openSheet(kind: Kind) {
  if (loadedOrgId.value !== orgId.value || loading.value || forbidden.value) return
  const requestedOrgId = orgId.value
  formError.value = ''
  Object.assign(form, {
    category: kind === 'expense' ? 'rent' : 'contribution',
    amountMajor: '',
    description: '',
    occurredAt: dateToZonedInput(new Date(), tz.value),
    eventId: '',
  })
  sheetKind.value = kind
  sheetOrgId.value = requestedOrgId
  if (events.value.length === 0) {
    try {
      const data = await $fetch<{ events: EventOption[] }>(
        `/api/organizations/${requestedOrgId}/events`,
        {
          query: { filter: 'all', limit: 30 },
        },
      )
      if (requestedOrgId === orgId.value) events.value = data.events
    } catch {
      if (requestedOrgId === orgId.value) events.value = []
    }
  }
}

async function save() {
  if (
    !sheetKind.value ||
    saving.value ||
    sheetOrgId.value !== orgId.value ||
    loadedOrgId.value !== orgId.value
  )
    return
  const actionOrgId = orgId.value
  const kind = sheetKind.value
  formError.value = ''
  const major = Number(String(form.amountMajor).replace(',', '.'))
  if (!Number.isFinite(major) || major <= 0) {
    formError.value = 'Введите сумму больше нуля'
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/organizations/${actionOrgId}/ledger/${kind}`, {
      method: 'POST',
      body: {
        category: form.category,
        amount: toMinor(major),
        description: form.description.trim() || undefined,
        occurredAt: form.occurredAt
          ? zonedInputToDate(form.occurredAt, tz.value).toISOString()
          : undefined,
        eventId: form.eventId || undefined,
      },
    })
    if (actionOrgId !== orgId.value) return
    haptic('success')
    sheetKind.value = null
    sheetOrgId.value = null
    await load()
  } catch (e) {
    if (actionOrgId !== orgId.value) return
    haptic('error')
    formError.value = apiErrorMessage(e, 'Не удалось сохранить операцию')
  } finally {
    saving.value = false
  }
}

const EXPENSE_CATS = ['rent', 'equipment', 'salary', 'other']
const INCOME_CATS = ['contribution', 'carryover', 'donation', 'sponsorship', 'other_income']

function entrySubtitle(e: Entry): string {
  const parts: string[] = []
  if (e.payer) parts.push(displayName(e.payer))
  if (e.event) parts.push(`${e.event.title}, ${formatDay(e.event.startsAt, tz.value)}`)
  if (e.description && e.category !== 'payment_income') parts.push(e.description)
  if (!e.payer && e.author) parts.push(`внёс ${displayName(e.author)}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Касса" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4 space-y-4">
      <EmptyState
        v-if="forbidden"
        icon="wallet"
        title="Касса доступна организаторам"
        description="Здесь организатор ведёт доходы и расходы группы."
      />
      <template v-else>
        <SkeletonList v-if="loading && !balance" :count="2" />
        <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
        <template v-else-if="balance">
          <section
            class="vt-card vt-card--hero cashbox-balance-hero p-5 text-white"
            aria-label="Баланс кассы"
          >
            <div class="vt-cap">Баланс</div>
            <div
              class="vt-mono text-3xl font-bold mt-2 break-words"
              :class="balance.balance < 0 ? 'text-[var(--vt-amber)]' : ''"
            >
              {{ formatMoneyRu(balance.balance, balance.currency) }}
            </div>
            <div class="cashbox-balance-breakdown grid grid-cols-2 gap-3 mt-5 text-sm">
              <div>
                <div class="text-xs opacity-75">Доходы</div>
                <div class="vt-mono font-semibold break-words">
                  +{{ formatMoneyRu(balance.income, balance.currency) }}
                </div>
              </div>
              <div>
                <div class="text-xs opacity-75">Расходы</div>
                <div class="vt-mono font-semibold break-words">
                  −{{ formatMoneyRu(balance.expense, balance.currency) }}
                </div>
              </div>
            </div>
          </section>

          <section v-if="otherCurrencies.length" class="vt-card p-4" aria-label="Другие валюты">
            <h2 class="vt-cap">Другие валюты</h2>
            <p
              v-for="[cur, b] in otherCurrencies"
              :key="cur"
              class="vt-mono mt-2 text-sm font-semibold"
            >
              {{ formatMoneyRu(b.balance, cur) }}
              <span class="block text-xs font-normal text-vt-mute-2">
                Доходы +{{ formatMoneyRu(b.income, cur) }} · Расходы −{{
                  formatMoneyRu(b.expense, cur)
                }}
              </span>
            </p>
          </section>

          <div class="cashbox-operation-actions grid grid-cols-2 gap-2">
            <button type="button" class="vt-btn vt-btn--ghost" @click="openSheet('expense')">
              <VtIcon name="plus" :size="14" /> Расход
            </button>
            <button type="button" class="vt-btn vt-btn--primary" @click="openSheet('income')">
              <VtIcon name="plus" :size="14" /> Поступление
            </button>
          </div>

          <h2 class="vt-cap pt-2">Журнал операций</h2>
          <div class="cashbox-filters flex gap-1" role="tablist" aria-label="Фильтр операций">
            <button
              v-for="f in [
                { id: 'all', label: 'Все' },
                { id: 'income', label: 'Доходы' },
                { id: 'expense', label: 'Расходы' },
              ] as const"
              :key="f.id"
              type="button"
              role="tab"
              :aria-selected="filter === f.id"
              class="vt-btn vt-btn--sm flex-1 !rounded-full"
              :class="filter === f.id ? 'vt-btn--ink' : 'text-vt-mute-2'"
              @click="filter = f.id"
            >
              {{ f.label }}
            </button>
          </div>

          <EmptyState v-if="groups.length === 0" icon="chart" title="Операций пока нет" />
          <section v-for="g in groups" :key="g.day">
            <div class="flex items-center justify-between mb-1.5 px-1">
              <h2 class="vt-cap">{{ g.day }}</h2>
              <span class="flex flex-wrap justify-end gap-x-2">
                <span
                  v-for="[currency, net] in Object.entries(g.netByCurrency)"
                  :key="currency"
                  class="vt-mono text-xs"
                  :class="net < 0 ? 'text-vt-rose-ink' : 'text-vt-grass-ink'"
                  >{{ net < 0 ? '−' : '+' }}{{ formatMoneyRu(Math.abs(net), currency) }}</span
                >
              </span>
            </div>
            <ul class="vt-card divide-y divide-[var(--vt-stroke)] overflow-hidden">
              <li v-for="e in g.items" :key="e.id" class="flex items-center gap-3 px-3.5 py-2.5">
                <span
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  :class="
                    e.type === 'income'
                      ? 'bg-[var(--vt-grass-soft)] text-vt-grass-ink'
                      : 'bg-[var(--vt-rose-soft)] text-vt-rose-ink'
                  "
                >
                  <VtIcon :name="e.type === 'income' ? 'arrow-r' : 'wallet'" :size="15" />
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-semibold">
                    {{ label(LEDGER_CATEGORY_LABELS, e.category) }}
                  </div>
                  <div class="text-[11px] text-vt-mute-2 truncate">{{ entrySubtitle(e) }}</div>
                </div>
                <span
                  class="vt-mono text-sm font-semibold"
                  :class="e.type === 'income' ? 'text-vt-grass-ink' : 'text-vt-rose-ink'"
                >
                  {{ e.type === 'income' ? '+' : '−' }}{{ formatMoneyRu(e.amount, e.currency) }}
                </span>
              </li>
            </ul>
          </section>
        </template>
      </template>
    </main>

    <VtSheet v-model="sheetOpen" :title="sheetKind === 'expense' ? 'Новый расход' : 'Новый доход'">
      <form class="space-y-3" @submit.prevent="save">
        <div class="cashbox-form-primary-grid grid gap-3">
          <div>
            <label class="vt-label" for="lg-cat">Категория</label>
            <select id="lg-cat" v-model="form.category" class="vt-field">
              <option
                v-for="c in sheetKind === 'expense' ? EXPENSE_CATS : INCOME_CATS"
                :key="c"
                :value="c"
              >
                {{ label(LEDGER_CATEGORY_LABELS, c) }}
              </option>
            </select>
          </div>
          <div>
            <label class="vt-label" for="lg-amount">Сумма, {{ balance?.currency ?? 'BYN' }}</label>
            <input
              id="lg-amount"
              v-model="form.amountMajor"
              class="vt-field vt-mono"
              inputmode="decimal"
              placeholder="0,00"
              required
            />
          </div>
        </div>
        <div>
          <label class="vt-label" for="lg-date">Дата</label>
          <input id="lg-date" v-model="form.occurredAt" type="datetime-local" class="vt-field" />
        </div>
        <div>
          <label class="vt-label" for="lg-event">Событие</label>
          <select id="lg-event" v-model="form.eventId" class="vt-field">
            <option value="">Без привязки</option>
            <option v-for="ev in events" :key="ev.id" :value="ev.id">
              {{ ev.title }} · {{ formatDay(ev.startsAt, tz) }}
            </option>
          </select>
        </div>
        <div>
          <label class="vt-label" for="lg-desc">Комментарий</label>
          <input
            id="lg-desc"
            v-model="form.description"
            class="vt-field"
            maxlength="500"
            placeholder="Аренда зала на май"
          />
        </div>
        <p v-if="formError" class="text-sm text-vt-rose-ink" role="alert">{{ formError }}</p>
        <button type="submit" class="vt-btn vt-btn--primary vt-btn--full" :disabled="saving">
          {{ saving ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </form>
    </VtSheet>
  </div>
</template>

<style scoped>
.cashbox-balance-hero .vt-cap {
  color: rgb(255 255 255 / 78%);
}

.cashbox-form-primary-grid {
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 22rem) {
  .cashbox-form-primary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 200px) {
  .cashbox-balance-hero > .vt-mono {
    font-size: 1.25rem;
  }

  .cashbox-balance-breakdown,
  .cashbox-operation-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .cashbox-filters {
    flex-direction: column;
  }
}
</style>
