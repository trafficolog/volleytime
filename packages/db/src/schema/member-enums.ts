import { pgEnum } from 'drizzle-orm/pg-core'

export const memberRoleEnum = pgEnum('member_role', ['owner', 'organizer', 'assistant', 'player'])
export const memberStatusEnum = pgEnum('member_status', [
  'pending',
  'active',
  'guest',
  'blocked',
  'left',
  'rejected',
])
