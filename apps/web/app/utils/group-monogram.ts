/**
 * Заглушка логотипа группы (M-04): у групп нет логотипа в модели данных, поэтому
 * показываем монограмму из двух букв. Цвет стабилен для названия (хэш), только токены.
 */
const TINTS = [
  'bg-vt-blue-soft-tile text-vt-flame-ink',
  'bg-vt-orange-soft text-vt-orange-ink',
  'bg-vt-grass-soft text-vt-grass-ink',
  'bg-vt-amber-soft text-vt-amber-ink',
] as const

export function groupMonogram(name: string): { initials: string; className: string } {
  const initials = name
    .replace(/[«»"']/g, '')
    .split(/[\s.·-]+/)
    .filter((word) => /^[A-Za-zА-Яа-яЁё]/.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
  const hash = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  return { initials, className: TINTS[hash % TINTS.length]! }
}
