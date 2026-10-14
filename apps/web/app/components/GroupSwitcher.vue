<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { groupMonogram } from '~/utils/group-monogram'
import { playerGroupOptions } from '~/utils/player-navigation'

/**
 * Шторка «Мои группы» (M-04). Выбор группы — переход на `/m/orgs/{id}`: вкладки группы
 * читают данные по маршруту, поэтому переключаются все разделы сразу.
 */
const props = defineProps<{ currentOrgId: number; id?: string }>()
const open = defineModel<boolean>({ default: false })
const { orgs, loading, fetchAll, selectOrg } = useOrganizations()
const loadError = ref('')

const options = computed(() => playerGroupOptions(orgs.value, props.currentOrgId))
// Roving tabindex: в группе одна табулируемая точка — выбранная группа (или первая).
const focusId = computed(
  () => options.value.find((group) => group.selected)?.id ?? options.value[0]?.id,
)

async function load() {
  loadError.value = ''
  try {
    await fetchAll()
  } catch (error) {
    loadError.value = apiErrorMessage(error, 'Не удалось загрузить группы')
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) void load()
  },
  { immediate: true },
)

function chooseGroup(group: { id: number; selectable: boolean }) {
  if (group.selectable) selectOrg(group.id)
  open.value = false
}

function moveFocus(event: KeyboardEvent, step: 1 | -1) {
  const items = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]'),
  ]
  const index = items.indexOf(document.activeElement as HTMLElement)
  if (index < 0) return
  event.preventDefault()
  items[(index + step + items.length) % items.length]?.focus()
}

// Стрелки переносят фокус, а не выбор: переход происходит по Enter или Space.
function onRadiogroupKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') moveFocus(event, 1)
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') moveFocus(event, -1)
  else if (event.key === ' ' && document.activeElement instanceof HTMLElement) {
    if (document.activeElement.getAttribute('role') !== 'radio') return
    event.preventDefault()
    document.activeElement.click()
  }
}
</script>

<template>
  <VtSheet :id="id" v-model="open" title="Мои группы">
    <SkeletonList v-if="loading && !orgs.length" :count="2" />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
    <div
      v-else
      role="radiogroup"
      aria-label="Мои группы"
      class="grid gap-2.5"
      @keydown="onRadiogroupKeydown"
    >
      <NuxtLink
        v-for="group in options"
        :key="group.id"
        :to="group.to"
        role="radio"
        :aria-checked="group.selected ? 'true' : 'false'"
        :aria-disabled="group.selectable ? undefined : 'true'"
        :tabindex="group.id === focusId ? 0 : -1"
        class="vt-card !flex min-h-11 items-center gap-3 p-3 no-underline"
        @click="chooseGroup(group)"
      >
        <span
          data-monogram
          aria-hidden="true"
          class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
          :class="groupMonogram(group.name).className"
          >{{ groupMonogram(group.name).initials }}</span
        >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{{ group.name }}</span>
          <span v-if="group.statusLabel || group.city" class="mt-0.5 block text-xs text-vt-mute-2">
            {{ group.statusLabel ?? group.city }}
          </span>
        </span>
        <span
          data-selected-mark
          aria-hidden="true"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          :class="
            group.selected ? 'bg-vt-flame text-vt-on-accent' : 'ring-1 ring-inset ring-vt-stroke-2'
          "
        >
          <VtIcon v-if="group.selected" name="check" :size="14" :stroke-width="2.4" />
        </span>
      </NuxtLink>
    </div>
    <div class="mt-4 grid gap-2">
      <NuxtLink to="/m/orgs/create" class="vt-btn vt-btn--ghost vt-btn--full min-h-11">
        <VtIcon name="plus" :size="16" /> Создать свою группу
      </NuxtLink>
      <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full min-h-11">
        Вступить по приглашению
      </NuxtLink>
    </div>
  </VtSheet>
</template>
