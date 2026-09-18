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

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ balance: Balance; entries: Entry[] }>(
      `/api/organizations/${orgId.value}/ledger`,
      { query: filter.value === 'all' ? { limit: 200 } : { type: filter.value, limit: 200 } },
    )
    balance.value = data.balance
    entries.value = data.entries
  } catch (e) {
    if (apiErrorStatus(e) === 403) forbidden.value = true
    else loadError.value = apiErrorMessage(e, 'Не удалось загрузить кассу')
  } finally {
    loading.value = false
  }
}
await load()
watch(filter, load)

/** Группировка по дню операции в TZ организации. */
const groups = computed(() => {
  const map = new Map<string, { day: string; items: Entry[]; net: number }>()
  for (const e of entries.value) {
    const key = formatShortDate(e.occurredAt, tz.value)
    if (!map.has(key)) map.set(key, { day: formatDay(e.occurredAt, tz.value), items: [], net: 0 })
    const g = map.get(key)!
    g.items.push(e)
    if (e.currency === balance.value?.currency) g.net += e.type === 'income' ? e.amount : -e.amount
  }
  return [...map.values()]
})
const otherCurrencies = computed(() =>
  Object.entries(balance.value?.byCurrency ?? {}).filter(([c]) => c !== balance.value?.currency),
)

// операция
type Kind = 'expense' | 'income'
const sheetKind = ref<Kind | null>(null)
const sheetOpen = computed({
  get: () => sheetKind.value !== null,
  set: (v) => {
    if (!v) sheetKind.value = null
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
  formError.value = ''
  Object.assign(form, {
    category: kind === 'expense' ? 'rent' : 'contribution',
    amountMajor: '',
    description: '',
    occurredAt: dateToZonedInput(new Date(), tz.value),
    eventId: '',
  })
  sheetKind.value = kind
  if (events.value.length === 0) {
    try {
      events.value = (
        await $fetch<{ events: EventOption[] }>(`/api/organizations/${orgId.value}/events`, {
          query: { filter: 'all', limit: 30 },
        })
      ).events
    } catch {
      events.value = []
    }
  }
}

async function save() {
  if (!sheetKind.value) return
  formError.value = ''
  const major = Number(String(form.amountMajor).replace(',', '.'))
  if (!Number.isFinite(major) || major <= 0) {
    formError.value = 'Введите сумму больше нуля'
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/organizations/${orgId.value}/ledger/${sheetKind.value}`, {
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
    haptic('success')
    sheetKind.value = null
    await load()
  } catch (e) {
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
          <section class="vt-card p-4">
            <div class="vt-cap">Баланс</div>
            <div
              class="vt-mono text-3xl font-bold mt-1"
              :class="balance.balance < 0 ? 'text-vt-rose-ink' : 'text-vt-ink'"
            >
              {{ formatMoneyRu(balance.balance, balance.currency) }}
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div>
                <div class="text-xs text-vt-mute-2">Доходы</div>
                <div class="vt-mono font-semibold text-vt-grass-ink">
                  +{{ formatMoneyRu(balance.income, balance.currency) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-vt-mute-2">Расходы</div>
                <div class="vt-mono font-semibold text-vt-rose-ink">
                  −{{ formatMoneyRu(balance.expense, balance.currency) }}
                </div>
              </div>
            </div>
            <p v-for="[cur, b] in otherCurrencies" :key="cur" class="text-xs text-vt-mute-2 mt-2">
              В {{ cur }}: {{ formatMoneyRu(b.balance, cur) }}
            </p>
          </section>

          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="vt-btn vt-btn--ghost" @click="openSheet('expense')">
              <VtIcon name="plus" :size="14" /> Расход
            </button>
            <button type="button" class="vt-btn vt-btn--ghost" @click="openSheet('income')">
              <VtIcon name="plus" :size="14" /> Доход
            </button>
          </div>

          <div class="flex gap-1" role="tablist">
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
              <span
                class="vt-mono text-xs"
                :class="g.net < 0 ? 'text-vt-rose-ink' : 'text-vt-grass-ink'"
              >
                {{ g.net < 0 ? '−' : '+' }}{{ formatMoneyRu(Math.abs(g.net), balance.currency) }}
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
        <div class="grid grid-cols-2 gap-3">
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
