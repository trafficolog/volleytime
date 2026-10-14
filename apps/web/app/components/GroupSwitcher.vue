<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { groupMonogram } from '~/utils/group-monogram'
import { playerGroupOptions } from '~/utils/player-navigation'

/**
 * Шторка «Мои группы» (M-04). Выбор группы — переход на `/m/orgs/{id}`: вкладки группы
 * читают данные по маршруту, поэтому переключаются все разделы сразу.
 * Список — `ul` со ссылками и `aria-current`: выбор переходит по ссылке, поэтому роли
 * radio не используются (отклонение от handoff/README «role=radio», см. карточку 20.4.3).
 * Группы без доступа (ожидание, приостановлена) не являются ссылками.
 */
const props = defineProps<{ currentOrgId: number; id?: string }>()
const open = defineModel<boolean>({ default: false })
const { orgs, loading, fetchAll, selectOrg } = useOrganizations()
const loadError = ref('')

const options = computed(() => playerGroupOptions(orgs.value, props.currentOrgId))

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

function chooseGroup(group: { id: number }) {
  selectOrg(group.id)
  open.value = false
}
</script>

<template>
  <VtSheet :id="id" v-model="open" title="Мои группы">
    <SkeletonList v-if="loading && !orgs.length" :count="2" />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
    <ul v-else class="grid gap-2.5">
      <li v-for="group in options" :key="group.id">
        <NuxtLink
          v-if="group.selectable"
          :to="group.to"
          :aria-current="group.selected ? 'true' : undefined"
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
            <span v-if="group.city" class="mt-0.5 block text-xs text-vt-mute-2">
              {{ group.city }}
            </span>
          </span>
          <span
            data-selected-mark
            aria-hidden="true"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            :class="
              group.selected
                ? 'bg-vt-flame text-vt-on-accent'
                : 'ring-1 ring-inset ring-vt-stroke-2'
            "
          >
            <VtIcon v-if="group.selected" name="check" :size="14" :stroke-width="2.4" />
          </span>
        </NuxtLink>
        <div v-else aria-disabled="true" class="vt-card !flex min-h-11 items-center gap-3 p-3">
          <span
            data-monogram
            aria-hidden="true"
            class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
            :class="groupMonogram(group.name).className"
            >{{ groupMonogram(group.name).initials }}</span
          >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ group.name }}</span>
            <span class="mt-0.5 block text-xs text-vt-mute-2">
              {{ group.statusLabel ?? group.city }}
            </span>
          </span>
        </div>
      </li>
    </ul>
    <div class="mt-4 grid gap-2">
      <NuxtLink to="/m/orgs/create" class="vt-btn vt-btn--ghost vt-btn--full min-h-11">
        <VtIcon name="plus" :size="16" /> Создать свою группу
      </NuxtLink>
      <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost vt-btn--full min-h-11">
        <VtIcon name="link" :size="16" /> Вступить по ссылке
      </NuxtLink>
    </div>
  </VtSheet>
</template>
