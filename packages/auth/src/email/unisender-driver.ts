import type { EmailDriver } from './types'

// Реализуется в Phase 9 (production email). Пока placeholder.
export const unisenderEmailDriver: EmailDriver = {
  async send(_message) {
    throw new Error('Unisender Go driver not implemented yet (Phase 9)')
  },
}
