/**
 * Заглушка логотипа группы (M-04): у групп нет логотипа в модели данных, поэтому
 * показываем монограмму из двух букв. Цвет стабилен для названия (хэш), только токены.
 * Работает по кодовым точкам: буквы вне базового кириллического набора (і, ў) и
 * эмодзи-слова не ломают инициалы. Без букв — запасной знак «Г».
 */
const TINTS = [
  'bg-vt-blue-soft-tile text-vt-flame-ink',
  'bg-vt-orange-soft text-vt-orange-ink',
  'bg-vt-grass-soft text-vt-grass-ink',
  'bg-vt-amber-soft text-vt-amber-ink',
] as const
const FALLBACK_INITIAL = 'Г'

export function groupMonogram(name: string): { initials: string; className: string } {
  const initials = name
    .replace(/[«»"']/g, '')
    .split(/[\s.·-]+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
  const hash = Array.from(name).reduce(
    (sum, char) => (sum * 31 + (char.codePointAt(0) ?? 0)) >>> 0,
    7,
  )
  return {
    initials: initials || FALLBACK_INITIAL,
    className: TINTS[hash % TINTS.length]!,
  }
}
