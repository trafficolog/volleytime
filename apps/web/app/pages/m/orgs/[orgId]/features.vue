<script setup lang="ts">
import { defaultPlayerFeatures, type PlayerFeature, type PlayerFeatures } from '@volley-time/shared'

import VtSegment from '~/components/vt/Segment.vue'
import VtToggle from '~/components/vt/Toggle.vue'
import {
  ALWAYS_ON_TEXT,
  featureRows,
  PRESET_OPTIONS,
  presetFlags,
  presetOf,
  type FeaturePreset,
} from '~/utils/profile-features'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

// «Что показывать» (23.2.3, M-12): флаги сохраняются сразу через PATCH /api/me/features (23.1.1).
// Ключ общий с таб-баром (miniapp-org) и профилем: после сохранения они обновляются.
const route = useRoute()
const base = computed(() => `/m/orgs/${Number(route.params.orgId)}`)
const { haptic } = useTelegram()

const {
  data,
  error,
  pending,
  refresh: reload,
} = await useFetch<{ features: PlayerFeatures }>('/api/me/features', { key: 'me-features' })

const features = computed(() => data.value?.features ?? defaultPlayerFeatures())
const rows = computed(() => featureRows(features.value))
// «Своё» — явный выбор игрока: флаги не меняются, пока он их не поменяет
const forcedCustom = ref(false)
const preset = computed<FeaturePreset>(() =>
  forcedCustom.value ? 'custom' : presetOf(features.value),
)
const saveError = ref('')

// Сохранения идут строго по очереди: нажатия во время PATCH не блокируются и не теряются,
// а копятся и уходят одним следующим PATCH (последнее значение флага побеждает).
const queue: Partial<PlayerFeatures>[] = []
let draining = false
let confirmed: PlayerFeatures | null = null

const pendingPatch = (): Partial<PlayerFeatures> => Object.assign({}, ...queue)
const showFlags = (base: PlayerFeatures) => {
  data.value = { features: { ...base, ...pendingPatch() } }
}

async function drain() {
  if (draining) return
  draining = true
  let needsRefresh = false
  try {
    for (;;) {
      if (!queue.length) {
        if (!needsRefresh) break
        needsRefresh = false
        // обновление общего кэша не должно отменять уже сохранённое: своя ошибка, свой try
        try {
          await refreshNuxtData('me-features')
          confirmed = data.value?.features ?? confirmed
        } catch {
          // данные на экране уже верны; кэш обновится при следующей загрузке
        }
        if (confirmed) showFlags(confirmed)
        continue
      }
      const patch = Object.assign({}, ...queue.splice(0)) as Partial<PlayerFeatures>
      try {
        const result = await $fetch<{ features: PlayerFeatures }>('/api/me/features', {
          method: 'PATCH',
          body: patch,
        })
        confirmed = result.features
        showFlags(confirmed)
        saveError.value = ''
        needsRefresh = true
        haptic('success')
      } catch (cause) {
        // откатываем только неудавшийся PATCH; поздние нажатия остаются в очереди
        if (confirmed) showFlags(confirmed)
        saveError.value = apiErrorMessage(cause, 'Не удалось сохранить. Попробуйте ещё раз.')
        haptic('error')
      }
    }
  } finally {
    draining = false
  }
}

function save(patch: Partial<PlayerFeatures>) {
  saveError.value = ''
  confirmed ??= data.value?.features ?? defaultPlayerFeatures()
  queue.push(patch)
  showFlags(data.value?.features ?? defaultPlayerFeatures())
  return drain()
}

function toggle(feature: PlayerFeature, enabled: boolean) {
  forcedCustom.value = false
  return save({ [feature]: enabled })
}

function choosePreset(value: string) {
  const next = value as FeaturePreset
  const flags = presetFlags(next)
  forcedCustom.value = next === 'custom'
  if (flags) void save(flags)
}
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader title="Что показывать" :back="`${base}/profile`" />
    <main class="space-y-6 px-4 py-4">
      <SkeletonList v-if="pending && !data" :count="3" />
      <ErrorState
        v-else-if="error && !data"
        message="Не удалось загрузить функции"
        @retry="reload()"
      />
      <template v-else>
        <section aria-labelledby="features-preset-title" class="space-y-2">
          <h2 id="features-preset-title" class="vt-cap px-1 text-vt-mute-2">Пресет</h2>
          <VtSegment
            :model-value="preset"
            :options="PRESET_OPTIONS"
            label="Пресет функций"
            data-testid="features-presets"
            @update:model-value="choosePreset"
          />
        </section>

        <section aria-labelledby="features-list-title" class="space-y-2">
          <h2 id="features-list-title" class="vt-cap px-1 text-vt-mute-2">Функции</h2>
          <ul class="vt-card divide-y divide-vt-stroke overflow-hidden">
            <li
              v-for="row in rows"
              :key="row.feature"
              data-testid="feature-row"
              class="flex min-h-11 items-center gap-3 px-3.5 py-3"
            >
              <span class="min-w-0 flex-1">
                <span :id="`feature-${row.feature}`" class="block text-[15px] font-medium">{{
                  row.label
                }}</span>
                <span class="mt-0.5 block text-xs text-vt-mute-2">{{ row.hint }}</span>
              </span>
              <VtToggle
                :model-value="row.enabled"
                :labelledby="`feature-${row.feature}`"
                :data-testid="`feature-toggle-${row.feature}`"
                @update:model-value="toggle(row.feature, $event)"
              />
            </li>
            <li
              data-testid="feature-always"
              class="flex min-h-11 items-center gap-3 px-3.5 py-3 text-vt-mute-2"
            >
              <VtIcon name="calendar" :size="16" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-[15px] font-medium">{{ ALWAYS_ON_TEXT }}</span>
              <VtChip tone="grass" dot>вкл.</VtChip>
            </li>
          </ul>
          <p v-if="saveError" class="px-1 text-sm text-vt-rose-ink" role="alert">
            {{ saveError }}
          </p>
          <p class="px-1 text-xs text-vt-mute-2">
            Данные выключенной функции не удаляются: они вернутся при включении.
          </p>
        </section>
      </template>
    </main>
  </div>
</template>
