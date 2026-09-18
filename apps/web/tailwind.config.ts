import type { Config } from 'tailwindcss'

/** Tailwind-тема поверх токенов --vt-* (Task 3.9.13). */
const v = (name: string) => `var(--vt-${name})`

export default {
  darkMode: 'class',
  content: ['./app/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        vt: {
          ink: v('ink'),
          'ink-2': v('ink-2'),
          'ink-3': v('ink-3'),
          stroke: v('stroke'),
          'stroke-2': v('stroke-2'),
          bone: v('bone'),
          'bone-2': v('bone-2'),
          paper: v('paper'),
          mute: v('mute'),
          'mute-2': v('mute-2'),
          flame: v('flame'),
          'flame-deep': v('flame-deep'),
          orange: v('orange'),
          amber: v('amber'),
          'amber-ink': v('amber-ink'),
          grass: v('grass'),
          'grass-ink': v('grass-ink'),
          rose: v('rose'),
          'rose-ink': v('rose-ink'),
          'on-accent': v('on-accent'),
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: { card: 'var(--vt-shadow-card)' },
    },
  },
} satisfies Config
