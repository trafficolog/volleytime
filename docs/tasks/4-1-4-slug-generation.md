---
id: '4.1.4'
phase: '4'
epic: '4.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '4.1.1'
estimated_hours: '1'
tags:
  - utilities
  - slug
  - organizations
---

# Task 4.1.4: Slug generation + uniqueness

## Цель

Реализовать функцию `generateUniqueSlug(db, name): Promise<string>` — генерирует URL-safe slug из имени организации, проверяет уникальность, добавляет суффикс если slug занят.

## Контекст

Slug используется в public URLs (`/o/<slug>`) — должен быть уникален глобально. Также может быть переопределён вручную при создании организации.

Пример:

- name: "Volley Minsk Evening" → slug: `volley-minsk-evening`
- Если уже занят → `volley-minsk-evening-2`, `-3`, ...

Поддержка кириллицы: транслитерация. `Команда Х` → `komanda-h`.

## Что должно быть сделано

1. **`apps/web/modules/organizations/slug.ts`:**

   ```ts
   import { db as defaultDb, organizations } from '@volley-time/db'
   import { eq } from 'drizzle-orm'

   // Простая транслитерация ru→en (для slug)
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

   export function slugify(input: string): string {
     const lower = input.toLowerCase().trim()
     const transliterated = lower
       .split('')
       .map((ch) => CYRILLIC_MAP[ch] ?? ch)
       .join('')
     return transliterated
       .replace(/[^a-z0-9\s-]/g, '') // убираем спец-символы
       .replace(/\s+/g, '-') // пробелы → дефисы
       .replace(/-+/g, '-') // множественные дефисы → один
       .replace(/^-|-$/g, '') // обрезаем дефисы по краям
       .slice(0, 50) // ограничение длины
   }

   /**
    * Generate unique slug. Adds -N suffix if slug is taken.
    */
   export async function generateUniqueSlug(db: typeof defaultDb, name: string): Promise<string> {
     const base = slugify(name) || 'org' // fallback если name даёт пустую строку

     // Проверяем base
     const existing = await db.query.organizations.findFirst({
       where: eq(organizations.slug, base),
     })
     if (!existing) return base

     // Ищем свободный с суффиксом
     for (let i = 2; i < 1000; i++) {
       const candidate = `${base}-${i}`
       const taken = await db.query.organizations.findFirst({
         where: eq(organizations.slug, candidate),
       })
       if (!taken) return candidate
     }

     throw new Error(`Could not generate unique slug from "${name}"`)
   }
   ```

2. **Использование в `organizationService.create`** (уже в 4.1.2):

   ```ts
   const slug = parsed.slug ?? (await generateUniqueSlug(tx, parsed.name))
   ```

3. **При ручном вводе slug**:
   - Validate format через Zod regex `/^[a-z0-9-]+$/`
   - Check uniqueness отдельно — если занят, выбросить `SlugTakenError`

   В service.create:

   ```ts
   if (parsed.slug) {
     const existing = await organizationRepository.getBySlug(tx, parsed.slug)
     if (existing) throw new SlugTakenError(parsed.slug)
   }
   const slug = parsed.slug ?? (await generateUniqueSlug(tx, parsed.name))
   ```

4. **Unit-тесты:**
   ```ts
   // apps/web/modules/organizations/__tests__/slug.test.ts
   import { describe, test, expect } from 'vitest'
   import { slugify } from '../slug'

   describe('slugify', () => {
     test('latin name', () => {
       expect(slugify('Volley Minsk Evening')).toBe('volley-minsk-evening')
     })

     test('cyrillic name', () => {
       expect(slugify('Волейбол Минск')).toBe('voleybol-minsk')
     })

     test('mixed case', () => {
       expect(slugify('FRIDAY Pickup')).toBe('friday-pickup')
     })

     test('removes special chars', () => {
       expect(slugify('Test! @#$ %^&')).toBe('test')
     })

     test('handles multiple spaces', () => {
       expect(slugify('a   b   c')).toBe('a-b-c')
     })

     test('trims dashes', () => {
       expect(slugify('---hello---')).toBe('hello')
     })

     test('empty input', () => {
       expect(slugify('')).toBe('')
     })

     test('only special chars returns empty', () => {
       expect(slugify('!!!')).toBe('')
     })

     test('limits length to 50', () => {
       expect(slugify('a'.repeat(100)).length).toBe(50)
     })
   })
   ```

## Критерии приёмки

- ✅ `slugify('Volley Minsk')` → `'volley-minsk'`
- ✅ Кириллица транслитерируется: `slugify('Команда Х')` → `'komanda-h'`
- ✅ Спец-символы убираются: `slugify('a!b@c')` → `'abc'`
- ✅ Длина обрезается до 50
- ✅ Пустой / только-спец-символы input → пустая строка (fallback на `'org'` в generateUniqueSlug)
- ✅ `generateUniqueSlug` возвращает уникальный slug
- ✅ При коллизии — добавляет суффикс `-2`, `-3`, ...
- ✅ Unit-тесты проходят

## Подсказки

- **CYRILLIC_MAP покрывает русский алфавит.** Для белорусского — `і`, `ў`, `э` всё уже есть (и=i, ў~u, э=e). Если нужны украинские/другие — расширить mapping.
- **Race condition:** между check и insert другой запрос может занять slug. Защита через unique constraint в БД (4.1.1) — если race condition, insert упадёт с unique violation. В organizationService.create отлавливаем и retry'им.
- **Альтернатива generateUniqueSlug с suffix:** добавлять короткий random `-x7k` суффикс при коллизии. Plus: race-safe. Minus: некрасивые URLs.

## Не делать

- ❌ Не использовать `nanoid` или uuid для slug — нужна читабельность
- ❌ Не делать reserved-slug-list (типа запретить `admin`, `api`) сейчас — Phase 11+ если станет нужно
- ❌ Не делать ML/AI генерацию красивых slug'ов
- ❌ Не делать опцию change slug после создания — security/SEO concern, требует redirect handling
