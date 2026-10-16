/**
 * Планировщик фоновых задач события (20.3.1) включается только точным значением
 * `SCHEDULER_ENABLED=true` после выкладки полного релиза (ADR v3, «Правила совместимости», п. 4):
 * прежний runtime открыл бы запись сразу, не зная `booking_opens_at`, и не понимает предложений мест.
 * Флаг одновременно: запускает цикл задач в web-процессе, разрешает задавать время открытия записи и
 * переключает освобождение места с автопродвижения на предложение с TTL (D-03).
 */
export const isSchedulerEnabled = (value: string | undefined): boolean => value === 'true'

/** Флаг из окружения процесса. */
export const schedulerEnabled = (): boolean => isSchedulerEnabled(process.env.SCHEDULER_ENABLED)
