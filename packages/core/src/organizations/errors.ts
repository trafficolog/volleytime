export class OrganizationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'OrganizationError'
  }
}
export class OrganizationNotFoundError extends OrganizationError {
  constructor(orgId: number | string) {
    super('organization.not_found', `Organization ${orgId} not found`)
  }
}
export class OrganizationArchivedError extends OrganizationError {
  constructor() {
    super('organization.archived', 'Organization is archived')
  }
}
export class SlugTakenError extends OrganizationError {
  constructor(slug: string) {
    super('organization.slug_taken', `Slug "${slug}" is already taken`)
  }
}
