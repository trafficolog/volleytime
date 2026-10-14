/**
 * Запись больше одного места включается только точным значением `EVENT_MULTI_SEAT_ENABLED=true`
 * после выкладки полного релиза: прежний runtime считает занятость через count(*) (ADR v3,
 * «Правила совместимости», п. 4). Места в очереди у записи в основе возможны только при seats > 1.
 */
export const isMultiSeatEnabled = (value: string | undefined): boolean => value === 'true'
