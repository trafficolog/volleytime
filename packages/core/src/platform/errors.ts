import { OrganizationError } from '../organizations/errors'

/** Владелец вручную создаваемой группы не найден или не подходит (22.1.3). */
export class PlatformOwnerError extends OrganizationError {
  constructor(
    code: 'platform.owner_not_found' | 'platform.owner_ambiguous' | 'platform.owner_inactive',
    message: string,
  ) {
    super(code, message)
    this.name = 'PlatformOwnerError'
  }
}

/** Ручное начисление баланса событий root (22.2.2). */
export class PlatformGrantError extends OrganizationError {
  constructor(
    code: 'platform.grant_org_deleted' | 'platform.grant_idempotency_conflict',
    message: string,
  ) {
    super(code, message)
    this.name = 'PlatformGrantError'
  }
}

/** Блокировка и разблокировка пользователя платформы (22.1.4). */
export class PlatformUserError extends OrganizationError {
  constructor(
    code:
      | 'platform.user_not_found'
      | 'platform.user_cannot_block_self'
      | 'platform.user_cannot_block_root'
      | 'platform.user_already_blocked'
      | 'platform.user_not_blocked',
    message: string,
  ) {
    super(code, message)
    this.name = 'PlatformUserError'
  }
}
