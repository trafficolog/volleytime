<script setup lang="ts">
import {
  PLATFORM_PURCHASE_REASON_MAX,
  type PlatformPurchaseDecisionResult,
  type PlatformPurchaseRequestRow,
  type PlatformPurchaseRequestsPage,
  type PlatformPurchaseStatus,
  type PlatformPurchaseSummary,
} from '@volley-time/shared'

import { apiErrorCode, apiErrorStatus } from '~/utils/api-error'
import { pluralEvents } from '~/utils/cabinet-shell'
import { formatMoneyRu } from '~/utils/labels'
import { rootOverviewFailure } from '~/utils/root-overview'
import {
  PAYMENT_PERIODS,
  PAYMENTS_TIMEZONE,
  PURCHASES_API,
  type PaymentPeriodKey,
  decisionErrorMessage,
  exportHref,
  paymentRowView,
  periodRange,
  rejectReasonError,
  totalsLabel,
} from '~/utils/root-payments'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Подписки и выплаты — Root Admin' })

const TZ = PAYMENTS_TIMEZONE
const route = useRoute()
const toast = useToast()

/** Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход. */
function reactToStatus(status: number | undefined): boolean {
  const reaction = rootOverviewFailure(status)
  if (reaction === 'forbidden') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Нет доступа к разделу',
      fatal: true,
    })
  }
  if (reaction === 'login') {
    void navigateTo('/auth/login')
    return true
  }
  return false
}

const STATUS_FILTERS: { key: PlatformPurchaseStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Ждут решения' },
  { key: 'approved', label: 'Подтверждены' },
  { key: 'rejected', label: 'Отклонены' },
  { key: 'all', label: 'Все' },
]

const period = ref<PaymentPeriodKey>('month')
const status = ref<PlatformPurchaseStatus | 'all'>('pending')
const tab = ref<'requests' | 'orgs'>('requests')
const initialOrg = Array.isArray(route.query.organization)
  ? route.query.organization[0]
  : route.query.organization
const organization = ref<{ id: number; name: string } | null>(
  initialOrg && /^\d{1,10}$/.test(initialOrg)
    ? { id: Number(initialOrg), name: `№${initialOrg}` }
    : null,
)
const range = computed(() => periodRange(period.value))

const {
  data: summary,
  error: summaryError,
  refresh: refreshSummary,
} = await useFetch<PlatformPurchaseSummary>(`${PURCHASES_API}/summary`, {
  key: 'root-purchase-summary',
  query: computed(() => ({ ...range.value })),
})
reactToStatus(apiErrorStatus(summaryError.value))

// Реестр: период — по дате заявки; ожидающие показываются за всё время, чтобы не потерять старые
const listQuery = computed(() => ({
  ...(status.value === 'pending' ? {} : range.value),
  ...(status.value === 'all' ? {} : { status: status.value }),
  ...(organization.value ? { organizationId: organization.value.id } : {}),
  limit: 20,
}))
const {
  data: firstPage,
  pending: listPending,
  error: listError,
  refresh: refreshList,
} = await useFetch<PlatformPurchaseRequestsPage>(PURCHASES_API, {
  key: 'root-purchase-requests',
  query: listQuery,
})
reactToStatus(apiErrorStatus(listError.value))

const more = ref<PlatformPurchaseRequestRow[]>([])
const moreCursor = ref<number | null | undefined>(undefined)
const morePending = ref(false)
watch(listQuery, () => {
  more.value = []
  moreCursor.value = undefined
})
const cursor = computed(() =>
  moreCursor.value === undefined ? (firstPage.value?.nextCursor ?? null) : moreCursor.value,
)
const rows = computed(() =>
  [...(firstPage.value?.items ?? []), ...more.value].map((r) => paymentRowView(r, TZ)),
)

async function loadMore() {
  if (cursor.value === null || morePending.value) return
  morePending.value = true
  try {
    const page = await $fetch<PlatformPurchaseRequestsPage>(PURCHASES_API, {
      query: { ...listQuery.value, cursor: cursor.value },
    })
    more.value = [...more.value, ...page.items]
    moreCursor.value = page.nextCursor
  } catch (e) {
    if (!reactToStatus(apiErrorStatus(e))) toast.show('Не удалось загрузить заявки')
  } finally {
    morePending.value = false
  }
}

function filterOrganization(org: { id: number; name: string } | null) {
  organization.value = org
  if (org) {
    tab.value = 'requests'
    status.value = 'all'
  }
}

// Решение по заявке: одна открытая панель подтверждения или отклонения
type Decision = { kind: 'approve' | 'reject'; row: ReturnType<typeof paymentRowView> }
const decision = ref<Decision | null>(null)
const comment = ref('')
const reasonError = ref('')
const failure = ref('')
const submitting = ref(false)
const commentInput = ref<HTMLTextAreaElement | null>(null)

