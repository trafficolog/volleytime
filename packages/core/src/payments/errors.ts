export class PaymentError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PaymentError'
  }
}
export class PaymentNotFoundError extends PaymentError {
  constructor(id: number) {
    super('payment.not_found', `Payment ${id} not found`)
  }
}
export class PaymentNotPendingError extends PaymentError {
  constructor() {
    super('payment.not_pending', 'Payment is not pending')
  }
}
export class PaymentNotSucceededError extends PaymentError {
  constructor() {
    super('payment.not_succeeded', 'Payment is not succeeded (cannot refund)')
  }
}
