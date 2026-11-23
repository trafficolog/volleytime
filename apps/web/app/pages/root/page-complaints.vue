<script setup lang="ts">
import type {
  GroupPageModerationState,
  PlatformGroupPageComplaint,
  PlatformGroupPageComplaints,
} from '@volley-time/shared'
import { computed, ref, watch } from 'vue'

import { apiErrorMessage, apiErrorStatus } from '~/utils/api-error'
import {
  MODERATION_STATE_CHIPS,
  ageText,
  complaintPreset,
  complaintsKpis,
  reporterText,
  resolutionText,
  sameReasonText,
} from '~/utils/root-group-pages'
import { rootOverviewFailure } from '~/utils/root-overview'

definePageMeta({ layout: 'root', middleware: ['root'] })
useHead({ title: 'Жалобы на страницы — Root Admin' })

type Status = 'new' | 'closed'
const STATUSES: readonly { key: Status; label: string }[] = [
  { key: 'new', label: 'Новые' },
  { key: 'closed', label: 'Решённые' },
]

const API = '/api/platform/group-page-complaints'
const toast = useToast()

const status = ref<Status>('new')
const data = ref<PlatformGroupPageComplaints | null>(null)
const pending = ref(true)
const failed = ref(false)
const now = ref(Date.now())
let seq = 0

async function load() {
  const mine = ++seq
  failed.value = false
  pending.value = true
  try {
    const res = await $fetch<PlatformGroupPageComplaints>(API, {
      query: { status: status.value },
    })
    if (mine !== seq) return
    data.value = res
    now.value = Date.now()
  } catch (e) {
    if (mine !== seq) return
    // Роль root решает API: вошедший не-root — страница ошибки 403, истёкшая сессия — вход
    const reaction = rootOverviewFailure(apiErrorStatus(e))
    if (reaction === 'forbidden') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Раздел доступен только администратору платформы',
        fatal: true,
      })
    }
    if (reaction === 'login') await navigateTo('/auth/login')
    failed.value = true
  } finally {
    if (mine === seq) pending.value = false
  }
}
watch(status, () => void load())
await load()

const kpis = computed(() => (data.value ? complaintsKpis(data.value.stats, now.value) : []))
const items = computed(() => data.value?.items ?? [])

// действия ------------------------------------------------------------------------------------
const busyId = ref<number | null>(null)
const failure = ref('')

async function reject(c: PlatformGroupPageComplaint) {
  if (busyId.value) return
  busyId.value = c.id
  failure.value = ''
  try {
    await $fetch(`${API}/${c.id}/reject`, { method: 'POST' })
    toast.show(`PC-${c.id} отклонена`)
    await load()
  } catch (e) {
    failure.value = apiErrorMessage(e, 'Не удалось отклонить жалобу. Попробуйте ещё раз')
    if (apiErrorStatus(e) === 409) await load()
  } finally {
    busyId.value = null
  }
}

const resolving = ref<{
  kind: GroupPageModerationState
  complaint: PlatformGroupPageComplaint
} | null>(null)
function onResolved() {
  toast.show(
    resolving.value?.kind === 'hidden'
      ? 'Страница скрыта · причина ушла в кабинет и бот'
      : 'Принудительный noindex · причина ушла в кабинет и бот',
  )
  void load()
}
</script>

