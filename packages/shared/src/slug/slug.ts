const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function transliterate(input: string): string {
  return input
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase()
      const mapped = CYRILLIC_MAP[lower]
      return mapped !== undefined ? mapped : ch
    })
    .join('')
}

/**
 * Превращает строку в slug: транслитерация ru→en, нижний регистр,
 * только [a-z0-9-], схлопывание дефисов.
 */
export function slugify(input: string): string {
  return transliterate(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/**
 * Добавляет числовой суффикс для уникальности, если базовый slug занят.
 * exists — предикат проверки занятости (обычно запрос к БД).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'org'
  if (!(await exists(root))) return root
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`.slice(0, 64)
    if (!(await exists(candidate))) return candidate
  }
  throw new Error('Could not generate unique slug')
}
