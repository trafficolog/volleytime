<script setup lang="ts">
/** Геометрический набор иконок из прототипа (atoms.jsx → Icon). */
const props = withDefaults(defineProps<{ name: string; size?: number; strokeWidth?: number }>(), {
  size: 18,
  strokeWidth: 1.6,
})

const PATHS: Record<string, string> = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ticket:
    '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M12 7v10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users:
    '<circle cx="9" cy="9" r="3.5"/><path d="M3 19c.7-3 3.3-5 6-5s5.3 2 6 5"/><path d="M16 11a3 3 0 1 0 0-6"/><path d="M18 19c-.4-2-1.8-3.5-3.5-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-r': '<path d="m9 6 6 6-6 6"/>',
  'chevron-l': '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-11"/>',
  bell: '<path d="M6 16V10a6 6 0 0 1 12 0v6"/><path d="M4 17h16"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  pin: '<path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="15" r="1.5"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16Z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  tg: '<path d="m21 4-3 17-7-5-3 2v-4l11-9-13 7-4-1Z"/>',
  'arrow-r': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  chart: '<path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  alert: '<path d="M12 3 2 21h20Z"/><path d="M12 10v5M12 18h.01"/>',
}

const svg = computed(() => PATHS[props.name] ?? '')
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- статичный набор путей, без пользовательского ввода -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="svg"
  />
</template>
