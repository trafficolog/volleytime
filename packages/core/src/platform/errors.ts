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
