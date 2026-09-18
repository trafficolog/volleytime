export class TenantError extends Error {
  code: string
  httpStatus: number
  constructor(code: string, message: string, httpStatus: number) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.name = 'TenantError'
  }
}

export class OrgNotFoundError extends TenantError {
  constructor() {
    super('organization.not_found', 'Organization not found', 404)
  }
}
export class OrgArchivedError extends TenantError {
  constructor() {
    super('organization.archived', 'Organization is archived', 410)
  }
}
export class OrgSuspendedError extends TenantError {
  constructor() {
    super('organization.suspended', 'Organization is suspended', 403)
  }
}
export class NotMemberError extends TenantError {
  constructor() {
    super('permission.not_member', 'You are not a member of this organization', 403)
  }
}
export class NoLongerMemberError extends TenantError {
  constructor() {
    super('permission.no_longer_member', 'You are no longer a member', 403)
  }
}
export class MemberBlockedError extends TenantError {
  constructor() {
    super('permission.blocked', 'You are blocked in this organization', 403)
  }
}