function openDecision(kind: Decision['kind'], row: Decision['row']) {
  decision.value = { kind, row }
  comment.value = ''
  reasonError.value = ''
  failure.value = ''
  void nextTick(() => commentInput.value?.focus())
}
function closeDecision() {
  decision.value = null
}

async function submitDecision() {
  const current = decision.value
  if (!current || submitting.value) return
  failure.value = ''
  reasonError.value = ''
  if (current.kind === 'reject') {
    const err = rejectReasonError(comment.value)
    if (err) {
      reasonError.value = err
      commentInput.value?.focus()
      return
    }
  }
  submitting.value = true
  try {
    const body =
      current.kind === 'reject'
        ? { reason: comment.value.trim() }
        : comment.value.trim()
          ? { comment: comment.value.trim() }
          : {}
    const result = await $fetch<PlatformPurchaseDecisionResult>(
      `${PURCHASES_API}/${current.row.id}/${current.kind}`,
      { method: 'POST', body },
    )
    toast.show(
      current.kind === 'approve'
        ? `Заявка №${current.row.id} подтверждена: баланс ${result.request.organization.name} — ${result.balanceAfter} ${pluralEvents(result.balanceAfter ?? 0)}`
        : `Заявка №${current.row.id} отклонена`,
    )
    decision.value = null
    more.value = []
    moreCursor.value = undefined
    await Promise.all([refreshList(), refreshSummary()])
  } catch (e) {
    if (reactToStatus(apiErrorStatus(e))) return
    const code = apiErrorCode(e)
    failure.value = decisionErrorMessage(apiErrorStatus(e) === 422 ? 'validation_failed' : code)
    if (code === 'purchase_request.not_pending' || code === 'purchase_request.not_found') {
      await Promise.all([refreshList(), refreshSummary()])
    }
  } finally {
    submitting.value = false
  }
}

const approvedTotal = computed(() => totalsLabel(summary.value?.approved ?? []))
const approvedCount = computed(() =>
  (summary.value?.approved ?? []).reduce((n, t) => n + t.count, 0),
)
const approvedUnits = computed(() => summary.value?.ledger.approvedUnits ?? 0)
const ledger = computed(() => summary.value?.ledger ?? null)
const download = computed(() => exportHref(range.value))
const periodLabel = computed(() => PAYMENT_PERIODS.find((p) => p.key === period.value)?.label ?? '')
</script>

