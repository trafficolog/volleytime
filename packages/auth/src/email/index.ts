import { consoleEmailDriver } from './console-driver'
import { memoryEmailDriver } from './memory-driver'
import type { EmailDriver } from './types'
import { unisenderEmailDriver } from './unisender-driver'

export type { EmailDriver, EmailMessage } from './types'
export { sentEmails } from './memory-driver'

export function getEmailDriver(): EmailDriver {
  const driver = process.env.EMAIL_DRIVER ?? 'console'
  switch (driver) {
    case 'console':
      return consoleEmailDriver
    case 'memory':
      return memoryEmailDriver
    case 'unisender':
      return unisenderEmailDriver
    default:
      throw new Error(`Unknown EMAIL_DRIVER: ${driver}`)
  }
}
