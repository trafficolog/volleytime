<script setup lang="ts">
/** Плитки KPI модерации (24.1.3): подпись, число, пояснение. */
defineProps<{ items: readonly (readonly [string, string, string])[] }>()
</script>

<template>
  <dl class="vt-mod-kpis" data-testid="mod-kpis">
    <div v-for="[label, value, hint] in items" :key="label" class="vt-card vt-mod-kpi">
      <dt class="vt-cap">{{ label }}</dt>
      <dd>
        <span class="vt-mono vt-mod-kpi__value">{{ value }}</span>
        <span class="vt-mod-kpi__hint">{{ hint }}</span>
      </dd>
    </div>
  </dl>
</template>
