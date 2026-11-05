<script setup lang="ts">
import type { Organization, SubscriptionPlan } from '@volley-time/db'
import { toMajor, toMinor } from '@volley-time/shared'

import { canMutateDesktopPlan, desktopPlanState, planCaption } from '~/utils/desktop-plans'
import { formatPrice } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const path = computed(() => `/app/orgs/${orgId.value}/plans`)
const { data: orgData, error: orgError } = await useFetch<{ organization: Organization }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-org-${orgId.value}` },
)
const enabled = computed<boolean | null>(() =>
  !orgError.value && orgData.value?.organization.id === orgId.value
    ? orgData.value.organization.subscriptionsEnabled
    : null,
)
const plans = ref<SubscriptionPlan[]>([])
const state = computed(() => desktopPlanState(enabled.value, plans.value))
const loading = ref(false)
const loadError = ref('')
const formError = ref('')
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ name: '', totalSessions: 8, validityDays: '' as string, priceMajor: '' })
const currency = computed(() => orgData.value?.organization.defaultCurrency ?? 'BYN')
const previewPlan = computed(() => {
  const price = Number(form.priceMajor.replace(',', '.'))
  const sessions = Number(form.totalSessions)
  const days = Number(form.validityDays)
  return {
    price: Number.isFinite(price) && price > 0 ? toMinor(price) : 0,
    totalSessions: Number.isInteger(sessions) && sessions > 0 ? sessions : 0,
    validityDays: Number.isInteger(days) && days > 0 ? days : null,
    currency: currency.value,
  }
})
const previewSessions = computed(() => previewPlan.value.totalSessions || '—')
const previewPrice = computed(() => formatPrice(previewPlan.value.price, currency.value))
const previewCaption = computed(() => planCaption(previewPlan.value))
let generation = 0
let alive = true

async function load() {
  const token = ++generation
  const targetOrgId = orgId.value
  loading.value = true
  loadError.value = ''
  plans.value = []
  try {
    const result = await $fetch<{ plans: SubscriptionPlan[] }>(
      `/api/organizations/${targetOrgId}/plans`,
    )
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    plans.value = result.plans
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить планы')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

watch(
  orgId,
  () => {
    formOpen.value = false
    editingId.value = null
    void load()
  },
  { immediate: true },
)
watch(enabled, (value) => {
  if (value !== true) formOpen.value = false
})
onBeforeUnmount(() => {
  alive = false
  generation++
})

function openCreate() {
  if (!state.value.showCreate || busy.value) return
  editingId.value = null
  Object.assign(form, { name: '', totalSessions: 8, validityDays: '', priceMajor: '' })
  formError.value = ''
  formOpen.value = true
}

function openEdit(plan: SubscriptionPlan) {
  if (!state.value.showCreate || busy.value || plan.status !== 'active') return
  editingId.value = plan.id
  Object.assign(form, {
    name: plan.name,
    totalSessions: plan.totalSessions,
    validityDays: plan.validityDays === null ? '' : String(plan.validityDays),
    priceMajor: toMajor(plan.price).toFixed(2),
  })
  formError.value = ''
  formOpen.value = true
}

function live(targetOrgId: number, expectedPath: string) {
  return (
    alive &&
    orgId.value === targetOrgId &&
    canMutateDesktopPlan(route.path, expectedPath, enabled.value, busy.value)
  )
}

async function save() {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  if (!live(targetOrgId, expectedPath)) return
  const priceMajor = Number(form.priceMajor.replace(',', '.'))
  if (!Number.isFinite(priceMajor) || priceMajor < 0) {
    formError.value = 'Укажите корректную цену'
    return
  }
  const body = {
    name: form.name.trim(),
    totalSessions: Number(form.totalSessions),
    validityDays: form.validityDays === '' ? null : Number(form.validityDays),
    price: toMinor(priceMajor),
  }
  const targetPlanId = editingId.value
  busy.value = true
  formError.value = ''
  try {
    if (targetPlanId === null) {
      await $fetch(`/api/organizations/${targetOrgId}/plans`, { method: 'POST', body })
    } else {
      await $fetch(`/api/organizations/${targetOrgId}/plans/${targetPlanId}`, {
        method: 'PATCH',
        body,
      })
    }
    if (alive && orgId.value === targetOrgId && route.path === expectedPath) {
      formOpen.value = false
      await load()
    }
  } catch (cause) {
    if (alive && route.path === expectedPath)
      formError.value = apiErrorMessage(cause, 'Не удалось сохранить план')
  } finally {
    busy.value = false
  }
}

async function archive(plan: SubscriptionPlan) {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  if (!live(targetOrgId, expectedPath) || plan.status !== 'active') return
  if (
    !window.confirm(
      `Убрать «${plan.name}» из продажи? Уже купленные абонементы продолжат действовать.`,
    )
  )
    return
  if (!live(targetOrgId, expectedPath)) return
  busy.value = true
  loadError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/plans/${plan.id}/archive`, { method: 'POST' })
    if (alive && orgId.value === targetOrgId && route.path === expectedPath) await load()
  } catch (cause) {
    if (alive && route.path === expectedPath)
      loadError.value = apiErrorMessage(cause, 'Не удалось архивировать план')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-desktop-form-page vt-desktop-plans space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Абонементы</h1>
        <p class="text-vt-mute-2">Планы абонементов, по которым игроки покупают занятия</p>
      </div>
      <button
        v-if="state.showCreate && !formOpen"
        type="button"
        class="vt-btn vt-btn--primary"
        @click="openCreate"
      >
        Новый план
      </button>
    </header>

    <p v-if="enabled === false" class="vt-card p-4" role="status">
      Абонементы выключены в настройках группы. Существующие планы сохранены и доступны для
      просмотра; создавать и изменять их сейчас нельзя. Игроки не смогут покупать абонементы и
      оплачивать ими новые записи; остатки сохранятся, срок действия продолжает идти.
    </p>
    <p v-else-if="enabled === null" class="vt-card p-4" role="status">
      Не удалось проверить настройки группы. Изменение планов недоступно.
    </p>

    <form v-if="state.showCreate && formOpen" class="vt-desktop-plans__form" @submit.prevent="save">
      <div class="vt-card vt-desktop-plans__params space-y-4">
        <h2>{{ editingId === null ? 'Новый план' : 'Изменить план' }}</h2>
        <div>
          <label class="vt-label" for="desktop-plan-name">Название</label>
          <input
            id="desktop-plan-name"
            v-model="form.name"
            class="vt-field"
            required
            minlength="2"
            maxlength="200"
            placeholder="8 занятий"
            :disabled="busy"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="vt-label" for="desktop-plan-sessions">Занятий</label>
            <input
              id="desktop-plan-sessions"
              v-model.number="form.totalSessions"
              class="vt-field vt-mono"
              type="number"
              min="1"
              max="1000"
              step="1"
              required
              :disabled="busy"
            />
          </div>
          <div>
            <label class="vt-label" for="desktop-plan-days">Срок действия, дней</label>
            <input
              id="desktop-plan-days"
              v-model="form.validityDays"
              class="vt-field vt-mono"
              type="number"
              min="1"
              max="3650"
              step="1"
              placeholder="Бессрочно"
              :disabled="busy"
            />
          </div>
        </div>
        <div>
          <label class="vt-label" for="desktop-plan-price">Цена</label>
          <div class="vt-desktop-plans__price">
            <input
              id="desktop-plan-price"
              v-model="form.priceMajor"
              class="vt-field vt-mono vt-desktop-plans__amount"
              inputmode="decimal"
              required
              placeholder="0,00"
              :disabled="busy"
            />
            <span class="vt-field vt-desktop-plans__currency">{{ currency }}</span>
          </div>
        </div>
        <p v-if="formError" class="text-vt-rose-ink" role="alert">{{ formError }}</p>
        <div class="vt-desktop-members__actions">
          <button
            type="button"
            class="vt-btn vt-btn--ghost"
            :disabled="busy"
            @click="formOpen = false"
          >
            Отмена
          </button>
          <button type="submit" class="vt-btn vt-btn--primary" :disabled="busy">
            {{ busy ? 'Сохраняем…' : editingId === null ? 'Создать план' : 'Сохранить план' }}
          </button>
        </div>
      </div>

      <aside class="space-y-3" aria-label="Превью плана">
        <p class="vt-cap">Превью карточки</p>
        <div class="vt-card vt-desktop-plans__card" data-testid="plan-preview">
          <strong class="vt-desktop-plans__sessions">{{ previewSessions }}</strong>
          <p class="text-vt-mute-2 text-sm">{{ form.name.trim() || 'Название плана' }}</p>
          <hr class="vt-divider" />
          <strong class="vt-mono vt-desktop-plans__price-value">{{ previewPrice }}</strong>
          <p class="text-vt-mute-2 text-xs">{{ previewCaption }}</p>
          <span class="vt-chip vt-chip--grass vt-chip--dot">в продаже</span>
        </div>
        <p class="vt-card p-3 text-xs text-vt-mute-2">
          Занятие списывается при записи по абонементу.
        </p>
      </aside>
    </form>

    <ErrorState v-if="loadError" :message="loadError" @retry="load" />
    <SkeletonList v-else-if="loading" :count="3" />
    <EmptyState
      v-else-if="state.plans.length === 0"
      icon="ticket"
      title="Планов пока нет"
      :description="
        state.showCreate
          ? 'Создайте первый план для игроков'
          : 'Существующие планы появятся здесь после включения абонементов'
      "
    />
    <ul v-else class="vt-desktop-plans__grid">
      <li v-for="plan in state.plans" :key="plan.id" class="vt-card vt-desktop-plans__card">
        <strong class="vt-desktop-plans__sessions">{{ plan.totalSessions }}</strong>
        <p class="text-vt-mute-2 text-sm">{{ plan.name }}</p>
        <hr class="vt-divider" />
        <strong class="vt-mono vt-desktop-plans__price-value">{{
          formatPrice(plan.price, plan.currency)
        }}</strong>
        <p class="text-vt-mute-2 text-xs">{{ planCaption(plan) }}</p>
        <span
          class="vt-chip"
          :class="plan.status === 'active' ? 'vt-chip--grass vt-chip--dot' : ''"
          >{{ plan.status === 'active' ? 'в продаже' : 'в архиве' }}</span
        >
        <div v-if="state.showCreate && plan.status === 'active'" class="vt-desktop-plans__actions">
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="busy"
            @click="openEdit(plan)"
          >
            Изменить
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--danger vt-btn--sm"
            :disabled="busy"
            @click="archive(plan)"
          >
            Убрать из продажи
          </button>
        </div>
      </li>
      <li v-if="state.showCreate && !formOpen" class="vt-desktop-plans__new">
        <button type="button" class="vt-card vt-desktop-plans__new-btn" @click="openCreate">
          <span aria-hidden="true">+</span>
          Новый план
        </button>
      </li>
    </ul>
  </section>
</template>
