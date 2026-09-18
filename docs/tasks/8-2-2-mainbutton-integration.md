---
id: '8.2.2'
phase: '8'
epic: '8.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - FE
depends_on:
  - '8.2.1'
estimated_hours: '2-3'
tags:
  - telegram
  - webapp-sdk
  - ui
---

# Task 8.2.2: MainButton/BackButton интеграция в ключевые flow

## Цель

Применить MainButton к главным действиям ключевых страниц 4-6 (запись, оплата, сохранение, подтверждение). BackButton на вложенных экранах. Не переписываем страницы — добавляем нативность.

## Контекст

Решение 1/2: тонкий слой, MainButton для ключевых действий. Страницы из 4-6 имеют in-page кнопки — добавляем MainButton поверх (in-page остаётся для браузерного fallback). Graceful: в браузере работают in-page, в Telegram — MainButton.

## Что должно быть сделано

1. **BookingSheet (5.9.3)** — MainButton «Записаться»/«В лист ожидания»:

   ```ts
   // в BookingSheet.vue
   const { showMainButton, hideMainButton, setMainButtonLoading, haptic, isTelegram } =
     useTelegram()

   onMounted(() => {
     if (isTelegram.value) {
       showMainButton(isFull.value ? 'В лист ожидания' : 'Записаться', onConfirm)
     }
   })
   onUnmounted(() => hideMainButton())

   // в onConfirm: setMainButtonLoading(true) во время запроса, haptic('success') при успехе
   ```

   In-page кнопка скрывается в Telegram (`v-if="!isTelegram"`) или остаётся (дублирование некритично, но лучше скрыть).

2. **Страница события (5.9.2)** — MainButton для основного действия (Записаться/Отменить):

   ```ts
   // sticky action bar заменяется MainButton в Telegram
   watchEffect(() => {
     if (!isTelegram.value) return
     if (!myBooking.value && canAct.value) {
       showMainButton(isFull ? 'В лист ожидания' : 'Записаться', onBookClick)
     } else if (canCancel.value) {
       showMainButton('Отменить запись', onCancelClick)
     } else {
       hideMainButton()
     }
   })
   ```

3. **EventForm (5.10.1)** — MainButton «Создать»/«Сохранить»:

   ```ts
   onMounted(() => showMainButton(isEdit ? 'Сохранить' : 'Создать событие', onSubmit))
   onUnmounted(() => hideMainButton())
   // setMainButtonLoading во время submit
   ```

4. **Payment confirm (6.5.1)** — на странице подтверждения, или оставить in-page (список, не один action). MainButton уместен для single-action экранов. Для списка pending — in-page кнопки на каждом (MainButton не подходит для множества). Документировать: MainButton для single primary action, in-page для списков.

5. **Attendance (5.10.3)** — MainButton «Сохранить посещаемость» (появляется при hasChanges):

   ```ts
   watchEffect(() => {
     if (!isTelegram.value) return
     if (hasChanges.value) showMainButton('Сохранить посещаемость', saveAttendance)
     else hideMainButton()
   })
   ```

6. **BackButton глобально** — в layout miniapp или per-page:

   ```ts
   // layout miniapp или composable useMiniAppNav:
   const router = useRouter()
   const { showBackButton, hideBackButton } = useTelegram()
   // на вложенных страницах (не корень /m/):
   onMounted(() => showBackButton(() => router.back()))
   onUnmounted(() => hideBackButton())
   ```

   Можно автоматизировать: показывать BackButton если route не корневой.

7. **Паттерн-документация** в комментарии: какие экраны используют MainButton (single action), какие in-page (списки).

## Критерии приёмки

- ✅ BookingSheet: MainButton «Записаться»/«В лист ожидания» в Telegram, loading во время запроса
- ✅ Страница события: MainButton реагирует на состояние (записаться/отменить)
- ✅ EventForm: MainButton «Создать»/«Сохранить»
- ✅ Attendance: MainButton «Сохранить» при изменениях
- ✅ BackButton на вложенных экранах → router.back()
- ✅ Список pending payments: in-page кнопки (MainButton не для списков)
- ✅ Браузер: in-page кнопки работают (isTelegram=false)
- ✅ Cleanup: кнопки скрываются при уходе (onUnmounted)
- ✅ Haptic на ключевых действиях (запись, сохранение)

## Подсказки

- **MainButton для single primary action.** Списки (pending payments, события) — in-page кнопки, т.к. MainButton один. Чёткое правило: один главный экшен на экран → MainButton; несколько/список → in-page.
- **watchEffect для реактивного MainButton** — когда текст/действие зависят от состояния (записан/нет).
- **Cleanup обязателен** — иначе MainButton протекает между экранами (8.2.1 ловушка).
- **Дублирование in-page + MainButton** — лучше скрыть in-page в Telegram (`v-if="!isTelegram"`), чтобы не было двух кнопок.

## Не делать

- ❌ Не переписывать логику страниц (только добавить MainButton-обёртку)
- ❌ Не использовать MainButton для списков (in-page)
- ❌ Не забывать cleanup (onUnmounted hide)
- ❌ Не ломать браузерный fallback
