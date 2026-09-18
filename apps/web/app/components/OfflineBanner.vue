<script setup lang="ts">
const { isOnline } = useOnline()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="!isOnline"
      class="fixed top-0 inset-x-0 z-50 bg-vt-amber text-[#0e0e10] text-sm text-center py-2 font-semibold"
      role="status"
    >
      Нет соединения — данные могут быть неактуальны
    </div>
  </Transition>
</template>
