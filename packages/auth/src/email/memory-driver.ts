import type { EmailDriver, EmailMessage } from './types'

/** Драйвер для тестов: складывает письма в память (EMAIL_DRIVER=memory). */
export const sentEmails: EmailMessage[] = []

export const memoryEmailDriver: EmailDriver = {
  async send(message) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('memory email driver is not allowed in production')
    }
    sentEmails.push(message)
  },
}
