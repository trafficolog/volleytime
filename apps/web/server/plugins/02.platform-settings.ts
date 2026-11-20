import * as Sentry from '@sentry/node'
import { setPlatformSettingsReporter } from '@volley-time/core'

/**
 * Отчёт об ошибках чтения настроек платформы (22.3.1): при сбое БД или невалидном значении core
 * возвращает значения по умолчанию и сообщает сюда. В Sentry уходит только текст без значений
 * настроек; без DSN `captureMessage` ничего не отправляет.
 */
export default defineNitroPlugin(() => {
  setPlatformSettingsReporter((message) => {
    Sentry.captureMessage(message, 'warning')
  })
})