<template>
  <div class="vt-mod">
    <header class="vt-root-overview__heading">
      <h1 tabindex="-1">
        Жалобы на страницы <span class="vt-chip vt-chip--solid" aria-label="root">ROOT</span>
      </h1>
      <p class="text-vt-mute-2">Жалобы с публичных страниц групп · кнопка «Пожаловаться»</p>
    </header>

    <RootModerationTabs active="page-complaints" :new-complaints="data?.stats.open" />

    <SkeletonList v-if="pending && !data" :count="4" />
    <ErrorState v-else-if="failed && !data" message="Не удалось загрузить жалобы" @retry="load()" />
    <template v-else-if="data">
      <RootModerationKpis :items="kpis" />

      <div class="vt-mod-filters vt-mod-filters--bar" role="group" aria-label="Статус жалоб">
        <button
          v-for="s in STATUSES"
          :key="s.key"
          type="button"
          class="vt-btn vt-btn--sm"
          :aria-pressed="status === s.key"
          :data-testid="`status-${s.key}`"
          @click="status = s.key"
        >
          {{ s.label }}
        </button>
      </div>

      <p v-if="failure" class="vt-mod-error" role="alert">{{ failure }}</p>
      <p v-if="failed" class="vt-mod-error" role="alert">
        Не удалось обновить список.
        <button type="button" class="vt-mod-link" @click="load()">Повторить</button>
      </p>

      <div class="vt-card vt-mod-table" :aria-busy="pending">
        <p v-if="!items.length" class="vt-mod-empty" data-testid="complaints-empty">
          {{ status === 'new' ? 'Новых жалоб нет.' : 'Решённых жалоб пока нет.' }}
        </p>
        <ul v-else class="vt-mod-rows" aria-label="Жалобы на страницы групп">
          <li
            v-for="c in items"
            :key="c.id"
            class="vt-mod-row vt-mod-row--complaint"
            :data-complaint="c.id"
          >
            <span class="vt-code vt-mod-muted">PC-{{ c.id }}</span>
            <div class="vt-mod-row__group">
              <strong>{{ c.groupName }}</strong>
              <span class="vt-mod-muted">{{ c.city ?? 'без города' }}</span>
              <span>
                <span class="vt-chip" :class="MODERATION_STATE_CHIPS[c.pageState].chip">
                  {{ MODERATION_STATE_CHIPS[c.pageState].label }}
                </span>
                <span v-if="c.sameReasonOpen > 0" class="vt-mod-same">
                  {{ sameReasonText(c.sameReasonOpen) }}
                </span>
              </span>
            </div>
            <div class="vt-mod-row__text">
              <strong>{{ c.reasonTitle }}</strong>
              <span :class="c.details ? '' : 'vt-mod-muted'">
                {{ c.details ? `«${c.details}»` : 'без текста' }}
              </span>
              <span v-if="c.status !== 'new'" class="vt-mod-resolution">{{
                resolutionText(c)
              }}</span>
            </div>
            <span class="vt-mod-row__from" data-testid="complaint-source">
              <b>{{ reporterText(c.reporter).kind }}</b>
              <span class="vt-code vt-mod-muted">{{ reporterText(c.reporter).detail }}</span>
            </span>
            <span class="vt-mono vt-mod-muted vt-mod-row__date">{{
              ageText(c.createdAt, now)
            }}</span>
            <div v-if="c.status === 'new'" class="vt-mod-row__actions">
              <button
                type="button"
                class="vt-btn vt-btn--ghost vt-btn--sm"
                data-action="reject"
                :disabled="busyId === c.id"
                @click="reject(c)"
              >
                Отклонить
              </button>
              <button
                v-if="c.pageState === 'index'"
                type="button"
                class="vt-btn vt-btn--ghost vt-btn--sm"
                data-action="noindex"
                :aria-label="`Noindex · ${c.groupName}`"
                @click="resolving = { kind: 'noindex', complaint: c }"
              >
                Noindex
              </button>
              <button
                v-if="c.pageState !== 'hidden'"
                type="button"
                class="vt-btn vt-btn--rose vt-btn--sm"
                data-action="hide"
                :aria-label="`Скрыть · ${c.groupName}`"
                @click="resolving = { kind: 'hidden', complaint: c }"
              >
                Скрыть
              </button>
            </div>
            <span v-else />
          </li>
        </ul>
      </div>

      <p class="vt-mod-muted vt-mod-foot">
        Жалобы на организатора и оплату принимаются отдельно. Здесь только содержание публичной
        страницы.
      </p>
    </template>

    <RootModerationDialog
      v-if="resolving"
      :model-value="true"
      :kind="resolving.kind"
      :organization-id="resolving.complaint.organizationId"
      :name="resolving.complaint.groupName"
      :city="resolving.complaint.city"
      :complaint-id="resolving.complaint.id"
      :preset="complaintPreset(resolving.complaint.reasonCode)"
      @update:model-value="resolving = null"
      @done="onResolved"
      @stale="load()"
    />
    <VtToast />
  </div>
</template>
