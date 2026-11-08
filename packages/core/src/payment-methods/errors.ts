export class PaymentMethodError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PaymentMethodError'
  }
}
export class PaymentMethodInvalidError extends PaymentMethodError {
  constructor(message: string) {
    super('payment_method.invalid', message)
  }
}
