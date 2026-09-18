const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

export const env = {
  DATABASE_URL: databaseUrl,
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
} as const