<template>
  <div class="vt-root-billing vt-root-payments">
    <header class="vt-root-billing__head">
      <div>
        <h1 tabindex="-1">
          Подписки и выплаты <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
        </h1>
        <p class="vt-root-billing__hint">
          Заявки организаций на баланс событий: подтверждение, отклонение и выгрузка
        </p>
      </div>
      <div class="vt-root-billing__actions">
        <a :href="download" class="vt-btn vt-btn--ghost vt-btn--sm" download>
          <VtIcon name="arrow-d" :size="13" /> Экспорт CSV
        </a>
      </div>
    </header>

    <div class="vt-root-billing__filter" role="group" aria-label="Период">
      <button
        v-for="p in PAYMENT_PERIODS"
        :key="p.key"
        type="button"
        class="vt-btn vt-btn--sm"
        :class="period === p.key ? 'vt-btn--ink' : 'vt-btn--ghost'"
        :aria-pressed="period === p.key"
        @click="period = p.key"
      >
        {{ p.label }}
      </button>
    </div>

    <ErrorState
      v-if="summaryError && !summary"
      message="Не удалось загрузить итоги"
      @retry="refreshSummary()"
    />
    <section v-else class="vt-root-payments__tiles" aria-label="Итоги периода">
      <article class="vt-card vt-card--hero vt-root-payments__tile vt-root-payments__tile--hero">
        <p class="vt-cap">Подтверждено · {{ periodLabel.toLowerCase() }}</p>
        <p class="vt-mono vt-root-payments__value" data-testid="payments-total">
          {{ approvedTotal }}
        </p>
        <p class="vt-root-payments__meta">
          заявок: {{ approvedCount }} · +{{ approvedUnits }} {{ pluralEvents(approvedUnits) }}
        </p>
      </article>
      <article class="vt-card vt-root-payments__tile">
        <p class="vt-cap">Ждут решения (всего)</p>
        <p class="vt-mono vt-root-payments__value" data-testid="payments-pending">
          {{ summary?.pendingCount ?? 0 }}
        </p>
        <p class="vt-root-payments__meta">заявок за всё время</p>
      </article>
      <article class="vt-card vt-root-payments__tile">
        <p class="vt-cap">Платящих организаций</p>
        <p class="vt-mono vt-root-payments__value">{{ summary?.payingOrganizations ?? 0 }}</p>
        <p class="vt-root-payments__meta">отклонено за период: {{ summary?.rejectedCount ?? 0 }}</p>
      </article>
      <article class="vt-card vt-root-payments__tile">
        <p class="vt-cap">Сверка с журналом</p>
        <p
          class="vt-mono vt-root-payments__value"
          :class="ledger && !ledger.matches ? 'vt-root-payments__value--bad' : ''"
          data-testid="payments-ledger"
        >
          {{ !ledger ? '—' : ledger.matches ? 'Сходится' : 'Расхождение' }}
        </p>
        <p class="vt-root-payments__meta">
          журнал: +{{ ledger?.ledgerUnits ?? 0 }} {{ pluralEvents(ledger?.ledgerUnits ?? 0) }}
        </p>
      </article>
    </section>

    <div class="vt-root-payments__tabs" role="tablist" aria-label="Разделы">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'requests'"
        :class="{ 'is-active': tab === 'requests' }"
        @click="tab = 'requests'"
      >
        Заявки
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'orgs'"
        :class="{ 'is-active': tab === 'orgs' }"
        @click="tab = 'orgs'"
      >
        Доходы по организациям
      </button>
    </div>

    <section
      v-if="decision"
      class="vt-card vt-root-billing__card vt-root-payments__decision"
      aria-labelledby="decision-title"
    >
      <form novalidate class="vt-root-billing__form" @submit.prevent="submitDecision">
        <div class="vt-root-billing__form-fields">
          <h2 id="decision-title">
            {{ decision.kind === 'approve' ? 'Подтвердить' : 'Отклонить' }} заявку №{{
              decision.row.id
            }}
          </h2>
          <p class="vt-root-billing__hint">
            {{ decision.row.organization }} · <b class="vt-mono">{{ decision.row.units }}</b> ·
            <b class="vt-mono">{{ decision.row.amount }}</b>
            <template v-if="decision.kind === 'approve'">
              . Баланс пополнится на количество событий из заявки; цена — на момент заявки.
            </template>
            <template v-else>. Баланс не изменится, причину увидит организатор.</template>
          </p>
          <p v-if="failure" role="alert" class="vt-root-billing__error">{{ failure }}</p>
          <label class="vt-root-billing__field">
            <span class="vt-label">{{
              decision.kind === 'approve'
                ? 'Комментарий (необязательно)'
                : 'Причина отклонения (обязательно)'
            }}</span>
            <textarea
              ref="commentInput"
              v-model="comment"
              class="vt-field"
              name="decision-comment"
              rows="2"
              :required="decision.kind === 'reject'"
              :maxlength="PLATFORM_PURCHASE_REASON_MAX"
              :placeholder="
                decision.kind === 'approve'
                  ? 'Напр. оплата по счёту №12'
                  : 'Напр. оплата не поступила'
              "
              :aria-invalid="reasonError ? 'true' : undefined"
              :aria-describedby="reasonError ? 'decision-error' : undefined"
            ></textarea>
            <span v-if="reasonError" id="decision-error" class="vt-root-billing__error">
              {{ reasonError }}
            </span>
          </label>
          <div class="vt-root-billing__actions">
            <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="closeDecision">
              Отмена
            </button>
            <button
              type="submit"
              class="vt-btn vt-btn--sm"
              :class="decision.kind === 'approve' ? 'vt-btn--primary' : 'vt-btn--ink'"
              :disabled="submitting"
              data-testid="decision-submit"
            >
              {{
                submitting
                  ? 'Сохраняем…'
                  : decision.kind === 'approve'
                    ? 'Подтвердить и начислить'
                    : 'Отклонить'
              }}
            </button>
          </div>
        </div>
      </form>
    </section>

    <section
      v-if="tab === 'requests'"
      class="vt-card vt-root-billing__card"
      aria-labelledby="requests-title"
    >
      <div class="vt-root-billing__card-head">
        <div>
          <h2 id="requests-title">Заявки организаций</h2>
          <p class="vt-root-billing__hint">
            Онлайн-оплаты пока нет: подтверждайте заявку после поступления оплаты. Выплаты, возвраты
            и сверка с платёжным провайдером появятся после запуска онлайн-оплаты.
          </p>
        </div>
      </div>
      <div class="vt-root-billing__filter" role="group" aria-label="Статус заявки">
        <button
          v-for="f in STATUS_FILTERS"
          :key="f.key"
          type="button"
          class="vt-btn vt-btn--sm"
          :class="status === f.key ? 'vt-btn--ink' : 'vt-btn--ghost'"
          :aria-pressed="status === f.key"
          @click="status = f.key"
        >
          {{ f.label }}
        </button>
        <button
          v-if="organization"
          type="button"
          class="vt-chip"
          data-testid="org-filter"
          @click="filterOrganization(null)"
        >
          {{ organization.name }} <span aria-hidden="true">×</span
          ><span class="sr-only">— сбросить фильтр организации</span>
        </button>
      </div>
      <SkeletonList v-if="listPending && !rows.length" :count="3" />
      <ErrorState
        v-else-if="listError && !rows.length"
        message="Не удалось загрузить заявки"
        @retry="refreshList()"
      />
      <EmptyState
        v-else-if="!rows.length"
        icon="clock"
        :title="status === 'pending' ? 'Новых заявок нет' : 'Заявок нет'"
        description="Здесь появятся заявки организаторов на покупку баланса событий"
      />
      <div v-else class="vt-root-billing__table-wrap">
        <table class="vt-root-billing__table">
          <caption class="sr-only">
            Заявки на покупку баланса событий, новые сверху
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">№</th>
              <th scope="col" class="vt-cap">Дата</th>
              <th scope="col" class="vt-cap">Организация</th>
              <th scope="col" class="vt-cap">Пакет</th>
              <th scope="col" class="vt-cap">Сумма</th>
              <th scope="col" class="vt-cap">Статус</th>
              <th scope="col" class="vt-cap"><span class="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" data-request-row>
              <td class="vt-mono vt-root-billing__muted">{{ row.id }}</td>
              <td class="vt-mono vt-root-billing__muted">
                <time :datetime="row.createdIso">{{ row.created }}</time>
              </td>
              <td>
                <NuxtLink :to="`/root/organizations/${row.organizationId}`">
                  {{ row.organization }}
                </NuxtLink>
                <span v-if="row.requester" class="vt-root-billing__hint">
                  <br />{{ row.requester }}</span
                >
              </td>
              <td class="vt-mono">{{ row.units }}</td>
              <td class="vt-mono vt-root-payments__amount">{{ row.amount }}</td>
              <td>
                <span class="vt-root-payments__status" :data-status="row.statusKey">{{
                  row.status
                }}</span>
                <span v-if="row.decision" class="vt-root-billing__hint"
                  ><br />{{ row.decision }}</span
                >
              </td>
              <td>
                <div v-if="row.pending" class="vt-root-billing__row-actions">
                  <button
                    type="button"
                    class="vt-btn vt-btn--primary vt-btn--sm"
                    :aria-label="`Подтвердить заявку №${row.id}`"
                    @click="openDecision('approve', row)"
                  >
                    <VtIcon name="check" :size="13" /> Подтвердить
                  </button>
                  <button
                    type="button"
                    class="vt-btn vt-btn--ghost vt-btn--sm"
                    :aria-label="`Отклонить заявку №${row.id}`"
                    @click="openDecision('reject', row)"
                  >
                    Отклонить
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="cursor !== null && rows.length" class="vt-root-billing__foot">
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="morePending"
          @click="loadMore()"
        >
          {{ morePending ? 'Загрузка…' : 'Загрузить ещё' }}
        </button>
      </footer>
    </section>

    <section v-else class="vt-card vt-root-billing__card" aria-labelledby="orgs-title">
      <div class="vt-root-billing__card-head">
        <div>
          <h2 id="orgs-title">Доходы по организациям</h2>
          <p class="vt-root-billing__hint">
            Подтверждённые заявки за период: {{ periodLabel.toLowerCase() }}
          </p>
        </div>
      </div>
      <EmptyState
        v-if="!summary?.byOrganization.length"
        icon="chart"
        title="Подтверждённых заявок за период нет"
        description="Выберите другой период"
      />
      <div v-else class="vt-root-billing__table-wrap">
        <table class="vt-root-billing__table">
          <caption class="sr-only">
            Доходы по организациям за период
          </caption>
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Организация</th>
              <th scope="col" class="vt-cap">Заявок</th>
              <th scope="col" class="vt-cap">Куплено событий</th>
              <th scope="col" class="vt-cap">Выручка</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="o in summary.byOrganization"
              :key="`${o.organization.id}-${o.currency}`"
              data-org-row
            >
              <td>
                <button
                  type="button"
                  class="vt-root-payments__link"
                  @click="filterOrganization(o.organization)"
                >
                  {{ o.organization.name }}
                </button>
              </td>
              <td class="vt-mono">{{ o.count }}</td>
              <td class="vt-mono">+{{ o.units }}</td>
              <td class="vt-mono vt-root-billing__income">
                {{ formatMoneyRu(o.amount, o.currency) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="summary?.byOrganizationTruncated"
        class="vt-root-billing__hint"
        data-testid="orgs-truncated"
      >
        Показаны первые 100 строк по выручке; остальные не вошли. Сузьте период.
      </p>
    </section>

    <VtToast />
  </div>
</template>
