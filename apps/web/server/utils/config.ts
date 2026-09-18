/**
 * Единая точка чтения серверной конфигурации (Task 3.9.2).
 *
 * Nuxt перекрывает runtimeConfig только переменными NUXT_*, а .env / compose задают
 * TELEGRAM_BOT_TOKEN и т.п. Поэтому значение берётся по цепочке:
 * runtimeConfig (NUXT_*) → привычная переменная → dev-дефолт (только не в production).
 */
export interface ServerConfig {
  telegramBotToken: string
  telegramBotUsername: string
  botInternalUrl: string
  botInternalSecret: string
  webUrl: string
}

type Env = Record<string, string | undefined>

/** Переменные, без которых production-процесс не стартует. */
export const REQUIRED_IN_PRODUCTION: Record<keyof ServerConfig, string> = {
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramBotUsername: 'TELEGRAM_BOT_USERNAME',
  botInternalUrl: 'BOT_INTERNAL_URL',
  botInternalSecret: 'BOT_INTERNAL_SECRET',
  webUrl: 'WEB_URL',
}

const pick = (...values: (string | undefined)[]): string =>
  values.find((v) => typeof v === 'string' && v.trim() !== '')?.trim() ?? ''

export function resolveServerConfig(
  runtime: Partial<ServerConfig> & { public?: Partial<ServerConfig> } = {},
  env: Env = process.env,
): { config: ServerConfig; missing: string[]; isProduction: boolean } {
  const isProduction = env.NODE_ENV === 'production'
  const config: ServerConfig = {
    telegramBotToken: pick(runtime.telegramBotToken, env.TELEGRAM_BOT_TOKEN),
    telegramBotUsername: pick(
      runtime.public?.telegramBotUsername,
      runtime.telegramBotUsername,
      env.TELEGRAM_BOT_USERNAME,
    ).replace(/^@/, ''),
    botInternalUrl: pick(
      runtime.botInternalUrl,
      env.BOT_INTERNAL_URL,
      isProduction ? '' : 'http://localhost:3001',
    ),
    botInternalSecret: pick(
      runtime.botInternalSecret,
      env.BOT_INTERNAL_SECRET,
      isProduction ? '' : 'dev-internal-secret',
    ),
    webUrl: pick(
      runtime.public?.webUrl,
      runtime.webUrl,
      env.WEB_URL,
      isProduction ? '' : 'http://localhost:3000',
    ).replace(/\/+$/, ''),
  }
  const missing = (Object.keys(REQUIRED_IN_PRODUCTION) as (keyof ServerConfig)[])
    .filter((k) => !config[k])
    .map((k) => REQUIRED_IN_PRODUCTION[k])
  return { config, missing, isProduction }
}

let cached: ServerConfig | null = null

/** Конфиг для серверного кода Nitro (кешируется на процесс). */
export function getServerConfig(): ServerConfig {
  if (!cached) {
    cached = resolveServerConfig(useRuntimeConfig() as never).config
  }
  return cached
}

/** Только для тестов. */
export function __resetServerConfigCache(): void {
  cached = null
}
