export class NotificationSettingsError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'NotificationSettingsError'
  }
}
export class NotificationMandatoryError extends NotificationSettingsError {
  constructor(type: string) {
    super('notification_settings.mandatory', `Notification type ${type} cannot be switched off`)
  }
}
export class NotificationSettingsEmptyError extends NotificationSettingsError {
  constructor() {
    super('notification_settings.empty', 'At least one notification type is required')
  }
}
