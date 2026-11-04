<script setup lang="ts">
import {
  COLLECTION_METHOD_LABELS,
  parsePledgeAmount,
  pledgeToastText,
  type PlayerCollection,
} from '~/utils/collections'
import { formatMoneyRu } from '~/utils/labels'
import { playerAccessFromApiError } from '~/utils/player-home'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/**
 * Мой взнос (21.1.6, `ContribPledge`): сумма и способ → обещание, которое подтверждает организатор.
 * Повторный взнос до подтверждения — новая заявка: прежнее обещание отменяется (решение владельца
 * 2026-10-28), поэтому экран говорит об этом заранее.
 */
type Method = 'cash' | 'transfer'

const PRESETS_MAJOR = [10, 15, 20, 25, 30, 50]
const METHODS: { id: Method; title: string; hint: string }[] = [
  {
    id: 'cash',
    title: 'Обещать · наличными',
    hint: 'Подтвердят, когда передадите деньги организатору',
  },
  { id: 'transfer', title: 'Обещать · переводом', hint: 'Реквизиты уточните у организатора' },
]

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const collectionId = computed(() => Number(route.params.collectionId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const detailPath = computed(() => `${base.value}/collections/${collectionId.value}`)
const { haptic } = useTelegram()
const toast = useToast()
const {
  data: orgData,
  error: orgError,
  refresh: refreshOrg,
} = await useFetch<{
  organization: { id: number }
  capabilities: { collections: boolean }
}>(() => `/api/organizations/${orgId.value}`, {
  key: () => `player-pledge-org-${orgId.value}`,
})

const collection = ref<PlayerCollection | null>(null)
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const loadAccessNotice = ref<ReturnType<typeof playerAccessFromApiError>>(null)
const accessNotice = computed(
  () => playerAccessFromApiError(apiErrorCode(orgError.value)) ?? loadAccessNotice.value,
)

const amountText = ref('15')
const method = ref<Method>('cash')
const submitting = ref(false)
const submitError = ref('')
// флаг мог выключиться после загрузки страницы: сервер ответит collection.disabled
const disabledByServer = ref(false)
let loadSeq = 0

async function load() {
  const mine = ++loadSeq
  loading.value = true
  loadError.value = ''
  notFound.value = false
  loadAccessNotice.value = null
  try {
    const result = await $fetch<{ collection: PlayerCollection }>(
      `/api/organizations/${orgId.value}/collections/${collectionId.value}`,
    )
    if (mine !== loadSeq) return
    collection.value = result.collection
    const pending = result.collection.my.pending
    if (pending) {
      // обещание заменяется новой заявкой: подставляем прежние сумму и способ
      amountText.value = String(pending.amount / 100).replace('.', ',')
      if (pending.method === 'cash' || pending.method === 'transfer') method.value = pending.method
    }
  } catch (e) {
    if (mine !== loadSeq) return
    collection.value = null
    if (apiErrorCode(e) === 'collection.not_found') notFound.value = true
    else {
      loadError.value = apiErrorMessage(e, 'Не удалось загрузить сбор')
      loadAccessNotice.value = playerAccessFromApiError(apiErrorCode(e))
    }
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}
await load()
watch(
  () => [orgId.value, collectionId.value],
  () => {
    collection.value = null
    submitError.value = ''
    void refreshOrg()
    void load()
  },
  { flush: 'sync' },
)

async function retryPage() {
  await refreshOrg()
  await load()
}

const currency = computed(() => collection.value?.currency ?? 'BYN')
const pending = computed(() => collection.value?.my.pending ?? null)
const amount = computed(() => parsePledgeAmount(amountText.value))
const amountInvalid = computed(() => amountText.value.trim() !== '' && amount.value === null)
const isActive = computed(() => collection.value?.status === 'active')
const pledgesOpen = computed(
  () => orgData.value?.capabilities?.collections === true && !disabledByServer.value,
)
const canSubmit = computed(
  () => isActive.value && pledgesOpen.value && amount.value !== null && !submitting.value,
)
const money = (minor: number) => formatMoneyRu(minor, currency.value)

async function submit() {
  if (!canSubmit.value || amount.value === null || !collection.value) return
  const requestedAmount = amount.value
  submitting.value = true
  submitError.value = ''
  try {
    const result = await $fetch<{ replaced: boolean }>(
      `/api/organizations/${orgId.value}/collections/${collectionId.value}/contributions`,
      { method: 'POST', body: { amount: requestedAmount, method: method.value } },
    )
    haptic('success')
    toast.show(pledgeToastText(requestedAmount, currency.value, result.replaced))
    await navigateTo(detailPath.value)
  } catch (e) {
    haptic('error')
    submitError.value = apiErrorMessage(e, 'Не удалось внести взнос')
    const code = apiErrorCode(e)
    if (code === 'collection.disabled') {
      disabledByServer.value = true
      void refreshOrg()
    } else if (code === 'collection.not_active' || code === 'collection.not_found') {
      await load()
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen pb-6">
    <VtMiniHeader title="Мой взнос" :sub="collection?.title" :back="detailPath" />
    <main class="px-4 pb-4 pt-2">
      <SkeletonList v-if="loading" :count="2" />
      <PlayerAccessNotice v-else-if="accessNotice" :access="accessNotice" />
      <EmptyState v-else-if="notFound" icon="gift" title="Сбор не найден">
        <template #action>
          <NuxtLink :to="`${base}/collections`" class="vt-btn vt-btn--ghost">К сборам</NuxtLink>
        </template>
      </EmptyState>
      <ErrorState v-else-if="loadError || !collection" :message="loadError" @retry="retryPage" />
      <template v-else>
        <p v-if="!isActive" class="vt-card p-4 text-sm text-vt-mute-2" role="status">
          Сбор закрыт, новые взносы не принимаются.
          <NuxtLink :to="detailPath" class="font-semibold underline">К сбору</NuxtLink>
        </p>
        <template v-else>
          <p v-if="!pledgesOpen" class="vt-card mb-4 p-4 text-sm text-vt-mute-2" role="status">
            Приём взносов сейчас приостановлен, внести взнос пока нельзя. Загляните позже.
          </p>
          <div
            v-else-if="pending"
            class="vt-card mb-4 flex items-start gap-2.5 !border-vt-amber !px-3.5 !py-3"
            role="status"
            data-testid="replace-notice"
          >
            <VtIcon name="clock" :size="18" class="mt-0.5 shrink-0" />
            <p class="text-sm">
              <span class="font-semibold"
                >У вас уже есть обещание на {{ money(pending.amount) }} ({{
                  COLLECTION_METHOD_LABELS[pending.method as Method] ?? pending.method
                }}).</span
              >
              Новый взнос заменит его: прежняя заявка будет отменена, а организатор получит новую.
            </p>
          </div>

          <h2 class="vt-cap mb-3 px-1 text-vt-mute-2">Сумма взноса</h2>
          <div class="pb-4 pt-1 text-center">
            <label class="inline-flex items-baseline gap-1.5">
              <span class="sr-only">Сумма взноса, {{ currency }}</span>
              <input
                v-model="amountText"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                class="vt-mono font-display max-w-[9ch] bg-transparent text-center text-[48px] font-bold leading-none outline-none focus-visible:outline-2"
                :style="{ width: `${Math.max(2, amountText.length + 1)}ch` }"
                :aria-invalid="amountInvalid"
                aria-describedby="pledge-amount-hint"
              />
              <span class="text-lg font-semibold text-vt-mute-2" aria-hidden="true">{{
                currency
              }}</span>
            </label>
            <p
              id="pledge-amount-hint"
              class="mt-1.5 text-xs"
              :class="amountInvalid ? 'text-vt-rose-ink' : 'text-vt-mute-2'"
              :role="amountInvalid ? 'alert' : undefined"
            >
              {{
                amountInvalid
                  ? 'Введите сумму от 0,01 до 100 000, не больше двух знаков после запятой'
                  : 'Можно выбрать готовую сумму или ввести свою'
              }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2" role="group" aria-label="Готовые суммы">
            <button
              v-for="p in PRESETS_MAJOR"
              :key="p"
              type="button"
              class="vt-mono min-h-11 rounded-[var(--r-chip,12px)] border border-solid border-vt-stroke py-3 text-base font-bold"
              :class="
                amount === p * 100 ? 'bg-vt-ink text-vt-paper' : 'bg-[var(--vt-ctl)] text-vt-ink'
              "
              :aria-pressed="amount === p * 100"
              @click="amountText = String(p)"
            >
              {{ p }} {{ currency }}
            </button>
          </div>

          <h2 class="vt-cap mb-2.5 mt-5 px-1 text-vt-mute-2">Как внесёте</h2>
          <div
            role="radiogroup"
            aria-label="Способ взноса"
            class="vt-card divide-y divide-vt-stroke overflow-hidden"
          >
            <button
              v-for="o in METHODS"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="method === o.id"
              class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
              @click="method = o.id"
            >
              <span
                class="h-[18px] w-[18px] shrink-0 rounded-full border-solid"
                :class="
                  method === o.id ? 'border-[5px] border-vt-flame' : 'border-2 border-vt-stroke'
                "
                aria-hidden="true"
              />
              <span class="flex-1">
                <span class="block text-[15px] font-semibold">{{ o.title }}</span>
                <span class="mt-0.5 block text-xs text-vt-mute-2">{{ o.hint }}</span>
              </span>
            </button>
          </div>
          <p class="mt-3 px-1 text-xs text-vt-mute-2">
            Взнос попадёт в сбор и в кассу после того, как организатор подтвердит получение денег.
          </p>

          <p v-if="submitError" class="mt-3 text-sm text-vt-rose-ink" role="alert">
            {{ submitError }}
          </p>
          <div
            class="sticky bottom-[calc(var(--player-dock-height,58px)+28px+var(--vt-safe-bottom))] mt-5 bg-vt-paper pb-1 pt-3"
          >
            <button
              type="button"
              class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full !justify-between"
              :disabled="!canSubmit"
              @click="submit"
            >
              <span>{{ pending ? 'Заменить обещание' : 'Обещать взнос' }}</span>
              <span v-if="amount !== null" class="vt-mono opacity-85">{{ money(amount) }}</span>
            </button>
          </div>
        </template>
      </template>
    </main>
  </div>
</template>
