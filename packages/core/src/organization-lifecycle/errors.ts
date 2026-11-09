/** Ошибки передачи владения и удаления группы (21.2.17). HTTP-статусы — в handle-errors (web). */
export class OrganizationLifecycleError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'OrganizationLifecycleError'
  }
}

/** У группы уже есть ожидающая передача (409). */
export class OwnershipTransferPendingError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.pending_exists', 'The group already has a pending ownership transfer')
  }
}

/**
 * Ссылка не найдена или выдана другому пользователю (404). Чужая и несуществующая ссылки
 * неотличимы: ответ не раскрывает ни группу, ни получателя.
 */
export class OwnershipTransferInvalidError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.invalid', 'Ownership transfer link is not valid')
  }
}

export class OwnershipTransferExpiredError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.expired', 'Ownership transfer link has expired')
  }
}

export class OwnershipTransferCancelledError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.cancelled', 'Ownership transfer was cancelled')
  }
}

/** Ссылка уже использована (повторное принятие, 409). */
export class OwnershipTransferUsedError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.used', 'Ownership transfer link was already used')
  }
}

/** Получатель — сам owner, не участник группы или участник не в статусе active (422). */
export class OwnershipTransferRecipientError extends OrganizationLifecycleError {
  constructor(message: string) {
    super('ownership_transfer.recipient_invalid', message)
  }
}

/** Получатель перестал быть действующим участником до принятия (409); передача остаётся ожидающей. */
export class OwnershipTransferRecipientGoneError extends OrganizationLifecycleError {
  constructor() {
    super('ownership_transfer.recipient_not_member', 'Recipient is no longer an active member')
  }
}

/** Введённое название не совпадает с названием группы (422). */
export class DeleteConfirmationMismatchError extends OrganizationLifecycleError {
  constructor() {
    super('organization.delete_confirmation_mismatch', 'Group name confirmation does not match')
  }
}

/** Удаление невозможно, пока есть ожидающая передача владения (409): её нужно отменить. */
export class DeleteBlockedByTransferError extends OrganizationLifecycleError {
  constructor() {
    super('organization.transfer_pending', 'Cancel the pending ownership transfer first')
  }
}

export class OrganizationNotDeletedError extends OrganizationLifecycleError {
  constructor() {
    super('organization.not_deleted', 'Organization is not deleted')
  }
}

/** Окно восстановления закончилось (410): группа остаётся удалённой. */
export class RestoreWindowClosedError extends OrganizationLifecycleError {
  constructor() {
    super('organization.restore_window_closed', 'The restore window has closed')
  }
}
