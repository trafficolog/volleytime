<script setup lang="ts">
import type { SubscriptionPlan } from '@volley-time/db'
import { toMinor } from '@volley-time/shared'
import { formatPrice } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { confirm } = useTelegram()
const { data: orgData, error: orgError } = await useFetch<{
  organization: { id: number; subscriptionsEnabled: boolean }
}>(() => `/api/organizations/${orgId.value}`)
const allowCreate = computed(
  () =>
    !orgError.value &&
    orgData.value?.organization.id === orgId.value &&
    orgData.value.organization.subscriptionsEnabled === true,
)

const plans = ref<SubscriptionPlan[]>([])
const loadError = ref('')
async function load() {
  loadError.value = ''
  try {
    plans.value = (
      await $fetch<{ plans: SubscriptionPlan[] }>(`/api/organizations/${orgId.value}/plans`)
    ).plans
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить планы')
  }
}
await load()

const showForm = ref(false)
const form = reactive({
  name: 'Абонемент на 8 тренировок',
  totalSessions: 8,
  validityDays: 30 as number | '',
  priceMajor: '',
})
const saving = ref(false)
const formError = ref('')
async function create() {
  if (!allowCreate.value) return
  saving.value = true
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/plans`, {
      method: 'POST',
      body: {
        name: form.name.trim(),
        totalSessions: Number(form.totalSessions),
        validityDays: form.validityDays === '' ? null : Number(form.validityDays),
        price: toMinor(Number(String(form.priceMajor).replace(',', '.')) || 0),
      },
    })
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = apiErrorMessage(e, 'Не удалось создать план')
  } finally {
    saving.value = false
  }
}
watch(allowCreate, (allowed) => {
  if (!allowed) showForm.value = false
})
async function archive(p: SubscriptionPlan) {
  if (
    !(await confirm(
      `Убрать «${p.name}» из продажи? Уже купленные абонементы продолжат действовать.`,
    ))
  )
    return
  try {
    await $fetch(`/api/organizations/${orgId.value}/plans/${p.id}/archive`, { method: 'POST' })
    await load()
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось архивировать план')
  }
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <VtMiniHeader title="Планы абонементов" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4 space-y-4">
      <button
        v-if="allowCreate && !showForm"
        type="button"
        class="vt-btn vt-btn--primary vt-btn--full"
        @click="showForm = true"
      >
        <VtIcon name="plus" :size="16" /> Новый план
      </button>
      <form v-else-if="allowCreate" class="vt-card p-4 space-y-3" @submit.prevent="create">
        <div>
          <label class="vt-label" for="pl-name">Название</label>
          <input id="pl-name" v-model="form.name" class="vt-field" required minlength="2" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="vt-label" for="pl-s">Занятий</label>
            <input
              id="pl-s"
              v-model.number="form.totalSessions"
              type="number"
              min="1"
              class="vt-field"
              required
            />
          </div>
          <div>
            <label class="vt-label" for="pl-d">Дней</label>
            <input
              id="pl-d"
              v-model="form.validityDays"
              type="number"
              min="1"
              class="vt-field"
              placeholder="∞"
            />
          </div>
          <div>
            <label class="vt-label" for="pl-p">Цена, BYN</label>
            <input
              id="pl-p"
              v-model="form.priceMajor"
              inputmode="decimal"
              class="vt-field"
              placeholder="0"
              required
            />
          </div>
        </div>
        <p v-if="formError" class="text-sm text-vt-rose-ink" role="alert">{{ formError }}</p>
        <div class="flex gap-2">
          <button type="button" class="vt-btn vt-btn--ghost flex-1" @click="showForm = false">
            Отмена
          </button>
          <button type="submit" class="vt-btn vt-btn--primary flex-1" :disabled="saving">
            Создать
          </button>
        </div>
      </form>
      <p v-if="!allowCreate" class="vt-card p-4 text-sm text-vt-mute-2">
        {{
          orgData?.organization.subscriptionsEnabled === false
            ? 'Абонементы выключены в настройках группы. Существующие планы сохранены.'
            : 'Не удалось проверить настройки группы. Создание плана недоступно.'
        }}
      </p>
      <ErrorState v-if="loadError" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="plans.length === 0"
        icon="ticket"
        title="Планов пока нет"
        :description="
          allowCreate
            ? 'Создайте абонемент — игроки смогут купить его в приложении'
            : 'Существующие планы появятся здесь после включения абонементов'
        "
      />
      <ul v-else class="space-y-2.5">
        <li v-for="p in plans" :key="p.id" class="vt-card p-3.5 flex items-center gap-3">
          <VtIcon name="ticket" :size="20" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">{{ p.name }}</div>
            <div class="text-xs text-vt-mute-2">
              {{ p.totalSessions }} занятий ·
              {{ p.validityDays ? `${p.validityDays} дн.` : 'бессрочно' }}
            </div>
          </div>
          <div class="font-semibold text-sm">{{ formatPrice(p.price, p.currency) }}</div>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
            aria-label="Убрать из продажи"
            @click="archive(p)"
          >
            <VtIcon name="trash" :size="14" />
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>
