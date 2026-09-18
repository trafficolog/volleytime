import { resolveServerConfig } from '../utils/config'

/**
 * Fail-fast конфигурации (Task 3.9.2): в production процесс не стартует без обязательных
 * переменных. В dev — предупреждение. Значения секретов не логируются.
 */
export default defineNitroPlugin(() => {
  const { missing, isProduction } = resolveServerConfig(useRuntimeConfig() as never)
  if (missing.length > 0) {
    const message = `[config] missing required env: ${missing.join(', ')}`
    if (isProduction) {
      console.error(message)
      throw new Error(message)
    }
    console.warn(`${message} (dev: using defaults where possible)`)
  }
})
