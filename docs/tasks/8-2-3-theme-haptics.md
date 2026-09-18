---
id: '8.2.3'
phase: '8'
epic: '8.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11."
roles:
  - FE
depends_on:
  - '8.2.1'
estimated_hours: '1-2'
tags:
  - telegram
  - theme
  - mini-app
---

# Task 8.2.3: Theme params + haptics

## Цель

Адаптация Mini App под тему пользователя Telegram (light/dark через themeParams). Haptic feedback на ключевых действиях.

## Контекст

Telegram передаёт themeParams (цвета фона, текста, кнопок) и colorScheme (light/dark). Mini App должен выглядеть «своим» — подхватывать тему. Haptics добавляют тактильный отклик.

## Что должно быть сделано

1. **Применение themeParams как CSS-переменных** `apps/web/plugins/telegram-theme.client.ts`:

   ```ts
   export default defineNuxtPlugin(() => {
     const tg = window.Telegram?.WebApp
     if (!tg) return

     function applyTheme() {
       const params = tg.themeParams
       const root = document.documentElement
       // Telegram theme params → CSS vars
       const map: Record<string, string> = {
         bg_color: '--tg-bg',
         text_color: '--tg-text',
         hint_color: '--tg-hint',
         link_color: '--tg-link',
         button_color: '--tg-button',
         button_text_color: '--tg-button-text',
         secondary_bg_color: '--tg-secondary-bg',
       }
       for (const [tgKey, cssVar] of Object.entries(map)) {
         if (params[tgKey]) root.style.setProperty(cssVar, params[tgKey])
       }
       // colorScheme class для Tailwind dark: вариантов
       root.classList.toggle('dark', tg.colorScheme === 'dark')
     }

     applyTheme()
     // Telegram эмитит themeChanged
     tg.onEvent?.('themeChanged', applyTheme)
   })
   ```

2. **Tailwind dark mode** — убедиться что настроен `darkMode: 'class'` (toggle через .dark на html). Ключевые компоненты используют dark: варианты для фона/текста где важно. Минимально — фон и текст подхватывают тему.

3. **Haptics в ключевых точках** (расширение 8.2.2):

   ```ts
   // успешная запись/оплата/сохранение → haptic('success')
   // ошибка → haptic('error')
   // выбор в sheet (radio, tab) → hapticImpact('light') опционально
   ```

   Применить в BookingSheet (успех записи), payment confirm (успех), EventForm (сохранение), attendance toggle (selectionChanged опционально).

4. **Безопасность темы:** themeParams могут отсутствовать/быть неполными. Fallback на дефолтные цвета (blue primary). Не полагаться полностью на Telegram-тему для критичных контрастов.

5. **Тест визуально:** light и dark Telegram темы — Mini App читаем в обеих.

## Критерии приёмки

- ✅ themeParams → CSS-переменные (--tg-bg, --tg-text, etc.)
- ✅ colorScheme dark → .dark class (Tailwind dark: варианты)
- ✅ themeChanged событие → реакция (смена темы на лету)
- ✅ Haptic success на: запись, оплата confirmed, сохранение
- ✅ Haptic error на ошибках
- ✅ Fallback цвета если themeParams отсутствуют
- ✅ Читаемость в light и dark
- ✅ Браузер (вне Telegram) → дефолтная тема, не ломается

## Подсказки

- **themeParams опциональны** — старые клиенты могут не передавать все. Fallback на дизайн-токены проекта (blue primary).
- **Не переусердствовать с тёмной темой** — минимум фон+текст должны адаптироваться. Полная dark-версия всех компонентов — можно итеративно, не блокер MVP.
- **Haptics тонко** — success/error на важном, не на каждый тап (раздражает). selectionChanged для выбора опционально.
- **onEvent themeChanged** — пользователь может сменить тему пока Mini App открыт.

## Не делать

- ❌ Не делать полный редизайн под тёмную тему (минимум адаптации)
- ❌ Не haptic на каждое действие (только значимые)
- ❌ Не полагаться на themeParams для критичного контраста (fallback)
- ❌ Не ломать браузерную тему
