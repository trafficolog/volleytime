import type { EmailDriver } from './types'

export const consoleEmailDriver: EmailDriver = {
  async send(message) {
    const banner = '═'.repeat(60)
    console.log(`\n${banner}`)
    console.log('📧 [DEV EMAIL]')
    console.log(banner)
    console.log(`To:      ${message.to}`)
    console.log(`Subject: ${message.subject}`)
    console.log('---')
    console.log(message.text)
    console.log(`${banner}\n`)
  },
}
