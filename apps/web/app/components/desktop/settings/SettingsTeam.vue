<script setup lang="ts">
import VtSegment from '~/components/vt/Segment.vue'
import { SETTING_IMPACT } from '~/utils/group-settings'
import type { OrgProfile, SettingsController } from '~/utils/group-settings-controller'

/** Команда: как новые участники попадают в состав и где управлять людьми. */
const props = defineProps<{
  org: OrgProfile
  base: string
  canEdit: boolean
  controller: SettingsController
}>()

function choose(value: string) {
  if (!props.canEdit) return
  if (value === props.org.defaultMemberStatus) return
  void props.controller.setMemberStatus(value as OrgProfile['defaultMemberStatus'])
}
</script>

<template>
  <div class="vt-settings-stack">
    <section class="vt-card vt-settings-card">
      <h2 class="vt-settings-card__title">Новые участники</h2>
      <div class="vt-settings-field">
        <VtSegment
          :model-value="org.defaultMemberStatus"
          :readonly="!canEdit"
          label="Новые участники"
          :options="[
            {
              value: 'active',
              label: 'Сразу в составе',
              disabled: controller.isPending('defaultMemberStatus'),
            },
            {
              value: 'pending',
              label: 'После одобрения',
              disabled: controller.isPending('defaultMemberStatus'),
            },
          ]"
          @update:model-value="choose"
        />
        <p class="vt-settings-hint">{{ SETTING_IMPACT.defaultMemberStatus }}</p>
      </div>
    </section>
    <section class="vt-card vt-settings-card">
      <h2 class="vt-settings-card__title">Люди и роли</h2>
      <p class="vt-settings-hint">
        Роли организаторов и помощников меняет владелец группы на странице «Игроки»; приглашения
        создаются на странице «Приглашения».
      </p>
      <div class="vt-settings-actions vt-settings-actions--start">
        <NuxtLink :to="`${base}/members`" class="vt-btn vt-btn--ghost vt-btn--sm">Игроки</NuxtLink>
        <NuxtLink :to="`${base}/invite`" class="vt-btn vt-btn--ghost vt-btn--sm">
          Приглашения
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
