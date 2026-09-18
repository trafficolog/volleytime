import { accounts, db, sessions, users, verifications } from '@volley-time/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'

import { getEmailDriver } from './email'
import { env } from './env'
import { botTokenFromEnv, telegramPlugin } from './telegram/plugin'

/**
 * Базовая конфигурация better-auth.
 * - Drizzle adapter поверх нашей БД (Phase 3.2)
 * - email-OTP вход (код на email; драйвер console в dev — 3.3.2)
 * - Telegram Mini App: плагин telegramPlugin → POST /api/auth/sign-in/telegram (3.9.4)
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  // users.id / sessions.id — serial (Task 3.9.3)
  advanced: {
    database: { generateId: 'serial' },
  },
  verification: {
    storeIdentifier: 'hashed',
  },
  emailAndPassword: {
    enabled: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    // Telegram Mini App → сессия better-auth (единый источник сессий, 3.9.4)
    telegramPlugin({ getBotToken: botTokenFromEnv }),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        const driver = getEmailDriver()
        await driver.send({
          to: email,
          subject: 'Код входа в Volley Time',
          text: `Ваш код: ${otp}\n\nКод действителен 5 минут.`,
        })
      },
      otpLength: 6,
      storeOTP: 'hashed',
      expiresIn: 5 * 60,
    }),
  ],
})

export type Auth = typeof auth
