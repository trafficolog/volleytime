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

/** Решение root по заявке на покупку баланса событий (22.2.3). */
export class PlatformPurchaseRequestError extends OrganizationError {
  constructor(
    code:
      | 'purchase_request.not_found'
      | 'purchase_request.not_pending'
      | 'platform.purchase_org_deleted',
    message: string,
  ) {
    super(code, message)
    this.name = 'PlatformPurchaseRequestError'
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

/** Команда платформы (29.3.1, R-15): приглашение, смена роли и удаление. */
export class PlatformStaffError extends OrganizationError {
  constructor(
    code:
      | 'platform.staff_not_found'
      | 'platform.staff_exists'
      | 'platform.staff_same_role'
      | 'platform.staff_last_owner'
      | 'platform.staff_user_not_found'
      | 'platform.staff_user_ambiguous'
      | 'platform.staff_user_inactive',
    message: string,
  ) {
    super(code, message)
    this.name = 'PlatformStaffError'
  }
}
