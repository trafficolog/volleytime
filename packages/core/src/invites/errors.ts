export class InviteError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'InviteError'
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
