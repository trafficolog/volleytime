import { isSplitPricingEnabled } from '@volley-time/core'

export default defineApiHandler((event) => {
  // tenant middleware (4.5.1) уже проверил доступ и наполнил context
  return {
    organization: event.context.organization,
    myMember: event.context.member,
    capabilities: {
      eventSplitPricing: isSplitPricingEnabled(process.env.EVENT_SPLIT_PRICING_ENABLED),
    },
  }
})
