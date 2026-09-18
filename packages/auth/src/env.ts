const required = (key: string): string => {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set`)
  return v
}

export const env = {
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: required('BETTER_AUTH_URL'),
} as const
