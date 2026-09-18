export class SubscriptionError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'SubscriptionError'
  }
}
export class SubscriptionNotFoundError extends SubscriptionError {
  constructor(id: number) {
    super('subscription.not_found', `Subscription ${id} not found`)
  }
}
export class NoActiveSubscriptionError extends SubscriptionError {
  constructor() {
    super('subscription.no_active', 'No active subscription with remaining sessions')
  }
}
export class SubscriptionPendingExistsError extends SubscriptionError {
  constructor() {
    super('subscription.pending_exists', 'You already have an unpaid subscription for this plan')
  }
}
export class SubscriptionNotPendingError extends SubscriptionError {
  constructor() {
    super('subscription.not_pending', 'Subscription is not pending')
  }
}
