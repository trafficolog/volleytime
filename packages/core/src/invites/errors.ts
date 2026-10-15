export class InviteError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'InviteError'
  }
}
/** Запросы приглашения на событие (20.1.3). */
export class InviteRequestError extends InviteError {
  constructor(code: string, message: string) {
    super(code, message)
    this.name = 'InviteRequestError'
  }
}
export class InviteRequestNotFoundError extends InviteRequestError {
  constructor() {
    super('invite_request.not_found', 'Invite request not found')
  }
}
export class InviteRequestAlreadyPendingError extends InviteRequestError {
  constructor() {
    super('invite_request.already_pending', 'An invite request is already pending')
  }
}
export class InviteRequestNotPendingError extends InviteRequestError {
  constructor() {
    super('invite_request.not_pending', 'Invite request is already decided')
  }
}
export class InviteNotFoundError extends InviteError {
  constructor(token: string) {
    super('invite.not_found', `Invite "${token}" not found`)
  }
}
export class InviteRevokedError extends InviteError {
  constructor() {
    super('invite.revoked', 'This invite has been revoked')
  }
}
export class InviteExpiredError extends InviteError {
  constructor() {
    super('invite.expired', 'This invite has expired')
  }
}
export class InviteUsesExhaustedError extends InviteError {
  constructor() {
    super('invite.uses_exhausted', 'This invite has reached its max uses')
  }
}
