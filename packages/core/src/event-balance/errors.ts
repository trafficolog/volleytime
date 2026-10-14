export class EventBalanceError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'EventBalanceError'
  }
}

/** Баланса событий не хватает на публикацию (409). */
export class InsufficientEventBalanceError extends EventBalanceError {
  constructor() {
    super('event_balance.insufficient', 'Недостаточно баланса событий')
  }
}
