export class MemberError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'MemberError'
  }
}
export class AlreadyMemberError extends MemberError {
  constructor() {
    super('member.already_exists', 'User is already a member of this organization')
  }
}
export class MemberNotFoundError extends MemberError {
  constructor(id: number | string) {
    super('member.not_found', `Member ${id} not found`)
  }
}
export class CannotBlockOwnerError extends MemberError {
  constructor() {
    super('member.cannot_block_owner', 'Owner cannot be blocked')
  }
}
export class CannotChangeOwnerRoleError extends MemberError {
  constructor() {
    super('member.cannot_change_owner_role', 'Owner role cannot be changed')
  }
}
export class OwnerCannotLeaveError extends MemberError {
  constructor() {
    super('member.owner_cannot_leave', 'Owner cannot leave; transfer ownership or archive org')
  }
}
export class CannotChangeOwnRoleError extends MemberError {
  constructor() {
    super('member.cannot_change_own_role', 'You cannot change your own role')
  }
}
export class MemberBlockedByOrgError extends MemberError {
  constructor() {
    super('member.blocked', 'You are blocked in this organization')
  }
}
export class MemberInvalidTransitionError extends MemberError {
  constructor(from: string, to: string) {
    super('member.invalid_transition', `Cannot change member status from ${from} to ${to}`)
  }
}
