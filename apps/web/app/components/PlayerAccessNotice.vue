<script setup lang="ts">
defineProps<{ access: 'pending' | 'suspended' | 'denied' }>()
</script>

<template>
  <div class="vt-card p-4" role="status">
    <VtChip :tone="access === 'pending' ? 'amber' : 'rose'" dot>
      {{
        access === 'pending'
          ? 'Заявка на рассмотрении'
          : access === 'suspended'
            ? 'Группа приостановлена'
            : 'Доступ в группу закрыт'
      }}
    </VtChip>
    <p class="text-sm text-vt-mute-2 mt-3">
      {{
        access === 'pending'
          ? 'После одобрения заявки откроются события и запись.'
          : access === 'suspended'
            ? 'Запись и покупки сейчас недоступны.'
            : 'Для этого раздела нужен доступ к группе.'
      }}
    </p>
    <NuxtLink to="/m/orgs" class="vt-btn vt-btn--ghost mt-4">Мои группы</NuxtLink>
  </div>
</template>
