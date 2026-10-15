/**
 * Запись режима `invite` (событие или умолчание группы) включается только точным значением
 * `EVENT_INVITE_MODE_ENABLED=true` после выкладки полного релиза: прежний runtime не проверяет
 * `events.join_mode` и пустил бы на такое событие любого участника (ADR v3, «Правила
 * совместимости», п. 4; 20.1.3).
 */
export const isInviteModeEnabled = (value: string | undefined): boolean => value === 'true'
