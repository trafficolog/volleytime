import type { Organization, OrganizationMember } from '@volley-time/db'

declare module 'h3' {
  interface H3EventContext {
    organization?: Organization
    member?: OrganizationMember
    userId?: number
  }
}

export {}
